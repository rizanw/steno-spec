// "New spec": ask for a name, an optional title and a kind, then let the Bundled_CLI create the Spec
// (R5.7, R5.8). The CLI is the one that ships inside the `.vsix`, run on the editor's own Node with no
// shell, so a Restricted Mode workspace creates a Spec exactly as a trusted one does.
import { execFile } from 'node:child_process';
import * as vscode from 'vscode';
import { pickProject } from './pick.js';
import type { ChangeResult, StructuredError } from './protocol.js';
import { showRefusal } from './refusal.js';
import type { FolderServer, ServerPool } from './servers.js';
import { DEFAULT_SPECS_DIR, FolderNode, OPEN_COMMAND } from './tree.js';

/** The three things "New spec" can create; `brief` is the brainstorm-first feature Spec. */
export type Kind = 'feature' | 'bugfix' | 'brief';

/** The flag each kind adds to `steno new`; a plain feature Spec adds none. */
const KIND_FLAG: Record<Kind, string | undefined> = { feature: undefined, bugfix: '--bugfix', brief: '--brief' };

/**
 * The arguments for `steno new`. Every piece of user text is one list entry of its own, so nothing the
 * user types can become a second argument or a flag, and the call ends with `--root <root> --json`.
 */
export function cliArgs(root: string, slug: string, kind: Kind, title?: string): string[] {
  const flag = KIND_FLAG[kind];
  return [
    'new', slug,
    ...(flag ? [flag] : []),
    ...(title ? ['-t', title] : []),
    '--root', root, '--json',
  ];
}

/** What the CLI left behind: its exit code and the two streams. A process that never ran has code `-1`. */
interface Exit { code: number; stdout: string; stderr: string }

// `ELECTRON_RUN_AS_NODE=1` makes the editor's own binary behave as plain Node, and `shell: false` keeps
// every argument a single value: no quoting rule of a shell can reach the name or title the user typed.
/** Run the bundled CLI, giving back what it left behind rather than throwing on a non-zero exit. */
function exec(cli: string, args: string[]): Promise<Exit> {
  return new Promise(resolve => {
    execFile(
      process.execPath, [cli, ...args],
      { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, shell: false },
      (err, stdout, stderr) => {
        if (!err) { resolve({ code: 0, stdout, stderr }); return; }
        const code = typeof (err as { code?: unknown }).code === 'number' ? (err as unknown as { code: number }).code : -1;
        resolve({ code, stdout, stderr: stderr || err.message });
      },
    );
  });
}

/** The CLI's standard output as one JSON object, or `undefined` when it is anything else. */
function parsed(stdout: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(stdout);
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
  } catch { return undefined; }
}

/** The first line of a stream, for the message a non-JSON failure shows. */
function firstLine(text: string): string {
  return text.split(/\r?\n/).find(line => line.trim().length > 0)?.trim() ?? '';
}

/**
 * Create a Spec with the bundled CLI. Exit code 0 with a JSON object gives the `ChangeResult` it made;
 * exit code 1 or 2 with one gives the `StructuredError` it refused with, for `showRefusal` to show.
 * Any other ending — a crash, or output that is not JSON — throws, naming the exit code and the first
 * line of standard error.
 */
export async function runCli(cli: string, args: string[]): Promise<ChangeResult | StructuredError> {
  const { code, stdout, stderr } = await exec(cli, args);
  const json = parsed(stdout);
  if (json && code === 0) return json as unknown as ChangeResult;
  if (json && (code === 1 || code === 2)) return json as unknown as StructuredError;
  const detail = firstLine(stderr);
  throw new Error(`steno exited with code ${code}${detail ? `: ${detail}` : ''}`);
}

/** Whether the CLI refused the change rather than making it; the refusal is a Structured_Error. */
export function refused(result: ChangeResult | StructuredError): result is StructuredError {
  return typeof (result as StructuredError).code === 'string';
}

// --- the input flow ------------------------------------------------------------------------------

export const NEW_SPEC_COMMAND = 'steno.spec.new';

/** The title every box and pick of the flow carries, so the user can see which one they are in. */
const TITLE = 'New spec';

/** The same rule core's `assertSlug` applies: a Spec name becomes a directory name under the specs folder. */
const SLUG = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Why the name box should stay open, or `undefined` when the name is good. A name that is not a slug, or
 * that names a Spec the folder already has, is refused here and never reaches the CLI (R5.6, R5.7).
 */
export function validateName(name: string, existing: readonly string[]): string | undefined {
  if (!SLUG.test(name)) return `spec name must be a kebab-case slug, got "${name}"`;
  if (existing.includes(name)) return `spec already exists: ${name}`;
  return undefined;
}

