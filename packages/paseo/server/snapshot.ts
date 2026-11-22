// The `steno.panel` stream: everything the panel draws, pushed whole. The first push is always a full snapshot,
// so a client that reconnects never shows what it had before; after that, any burst of changes becomes one push.
import { existsSync } from 'node:fs';
import type { PluginHandlerContext } from '@getpaseo/plugin/server';
import { panelRows, parentProject } from './vendor/host.mjs';
import type { Action, PanelSnapshot } from '../shared/contracts';
import { UNCHECKED, type AgentSteno } from './agent-steno';
import type { IntentStore } from './intent';
import { listInstructions, watchInstructions } from './instructions';
import type { FolderServer, ServerPool } from './pool';

/** The window that gathers change signals into one push. */
export const THROTTLE_MS = 150;

/** How long the first push waits for the server's first tree; a slow start then shows as `starting`. */
const FIRST_TREE_MS = 5_000;

/** The directory Paseo holds the workspace in, asked fresh each time so a moved worktree is followed. */
export async function workspaceDirectory(paseo: PluginHandlerContext['paseo'], workspaceId: string): Promise<string> {
  const ref = paseo.workspaces.ref(workspaceId);
  const workspace = await ref.refresh();
  const directory = workspace?.workspaceDirectory ?? ref.directory;
  if (!directory) throw new Error(`workspace ${workspaceId} has no directory`);
  return directory;
}

/** What a snapshot carries beyond the server's state: the agents' `steno` and an intent from the Command Center. */
export interface SnapshotExtras { agentSteno?: AgentSteno; intent?: Action }

/** One snapshot from the server's last tree and diagnostics and the instruction files on disk now. */
export async function buildSnapshot(server: FolderServer, extras: SnapshotExtras = {}): Promise<PanelSnapshot> {
  const found = await listInstructions(server.directory);
  // read after the listing, so a tree or diagnostics that changed while it ran are the ones drawn
  const { tree, diagnostics, directory } = server;
  const enclosing = tree?.notSetUp ? parentProject(directory, existsSync) : undefined;
  const rows = tree ? panelRows({ tree, diagnostics, instructions: found, enclosing }) : { specRows: [], steeringRows: [] };
  return {
    ...rows,
    diagnostics: Object.fromEntries(diagnostics),
    server: server.state,
    agentSteno: extras.agentSteno ?? UNCHECKED,
    ...(extras.intent ? { intent: extras.intent } : {}),
  };
}

/** Wait for the server's first tree, or `FIRST_TREE_MS`, whichever comes first. */
export async function firstTree(server: FolderServer): Promise<void> {
  let waited: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([server.settled(), new Promise<void>(resolve => { waited = setTimeout(resolve, FIRST_TREE_MS); })]);
  clearTimeout(waited);
}

export interface PanelStream {
  workspaceId: string;
  directory: string;
  push(snapshot: PanelSnapshot): Promise<void>;
  signal: AbortSignal;
}

export interface PanelOptions {
  throttleMs?: number;
  log?: (line: string) => void;
  /** where the Command Center leaves intents; each push takes the workspace's */
  intents?: IntentStore;
  /** checks the agents' `steno` once per subscription; its answer is pushed like any other change */
  checkAgentSteno?: () => Promise<AgentSteno>;
}

/**
 * Serve one subscriber until its `signal` aborts: hold the directory's server so it is not shut down as idle,
 * push a full snapshot once the server has a tree, then one per throttle window that saw a change.
 */
export async function streamPanel(pool: ServerPool, stream: PanelStream, options: PanelOptions = {}): Promise<void> {
  const { workspaceId, directory, push, signal } = stream;
  const log = options.log ?? ((line: string) => console.log(line));
  const throttleMs = options.throttleMs ?? THROTTLE_MS;
  if (signal.aborted) return;
  const server = pool.serverFor(directory);
  const release = server.hold();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let agentSteno = UNCHECKED;
  // until the first push no change is sent on its own: the throttle window is shorter than a server's start, so a
  // signal before the first tree would otherwise push a `starting` snapshot with no rows ahead of the full one
  let opened = false;

  // listing the instruction files takes a moment, so one send waits for the last: a slow listing must not push
  // an older snapshot after a newer one
  let sending = Promise.resolve();
  const send = () => sending = sending.then(async () => {
    if (signal.aborted) return;
    const snapshot = await buildSnapshot(server, { agentSteno, intent: options.intents?.take(workspaceId) });
    if (signal.aborted) return;
    log(`steno: panel ${workspaceId}: ${snapshot.specRows.length + snapshot.steeringRows.length} rows, server ${snapshot.server}`);
    // a push that fails means the subscriber is gone; its abort cleans up
    push(snapshot).catch(() => {});
  }).catch(() => {});
  const changed = () => {
    if (!opened || signal.aborted || timer) return;
    timer = setTimeout(() => { timer = undefined; void send(); }, throttleMs);
  };

  const off = server.onChange(changed);
  const offIntent = options.intents?.onSet(workspaceId, changed);
  signal.addEventListener('abort', () => { off(); offIntent?.(); release(); if (timer) clearTimeout(timer); }, { once: true });
  options.checkAgentSteno?.().then(found => { agentSteno = found; changed(); }, () => {});
  // the watch starts before the first push, so a file written in between is either listed or signalled
  watchInstructions(directory, changed, signal);

  await firstTree(server);
  // the first push is the full state, so every signal that came while waiting is covered by it
  opened = true;
  await send();
}
