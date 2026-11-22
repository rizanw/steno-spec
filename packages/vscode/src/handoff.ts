// Handing work to a coding agent. Every handoff takes the same path: check workspace trust, build the skill call,
// find the chosen agent, offer to save unsaved spec and steering edits, then deliver the call through the agent's
// extension or a new terminal. Anything that can't be delivered ends up on the clipboard with a message saying so.
import { posix, win32 } from 'node:path';
import * as vscode from 'vscode';
import type { AgentAdapter, Probe } from './agents.js';
import { cmdLine, findOnPath, isBatch, render, skillCall, unsafeBatch, unusable, specsDir, steeringDir, type Handoff } from '@steno/core/host';
import type { Chooser } from './chooser.js';
import type { FolderServer, ServerPool } from './servers.js';
import { chooseProject, projectServers } from './project.js';
import { FolderNode, SpecNode, TaskNode } from './tree.js';
import { guard } from './trust.js';

export interface Deps { chooser: Chooser; probe: Probe }

export const RUN_TASK_COMMAND = 'steno.task.run';
export const RUN_NEXT_COMMAND = 'steno.spec.runNext';
export const WRITE_COMMAND = 'steno.spec.write';
export const REVIEW_COMMAND = 'steno.spec.review';
export const STEER_COMMAND = 'steno.steering.generate';

type PhaseVerb = 'write' | 'revise' | 'review';

/**
 * A VS Code menu title cannot change per row, so each phase gets its own Write, Revise and Review command, titled
 * like Paseo's sheet: Write Design, Revise Tasks, Review Drift. Revise is Write once the phase's document is
 * filled in. They hand off exactly as `steno.spec.write` and `steno.spec.review` do, which stay for keybindings.
 */
export const PHASE_COMMANDS: readonly { command: string; verb: PhaseVerb; phase: string }[] = [
  ...['brief', 'requirements', 'design', 'tasks'].flatMap(phase => (['write', 'revise'] as const).map(verb => ({ verb, phase }))),
  ...['requirements', 'design', 'tasks', 'done'].map(phase => ({ verb: 'review' as const, phase })),
].map(c => ({ ...c, command: `steno.spec.${c.verb}.${c.phase}` }));

const SAVE = 'Save and hand off';
const DONT_SAVE = 'Hand off without saving';
const PASTE = 'Skill call copied; paste it into your agent';

/** Whether `path` is `dir` itself or sits somewhere under it. Accepts either slash, so it works on Windows too. */
function under(path: string, dir: string): boolean {
  const root = dir.replace(/[\\/]+$/, '');
  return path === root || path.startsWith(root + '/') || path.startsWith(root + '\\');
}

/**
 * The open documents with unsaved edits that the agent is about to read: anything under the Spec's folder and the
 * project's steering folder. Generating steering has no Spec, so `specDir` is `undefined` then.
 */
export function dirtyFor(open: { path: string; dirty: boolean }[], specDir: string | undefined, steeringDir: string): string[] {
  return open
    .filter(doc => doc.dirty && ((specDir !== undefined && under(doc.path, specDir)) || under(doc.path, steeringDir)))
    .map(doc => doc.path);
}

/**
 * How the terminal starts the agent's program. Normally it runs the program directly with the arguments as a list,
 * so no shell ever parses the call. A Windows `.cmd` or `.bat` shim (how npm installs CLIs) can only be started by
 * `cmd.exe`, so we hand it one command line, quoting each argument that holds a space.
 */
export function terminalOptions(program: string, args: string[], windows: boolean): { shellPath: string; shellArgs: string[] | string } {
  if (!windows || !isBatch(program)) return { shellPath: program, shellArgs: args };
  return { shellPath: 'cmd.exe', shellArgs: `/d /s /c "${cmdLine(program, args)}"` };
}

/** Human wording for what's being handed off, for the error when no skill call fits. */
function describe(h: Handoff): string {
  if (h.kind === 'steer') return 'steering';
  if (h.kind === 'run' && h.task !== undefined) return `task ${h.task} of ${h.spec}`;
  return h.spec;
}

/** The steno projects open in this window: folders on disk that hold a `.steno` folder. */
function projectFolders(probe: Probe): vscode.WorkspaceFolder[] {
  return (vscode.workspace.workspaceFolders ?? []).filter(f =>
    f.uri.scheme === 'file' && probe.exists((probe.env.windows ? win32 : posix).join(f.uri.fsPath, '.steno')));
}

/** Copies the call and says why. The saved agent stays as it is. */
async function toClipboard(text: string, message: string): Promise<void> {
  await vscode.env.clipboard.writeText(text);
  void vscode.window.showInformationMessage(message);
}

/** Why a delivery fell back to the clipboard, or `undefined` when it went through. */
type Fallback = 'missing' | 'unreachable' | { otherFolder: string } | undefined;

