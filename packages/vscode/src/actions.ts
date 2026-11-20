// The three state changes: approve a Spec's phase, mark a task done, reopen a done task.
// Each goes to the folder's own server; the server's `steno/treeChanged` notice then redraws the tree.
import * as vscode from 'vscode';
import { METHODS, type ChangeResult, type TreeSpec } from './protocol.js';
import { showRefusal, showStopped } from './refusal.js';
import type { FolderServer, ServerPool } from './servers.js';
import { SpecNode, TaskNode, unusable } from './tree.js';

export const APPROVE_COMMAND = 'steno.spec.approve';
export const MARK_DONE_COMMAND = 'steno.task.markDone';
export const REOPEN_COMMAND = 'steno.task.reopen';
/** The done lens's command; the server names it and the lens middleware adds the document's URI. */
export const DONE_LENS_COMMAND = 'steno.task.done';

/** The phases a gated Spec can approve; `execute` and `done` have nothing left to approve. */
const APPROVABLE: readonly string[] = ['brief', 'requirements', 'design', 'tasks'];

/** Whether the tree offers "Approve" on this Spec: usable, gated, and in a phase that awaits approval. */
export function canApprove(spec: TreeSpec): boolean {
  return !unusable(spec) && spec.mode === 'gated' && spec.phase !== undefined && APPROVABLE.includes(spec.phase);
}

/**
 * Send one state change to a folder's server. A stopped server gets the stopped message instead, and a
 * refusal goes to `showRefusal`, whose "Save and retry" sends the same change again. `undefined` means
 * nothing was changed.
 */
async function change(
  pool: ServerPool,
  server: FolderServer,
  method: string,
  params: Record<string, unknown>,
): Promise<ChangeResult | undefined> {
  if (server.state === 'stopped') {
    await showStopped(pool, server);
    return undefined;
  }
  try {
    return await server.client.sendRequest<ChangeResult>(method, params);
  } catch (err) {
    let retried: ChangeResult | undefined;
    await showRefusal(err, server.folder, async () => { retried = await change(pool, server, method, params); });
    return retried;
  }
}

/** Approve the Spec's current phase and say which phase it moved to. */
async function approve(pool: ServerPool, node: SpecNode): Promise<void> {
  const { spec } = node;
  if (!canApprove(spec)) return;
  const server = pool.get(node.folder);
  if (!server) return;
  const result = await change(pool, server, METHODS.approve, { spec: spec.name, phase: spec.phase });
  if (result) void vscode.window.showInformationMessage(`${spec.name}: ${spec.phase} approved — now in ${result.phase}`);
}

/** The server of the folder that holds this task's `tasks.md`. */
function taskServer(pool: ServerPool, node: TaskNode): FolderServer | undefined {
  return node.resourceUri ? pool.get(node.resourceUri) : undefined;
}

/** Mark an open task done. */
async function markDone(pool: ServerPool, node: TaskNode): Promise<void> {
  if (node.done || !node.taskId) return;
  const server = taskServer(pool, node);
  if (server) await change(pool, server, METHODS.taskDone, { spec: node.spec.name, task: node.taskId });
}

/** Reopen a done task, after the user confirms it in a modal. */
async function reopen(pool: ServerPool, server: FolderServer, spec: string, task: string): Promise<void> {
  const choice = await vscode.window.showWarningMessage(`Reopen ${task} of ${spec}?`, { modal: true, detail: 'steno marks the task open again; the code it wrote stays as it is.' }, 'Reopen');
  if (choice !== 'Reopen') return;
  await change(pool, server, METHODS.taskReopen, { spec, task });
}

/** What the done lens passes once the middleware has added the document's URI. */
interface DoneLensArgs { spec?: unknown; task?: unknown; uri?: unknown }

/**
 * The four commands. None is in the command palette, and the approve handler acts only on a `SpecNode`,
 * which nothing outside this bundle can build: an approval starts only from the tree's "Approve".
 */
export function registerActions(pool: ServerPool): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand(APPROVE_COMMAND, async (node: unknown) => {
      if (node instanceof SpecNode) await approve(pool, node);
    }),
    vscode.commands.registerCommand(MARK_DONE_COMMAND, async (node: unknown) => {
      if (node instanceof TaskNode) await markDone(pool, node);
    }),
    vscode.commands.registerCommand(REOPEN_COMMAND, async (node: unknown) => {
      if (!(node instanceof TaskNode) || !node.done || !node.taskId) return;
      const server = taskServer(pool, node);
      if (server) await reopen(pool, server, node.spec.name, node.taskId);
    }),
    vscode.commands.registerCommand(DONE_LENS_COMMAND, async (args?: DoneLensArgs) => {
      if (!args || typeof args.spec !== 'string' || typeof args.task !== 'string' || !(args.uri instanceof vscode.Uri)) return;
      const server = pool.get(args.uri);
      if (server) await reopen(pool, server, args.spec, args.task);
    }),
  ];
}
