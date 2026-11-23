// Everything the panel draws for the active worktree, built whole from its server's last tree and diagnostics and the
// instruction files on disk. Rows come from core's `panelRows`, the call Paseo and VS Code draw from, so a row reads
// the same in every host.
import { existsSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { listInstructions as listWith, panelRows, parentProject, readRefusal, type FolderReader, type InstructionFiles, type PanelRow } from '@steno/core/host';
import { watchInstructions, type AgentSteno, type FolderServer } from '@steno/host';
import type { Snapshot } from '../shared/messages.js';
import type { Active } from './worktree.js';

const at = (folder: string, path: string) => join(folder, ...path.split('/'));

/** Core's listing over the disk: a missing folder or a read error lists nothing for it. */
export function listInstructions(folder: string): Promise<InstructionFiles> {
  const reader: FolderReader = {
    exists: path => stat(at(folder, path)).then(() => true, () => false),
    files: dir => readdir(at(folder, dir), { withFileTypes: true }).then(es => es.filter(e => e.isFile()).map(e => e.name), () => []),
  };
  return listWith(reader);
}

const INSIDE_KEY = 'notice:inside';

/**
 * The enclosing project's rows, folded under the notice that names it. They are shown to read, not to act on: their
 * keys would otherwise collide with the worktree's own, and a change there belongs to that project's own panel.
 */
async function enclosingRows(server: FolderServer): Promise<PanelRow[]> {
  const instructions = await listInstructions(server.folder);
  const { tree, diagnostics } = server;
  if (!tree || tree.notSetUp) return [];
  const { specRows, steeringRows } = panelRows({ tree, diagnostics, instructions });
  return [...specRows, ...steeringRows].map(({ actions: _, primary: __, ...row }) => ({
    ...row, key: `inside:${row.key}`, parent: row.parent === undefined ? INSIDE_KEY : `inside:${row.parent}`, depth: row.depth + 1, actions: [],
  }));
}

/**
 * One snapshot of the active worktree. `failure` is whatever the last request to steno threw; a refusal in it is
 * shown, anything else is not steno saying no and is left to the log.
 */
export async function buildSnapshot(active: Active, agentSteno: AgentSteno, failure?: unknown): Promise<Snapshot> {
  const { server, folder } = active;
  const instructions = await listInstructions(folder);
  // read after the listing, so a tree or diagnostics that changed while it ran are the ones drawn
  const { tree, diagnostics } = server;
  const enclosing = tree?.notSetUp ? (active.enclosing?.folder ?? parentProject(folder, existsSync)) : undefined;
  const rows = tree ? panelRows({ tree, diagnostics, instructions, enclosing }) : { specRows: [], steeringRows: [] };
  const specRows = enclosing !== undefined && active.enclosing ? [...rows.specRows, ...await enclosingRows(active.enclosing)] : rows.specRows;
  const refusal = readRefusal(failure);
  return { specRows, steeringRows: rows.steeringRows, server: server.state, agentSteno, ...(refusal ? { refusal } : {}) };
}

/** The window that gathers change signals into one post. */
export const THROTTLE_MS = 150;

export interface StreamOptions {
  /** the agents' `steno` as last checked, read on every post */
  agentSteno: () => AgentSteno;
  /** what the last request to steno threw, read on every post */
  failure?: () => unknown;
  throttleMs?: number;
  log?: (line: string) => void;
  /** for tests: how a snapshot is built and how the instruction files are watched */
  build?: typeof buildSnapshot;
  watch?: typeof watchInstructions;
}

/**
 * Post the active worktree's snapshot now and again after every change to its server, its enclosing project's server
 * or its instruction files, until `signal` aborts. A burst of changes becomes at most one post per window, and the
 * last change always gets one. `refresh` asks for a post when something outside those, such as a refusal, changed.
 */
export function streamSnapshots(active: Active, post: (snapshot: Snapshot) => void, signal: AbortSignal, options: StreamOptions): { refresh(): void } {
  const { throttleMs = THROTTLE_MS, build = buildSnapshot, watch = watchInstructions, log = () => {} } = options;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let dirty = false;
  let lastPost = -Infinity;
  // Building lists files and takes a moment, so each post waits for the one before: a slow build must never post
  // an older snapshot after a newer one.
  let sending = Promise.resolve();

  const flush = () => {
    timer = undefined;
    if (!dirty || signal.aborted) return;
    dirty = false;
    lastPost = Date.now();
    sending = sending.then(async () => {
      if (signal.aborted) return;
      const snapshot = await build(active, options.agentSteno(), options.failure?.());
      if (!signal.aborted) post(snapshot);
    }).catch(err => log(`steno: snapshot of ${active.folder} failed: ${err instanceof Error ? err.message : String(err)}`));
  };

  const changed = () => {
    if (signal.aborted) return;
    dirty = true;
    if (!timer) timer = setTimeout(flush, Math.max(0, lastPost + throttleMs - Date.now()));
  };

  const offs = [active.server.onChange(changed), ...(active.enclosing ? [active.enclosing.onChange(changed)] : [])];
  watch(active.folder, changed, signal);
  signal.addEventListener('abort', () => { for (const off of offs) off(); clearTimeout(timer); }, { once: true });
  changed();
  return { refresh: changed };
}