/** Sends the call through the agent's VS Code extension. Only works when this is the window's only steno project. */
async function viaExtension(
  via: { extension: string; deliver: 'chatCommand' | 'uri' },
  text: string,
  server: FolderServer,
  probe: Probe,
): Promise<Fallback> {
  if (!probe.hasExtension(via.extension)) return 'missing';
  // the agent's chat belongs to the whole window, so it can't tell which project we mean when there are several
  const projects = projectFolders(probe);
  if (projects.length > 1 || (projects.length === 1 && projects[0].uri.toString() !== server.folder.uri.toString())) {
    return { otherFolder: server.folder.name };
  }
  try {
    if (via.deliver === 'chatCommand') {
      await vscode.commands.executeCommand('workbench.action.chat.open', { query: text, isPartialQuery: true });
      return undefined;
    }
    const uri = vscode.Uri.parse(`${vscode.env.uriScheme}://${via.extension}/open?prompt=${encodeURIComponent(text)}`);
    return (await vscode.env.openExternal(uri)) ? undefined : 'unreachable';
  } catch {
    return 'unreachable';
  }
}

/**
 * The last terminal steno started for each agent in each folder. Only these are ever reused: steno runs the agent
 * as the terminal's own program, so while the terminal has not exited the agent is still there to read the call.
 * A terminal the user opened could hold a shell, a server or a prompt waiting for an answer, so it is never typed into.
 */
const started = new Map<string, vscode.Terminal>();
const startedKey = (agent: AgentAdapter, server: FolderServer): string => `${agent.id} ${server.folder.uri.toString()}`;

/** The agent's terminal in this folder that is still open with the agent running, if steno started one. */
export function runningTerminal(agent: AgentAdapter, server: FolderServer): vscode.Terminal | undefined {
  const key = startedKey(agent, server);
  const terminal = started.get(key);
  if (terminal && terminal.exitStatus === undefined && vscode.window.terminals.includes(terminal)) return terminal;
  started.delete(key);
  return undefined;
}

/**
 * Whether this handoff may go to an agent that is already running. A review must start fresh, so it never reads the
 * conversation that wrote what it reviews, and steering is generated from the project, not from a session.
 */
export const mayReuse = (h: Handoff): boolean => h.kind === 'run' || h.kind === 'write';

const SEND = (label: string) => `Send to the running ${label}`;
const START = (label: string) => `Start a new ${label}`;

/**
 * Types the call into the agent's running terminal and presses Enter. The two are sent apart: an agent that reads
 * one burst of input as a paste would take the Enter as a new line in its prompt rather than as sending it.
 */
function intoTerminal(terminal: vscode.Terminal, text: string): void {
  terminal.sendText(text, false);
  terminal.sendText('\r', false);
  terminal.show();
}

/** Starts the agent's program in a new terminal in the handoff's folder, with the call as its first prompt. */
function viaTerminal(
  agent: AgentAdapter,
  via: { program: string; args: (call: string) => string[] },
  text: string,
  server: FolderServer,
  probe: Probe,
): Fallback {
  const program = findOnPath(via.program, probe.env, probe.exists);
  if (!program) return 'missing';
  if (unsafeBatch(program, probe.env.windows)) return 'unreachable';
  try {
    const terminal = vscode.window.createTerminal({
      name: agent.label,
      cwd: server.folder.uri,
      ...terminalOptions(program, via.args(text), probe.env.windows),
    });
    started.set(startedKey(agent, server), terminal);
    terminal.show();
    return undefined;
  } catch {
    return 'unreachable';
  }
}

/**
 * Hands one piece of work to the chosen agent. Dismissing any prompt along the way cancels the whole handoff and
 * leaves everything as it was: no agent saved, no document saved, nothing sent.
 */