/** The kinds, in the order they are offered; the first is the one the pick opens on (R5.7). */
// not named `kind`: `QuickPickItem.kind` is VS Code's own separator flag
const KINDS: readonly { label: string; description: string; makes: Kind }[] = [
  { label: 'feature', description: 'requirements first', makes: 'feature' },
  { label: 'bugfix', description: 'bugfix.md instead of requirements.md', makes: 'bugfix' },
  { label: 'brief first', description: 'brainstorm in brief.md before the requirements', makes: 'brief' },
];

/** The Spec_Document a new Spec opens at, whichever of these the CLI created first. */
const OPENS = ['brief.md', 'requirements.md', 'bugfix.md'];

/** The folders that are Steno_Projects right now: a running server whose tree says the folder is set up. */
export function projectServers(pool: ServerPool): FolderServer[] {
  return pool.all().filter(s => s.state !== 'stopped' && s.tree !== undefined && s.tree.notSetUp !== true);
}

/**
 * The project to create in: the hints first, and a quick pick only when neither settled it (R5.8).
 * `undefined` means the user escaped the pick.
 */
async function chooseProject(pool: ServerPool, servers: FolderServer[], node: unknown): Promise<FolderServer | undefined> {
  const paths = servers.map(s => s.folder.uri.fsPath);
  const fromItem = node instanceof FolderNode ? node.folder.uri.fsPath : undefined;
  const editor = vscode.window.activeTextEditor?.document.uri;
  // a file outside every project is no hint at all; `pickProject` keeps only a path that is in the list
  const fromEditor = editor ? pool.get(editor)?.folder.uri.fsPath : undefined;
  const chosen = pickProject(paths, fromItem, fromEditor);
  if (chosen !== undefined) return servers.find(s => s.folder.uri.fsPath === chosen);
  const items = servers.map(s => ({ label: s.folder.name, description: s.folder.uri.fsPath, server: s }));
  const picked = await vscode.window.showQuickPick(items, { title: TITLE, placeHolder: 'Which steno project?' });
  return picked?.server;
}

/** Open the Spec the CLI just created, at the first document it wrote that a Spec starts from (R5.7). */
async function openCreated(server: FolderServer, result: ChangeResult): Promise<void> {
  const created = result.created ?? [];
  const document = OPENS.find(file => created.includes(file));
  if (!document) return;
  const dir = (server.tree?.specsDir ?? DEFAULT_SPECS_DIR).split('/').filter(Boolean);
  await vscode.commands.executeCommand(
    OPEN_COMMAND, vscode.Uri.joinPath(server.folder.uri, ...dir, result.spec, document), 1);
}

/**
 * Ask for a name, an optional title and a kind, in that order, then create the Spec with the bundled CLI
 * and open it (R5.7). Escape at any step ends the flow and changes nothing. A refused name is re-asked in
 * the box itself; every other refusal is shown as a notification (R5.6).
 */
export async function newSpec(pool: ServerPool, cli: string, node?: unknown): Promise<void> {
  const servers = projectServers(pool);
  if (servers.length === 0) return;
  const server = await chooseProject(pool, servers, node);
  if (!server) return;

  const existing = (server.tree?.specs ?? []).map(s => s.name);
  const slug = await vscode.window.showInputBox({
    title: TITLE, prompt: 'Spec name', placeHolder: 'kebab-case-slug',
    validateInput: value => validateName(value, existing),
  });
  if (slug === undefined) return;
  const title = await vscode.window.showInputBox({ title: TITLE, prompt: 'Title (optional)', placeHolder: slug });
  if (title === undefined) return;
  const kind = await vscode.window.showQuickPick(KINDS, { title: TITLE, placeHolder: 'Kind' });
  if (!kind) return;

  let result: ChangeResult | StructuredError;
  try {
    result = await runCli(cli, cliArgs(server.folder.uri.fsPath, slug, kind.makes, title.trim() || undefined));
  } catch (err) {
    // the CLI ended in a way that carries no Structured_Error: its message is all there is to show
    await showRefusal(err, server.folder);
    return;
  }
  if (refused(result)) { await showRefusal(result, server.folder); return; }
  await openCreated(server, result);
}

/** `steno.spec.new`: the view title, a project folder's menu and the palette all reach the same flow (R5.7). */
export function registerNewSpec(pool: ServerPool, cli: string): vscode.Disposable {
  return vscode.commands.registerCommand(NEW_SPEC_COMMAND, (node?: unknown) => newSpec(pool, cli, node));
}
