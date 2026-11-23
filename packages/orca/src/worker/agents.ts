// The coding agents a hand-off can start. steno names agents by the keys `steno init` uses; Orca's `agent.launch`
// takes its own ids. Orca offers no call that lists the agents it can start, so this map is kept by hand against
// the ids in Orca's host types: an agent steno knows and Orca cannot start is left out, never offered and failing.
import { AGENTS } from '@steno/core';

const ORCA_IDS: Record<string, string> = {
  codex: 'codex', opencode: 'opencode', antigravity: 'antigravity', claude: 'claude',
  cursor: 'cursor', copilot: 'copilot', gemini: 'gemini', kiro: 'kiro',
};

/** The Orca id that starts the agent steno calls `key`, if Orca can start it. */
export const orcaAgent = (key: string): string | undefined => ORCA_IDS[key];

/** The steno key of the agent Orca calls `id`, so a running agent gets its skill call worded as it takes one. */
export const stenoAgent = (id: string): string | undefined => Object.keys(ORCA_IDS).find(key => ORCA_IDS[key] === id);

/** The steno agent keys a hand-off offers, in steno's own order. */
export const launchable = (): string[] => AGENTS.map(a => a.key).filter(key => orcaAgent(key) !== undefined);