export async function handOff(deps: Deps, server: FolderServer, h: Handoff): Promise<void> {
  if (!(await guard('Handing work to an agent'))) return;

  const call = skillCall(h);
  if (!call) {
    void vscode.window.showErrorMessage(
      `Cannot hand off ${describe(h)}: no steno skill fits its phase, or its name holds characters a skill call cannot carry`);
    return;
  }

  const saved = deps.chooser.current();
  const agent = saved ?? (await deps.chooser.pick());
  if (!agent) return;

  const tree = server.tree;
  const sep = deps.probe.env.windows ? win32 : posix;
  const root = server.folder.uri.fsPath;
  const specDir = h.kind === 'steer' ? undefined : sep.join(root, ...specsDir(tree).split('/'), h.spec);
  const steeringPath = sep.join(root, ...steeringDir(tree).split('/'));
  const documents = vscode.workspace.textDocuments;
  const dirty = new Set(dirtyFor(documents.map(d => ({ path: d.uri.fsPath, dirty: d.isDirty })), specDir, steeringPath));
  let save = false;
  if (dirty.size > 0) {
    const choice = await vscode.window.showWarningMessage(
      dirty.size === 1 ? 'A spec or steering file has unsaved edits' : `${dirty.size} spec or steering files have unsaved edits`,
      { modal: true, detail: 'The agent reads the files on disk, so it will not see edits that are not saved.' },
      SAVE, DONT_SAVE);
    if (choice === undefined) return;
    save = choice === SAVE;
  }

  // an agent steno started here is still running: the user picks between it and a fresh session
  const running = typeof agent.via === 'object' && 'program' in agent.via && mayReuse(h) ? runningTerminal(agent, server) : undefined;
  let reuse: vscode.Terminal | undefined;
  if (running) {
    const items = [SEND(agent.label), START(agent.label)].map(label => ({ label }));
    const picked = await vscode.window.showQuickPick(items, {
      title: `${agent.label} is already running in ${server.folder.name}`,
      placeHolder: 'A new session starts with a clean context; the running one keeps what it has read',
    });
    if (!picked) return;
    if (picked.label === SEND(agent.label)) reuse = running;
  }

  // every prompt is answered: from here on the handoff goes ahead
  if (!saved) await deps.chooser.save(agent);
  if (save) await Promise.all(documents.filter(d => dirty.has(d.uri.fsPath)).map(d => d.save()));

  const text = render(call, agent.form);
  const { via } = agent;
  if (via === 'clipboard') {
    await toClipboard(text, PASTE);
    return;
  }
  if (reuse) {
    intoTerminal(reuse, text);
    return;
  }
  const fallback = 'extension' in via
    ? await viaExtension(via, text, server, deps.probe)
    : viaTerminal(agent, via, text, server, deps.probe);
  if (fallback === 'missing') await toClipboard(text, `${agent.label} was not found. ${PASTE}`);
  else if (fallback === 'unreachable') await toClipboard(text, `${agent.label} could not be reached. ${PASTE}`);
  else if (fallback) await toClipboard(text, `${PASTE} in ${fallback.otherFolder}`);
  else if (agent.fillOnly) void vscode.window.showInformationMessage(`Press Enter in ${agent.label} to send it`);
}

/** What the run lens passes once the middleware has added the document's URI. */
interface RunLensArgs { spec?: unknown; task?: unknown; uri?: unknown }

/**
 * The handoff commands. None is in the command palette: each one acts only on the tree node it hangs off
 * (or, for "Run", the run lens), and ignores a node of the wrong kind or a Spec steno can't read.
 */
export function registerHandoffs(pool: ServerPool, deps: Deps): vscode.Disposable[] {
  /** The server of a usable Spec's folder, or `undefined` when the node can't be handed off. */
  const specServer = (node: unknown): { node: SpecNode; server: FolderServer } | undefined => {
    if (!(node instanceof SpecNode) || node.unusable || !node.spec.phase) return undefined;
    const server = pool.get(node.folder);
    return server && { node, server };
  };
  /** Hand off writing or reviewing the spec's current phase; the agent reads the phase from the spec, not the menu. */
  const phaseWork = async (kind: 'write' | 'review', arg: unknown): Promise<void> => {
    const found = specServer(arg);
    if (found) await handOff(deps, found.server, { kind, spec: found.node.spec.name, phase: found.node.spec.phase! });
  };
  return [
    vscode.commands.registerCommand(RUN_TASK_COMMAND, async (arg: unknown) => {
      if (arg instanceof TaskNode) {
        if (arg.done || !arg.taskId || unusable(arg.spec) || !arg.resourceUri) return;
        const server = pool.get(arg.resourceUri);
        if (server) await handOff(deps, server, { kind: 'run', spec: arg.spec.name, task: arg.taskId });
        return;
      }
      const args = arg as RunLensArgs | undefined;
      if (!args || typeof args.spec !== 'string' || typeof args.task !== 'string' || !(args.uri instanceof vscode.Uri)) return;
      const server = pool.get(args.uri);
      if (server) await handOff(deps, server, { kind: 'run', spec: args.spec, task: args.task });
    }),
    vscode.commands.registerCommand(RUN_NEXT_COMMAND, async (arg: unknown) => {
      const found = specServer(arg);
      if (found) await handOff(deps, found.server, { kind: 'run', spec: found.node.spec.name });
    }),
    vscode.commands.registerCommand(WRITE_COMMAND, (arg: unknown) => phaseWork('write', arg)),
    vscode.commands.registerCommand(REVIEW_COMMAND, (arg: unknown) => phaseWork('review', arg)),
    ...PHASE_COMMANDS.map(c => vscode.commands.registerCommand(c.command, (arg: unknown) => phaseWork(c.verb === 'review' ? 'review' : 'write', arg))),
    vscode.commands.registerCommand(STEER_COMMAND, async (arg: unknown) => {
      // from a folder of the Steering view, or from its title bar or empty state with no item at all
      if (arg !== undefined && !(arg instanceof FolderNode)) return;
      const servers = projectServers(pool);
      if (servers.length === 0) return;
      const server = await chooseProject(pool, servers, arg, 'Generate steering');
      if (server) await handOff(deps, server, { kind: 'steer' });
    }),
  ];
}
