// "New spec": ask for the kind of work, a name, an optional title and who writes the first document, then let
// the bundled CLI create the Spec and, when the user chose their coding agent, hand it the first phase. The CLI is the one that ships inside the `.vsix`, run on the editor's own Node with no
// shell, so a Restricted Mode workspace creates a Spec exactly as a trusted one does.
import { execFile } from 'node:child_process';
import * as vscode from 'vscode';
import { handOff, type Deps } from './handoff.js';
import { chooseProject, projectServers } from './project.js';
import { showRefusal, writeLog } from './refusal.js';
import type { FolderServer, ServerPool } from './servers.js';
import { newSpec as createSpec, specsDir, type Created, type NewSpecRequest, type RunCli } from '@steno/core/host';
import { OPEN_COMMAND } from './tree.js';

/** What the user says the work is, in the first pick. */
type SpecKind = NewSpecRequest['kind'];

/** Who writes the first document: the coding agent, the agent after a brainstorm, or the user. */
type WriteChoice = NewSpecRequest['writer'];

/** The choices the last pick offers. Brainstorming is for shaping a feature, so a bugfix doesn't get it. */
export function writeChoices(kind: SpecKind): WriteChoice[] {
  return kind === 'feature' ? ['agent', 'brainstorm', 'self'] : ['agent', 'self'];
}

// `ELECTRON_RUN_AS_NODE=1` makes the editor's own binary behave as plain Node, and `shell: false` keeps
// every argument a single value: no quoting rule of a shell can reach the name or title the user typed.
/**
 * Runs the bundled CLI at `cli`, giving back how it ended rather than throwing on a non-zero exit. It rejects only
 * when the process could not be started; a process that was killed ends with code `null`. The working directory is
 * left alone: every call names the folder with `--root`, and a folder that is not on this disk could not be one.
 */
export function bundledCli(cli: string): RunCli {
  return args => new Promise((resolve, reject) => {
    execFile(
      process.execPath, [cli, ...args],
      { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, shell: false },
      (err, stdout, stderr) => {
        if (!err) { resolve({ code: 0, stdout, stderr }); return; }
        const code = (err as { code?: unknown }).code;
        // a spawn failure names its cause in `code`, such as `ENOENT`; an exit has a number there, a kill nothing
        if (typeof code === 'string') { reject(err); return; }
        resolve({ code: typeof code === 'number' ? code : null, stdout, stderr });
      },
    );
  });
}

// --- the input flow ------------------------------------------------------------------------------

export const NEW_SPEC_COMMAND = 'steno.spec.new';

/** The title every box and pick of the flow carries, so the user can see which one they are in. */
const TITLE = 'New spec';

/** The same rule core's `assertSlug` applies: a Spec name becomes a directory name under the specs folder. */
const SLUG = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Why the name box should stay open, or `undefined` when the name is good. A name that is not a slug, or
 * that names a Spec the folder already has, is refused here and never reaches the CLI.
 */
export function validateName(name: string, existing: readonly string[]): string | undefined {
  if (!SLUG.test(name)) return `spec name must be a kebab-case slug, got "${name}"`;
  if (existing.includes(name)) return `spec already exists: ${name}`;
  return undefined;
}

/** The kinds, in the order they are offered; the first is the one the pick opens on. */
// not named `kind`: `QuickPickItem.kind` is VS Code's own separator flag
const KINDS: readonly { label: string; description: string; is: SpecKind }[] = [
  { label: 'Feature', description: 'Build something new or change how it works', is: 'feature' },
  { label: 'Bugfix', description: 'Fix something that is broken', is: 'bugfix' },
];

/** How each write choice is shown in the last pick. */
const WRITE_ITEMS: Record<WriteChoice, { label: string; detail: string }> = {
  agent: { label: 'Draft with coding agent', detail: 'Your agent writes the first draft for you to review' },
  brainstorm: { label: 'Brainstorm with coding agent', detail: 'Talk the idea through with your agent before writing it down' },
  self: { label: 'Write it myself', detail: 'Opens the document for you to fill in' },
};

/** The spec document a new Spec opens at, whichever of these the CLI created first. */
const OPENS = ['brief.md', 'requirements.md', 'bugfix.md'];

/** Open the Spec the CLI just created, at the first document it wrote that a Spec starts from. */
async function openCreated(server: FolderServer, result: Created): Promise<void> {
  const created = result.created ?? [];
  const document = OPENS.find(file => created.includes(file));
  if (!document) return;
  const dir = specsDir(server.tree).split('/').filter(Boolean);
  await vscode.commands.executeCommand(
    OPEN_COMMAND, vscode.Uri.joinPath(server.folder.uri, ...dir, result.spec, document));
}

/**
 * Ask for the kind, a name, an optional title and who writes the first document, in that order, then create the
 * Spec with the bundled CLI and open it. When the user chose their coding agent, hand it the new Spec's phase.
 * Escape at any step before the Spec exists ends the flow and changes nothing; a handoff that is refused or
 * cancelled after that leaves the Spec as it is. A refused name is re-asked in the box itself; every other
 * refusal is shown as a notification.
 */
async function newSpec(pool: ServerPool, cli: string, deps: Deps, node?: unknown): Promise<void> {
  const servers = projectServers(pool);
  if (servers.length === 0) return;
  const server = await chooseProject(pool, servers, node, TITLE);
  if (!server) return;

  const kind = await vscode.window.showQuickPick(KINDS, { title: TITLE, placeHolder: 'What are you working on?' });
  if (!kind) return;

  const existing = (server.tree?.specs ?? []).map(s => s.name);
  const slug = await vscode.window.showInputBox({
    title: TITLE, prompt: 'Spec name, as a kebab-case slug', placeHolder: 'link-expiry',
    validateInput: value => validateName(value, existing),
  });
  if (slug === undefined) return;
  const title = await vscode.window.showInputBox({ title: TITLE, prompt: 'Title (optional): the one line the tree shows', placeHolder: slug });
  if (title === undefined) return;
  const choices = writeChoices(kind.is).map(choice => ({ ...WRITE_ITEMS[choice], choice }));
  const write = await vscode.window.showQuickPick(choices, { title: TITLE, placeHolder: 'Who writes the first document?' });
  if (!write) return;
  // the agent starts from these words; the CLI saves them in the first document rather than in the message we send
  let description: string | undefined;
  if (write.choice !== 'self') {
    description = await vscode.window.showInputBox({
      title: TITLE, prompt: `Describe the ${kind.is === 'bugfix' ? 'bug' : 'feature'} in a few words (optional)`,
      placeHolder: kind.is === 'bugfix' ? 'Login times out after 30 seconds on slow networks' : 'Let users export their invoices as CSV',
    });
    if (description === undefined) return;
  }

  const outcome = await createSpec(bundledCli(cli), server.folder.uri.fsPath, {
    kind: kind.is, name: slug, title: title.trim() || undefined, description, writer: write.choice,
  });
  if (!outcome.ok) {
    writeLog(server, outcome.log);
    await showRefusal(outcome.error, server.folder);
    return;
  }
  const result = outcome.value;
  await openCreated(server, result);
  if (write.choice !== 'self') await handOff(deps, server, { kind: 'write', spec: result.spec, phase: result.phase });
}

/** `steno.spec.new`: the view title, a project folder's menu and the palette all reach the same flow. */
export function registerNewSpec(pool: ServerPool, cli: string, deps: Deps): vscode.Disposable {
  return vscode.commands.registerCommand(NEW_SPEC_COMMAND, (node?: unknown) => newSpec(pool, cli, deps, node));
}
