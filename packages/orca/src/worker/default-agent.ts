// The coding agent a worktree hands work to without asking, as the VS Code extension remembers one per workspace.
// The first pick in a worktree saves it; the panel's Agent line changes it. Every worktree is kept under one key of
// the plugin's private store, so worktree paths never become store keys, whose length and characters Orca limits.
import type { OrcaWorkerApi } from 'orca/worker';
import type { RunningAgent } from '../shared/messages.js';
import { launchable } from './agents.js';

type Orca = Pick<OrcaWorkerApi, 'host'>;

const KEY = 'defaultAgents';

type Saved = Record<string, string>;

const isSaved = (value: unknown): value is Saved =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && Object.values(value).every(v => typeof v === 'string');

async function readAll(orca: Orca): Promise<Saved> {
  const { value } = await orca.host.call('storage.get', { key: KEY });
  return isSaved(value) ? value : {};
}

/**
 * The agent saved for `folder`, by its steno key. One Orca can no longer start reads as none, so the hand-off asks
 * again instead of failing; so does a store Orca will not read.
 */
export async function savedAgent(orca: Orca, folder: string): Promise<string | undefined> {
  const agent = (await readAll(orca).catch((): Saved => ({})))[folder];
  return agent !== undefined && launchable().includes(agent) ? agent : undefined;
}

/** Save `agent` for `folder`, keeping every other worktree's. */
export async function saveAgent(orca: Orca, folder: string, agent: string): Promise<void> {
  const all = await readAll(orca).catch((): Saved => ({}));
  await orca.host.call('storage.set', { key: KEY, value: { ...all, [folder]: agent } });
}

/**
 * What a hand-off does: with no saved agent, ask with the full pick; with one saved, start it at once, unless one of
 * that kind already runs, when the pick offers just those and a new one, as the VS Code extension asks.
 */
export function handoffRoute(saved: string | undefined, running: readonly RunningAgent[]): 'pick' | 'launch' | 'runningPick' {
  if (saved === undefined) return 'pick';
  return running.some(r => r.agent === saved) ? 'runningPick' : 'launch';
}
