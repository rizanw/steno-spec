import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import YAML from 'yaml';
import type { SpecState, Phase } from './types.js';
import { PHASES } from './types.js';

export const STATE_FILE = 'spec.yaml';

export function newState(name: string, opts: { title?: string; kind?: 'feature' | 'bugfix'; mode?: 'gated' | 'quick'; phase?: Phase } = {}): SpecState {
  return {
    name, title: opts.title ?? name, kind: opts.kind ?? 'feature', mode: opts.mode ?? 'gated',
    phase: opts.phase ?? 'requirements', created: new Date().toISOString().slice(0, 10), approvals: {},
  };
}

export function loadState(specDir: string): SpecState {
  const p = join(specDir, STATE_FILE);
  if (!existsSync(p)) throw new Error(`not a steno spec (missing ${STATE_FILE}): ${specDir}`);
  const s = YAML.parse(readFileSync(p, 'utf8')) as SpecState;
  s.approvals ??= {};
  delete (s as { seen?: unknown }).seen; // older versions kept file hashes here; they now live in the local cache
  return s;
}

export function saveState(specDir: string, s: SpecState): void {
  writeFileSync(join(specDir, STATE_FILE), `# machine-owned by steno; edit phase/approvals only via the CLI\n${YAML.stringify(s)}`);
}

export function sha(text: string): string { return createHash('sha1').update(text).digest('hex').slice(0, 10); }

export function nextPhase(p: Phase): Phase { return PHASES[Math.min(PHASES.indexOf(p) + 1, PHASES.length - 1)]; }

/** Phase the spec should be in given its approvals. */
export function derivePhase(s: SpecState, allTasksDone: boolean): Phase {
  if (s.mode === 'quick') return allTasksDone ? 'done' : 'execute';
  if (!s.approvals.requirements) return 'requirements';
  if (!s.approvals.design) return 'design';
  if (!s.approvals.tasks) return 'tasks';
  return allTasksDone ? 'done' : 'execute';
}

/** Why `phase` cannot be approved now, or undefined if it can. Only the current stage can be approved, so stages are never skipped. */
export function approvalError(s: SpecState, phase: string): string | undefined {
  if (s.mode === 'quick') return `${s.name} is a quick spec; it has no approval gates`;
  if (phase !== s.phase) return `${s.name} is in phase ${s.phase}; only ${s.phase} can be approved now (got ${phase})`;
  return undefined;
}

/** Call after a task is ticked or unticked: moves the phase between execute and done to match the tasks. Returns true if the phase changed. */
export function syncDonePhase(s: SpecState, allTasksDone: boolean): boolean {
  const to = s.phase === 'execute' && allTasksDone ? 'done' : s.phase === 'done' && !allTasksDone ? 'execute' : s.phase;
  if (to === s.phase) return false;
  s.phase = to;
  return true;
}

// File hashes for "changed since last status" are per-person, so they live in a local cache, not in the committed spec.yaml.
const seenPath = (root: string) => join(root, '.steno', 'cache', 'seen.json');
type SeenCache = Record<string, Record<string, string>>;

function readSeenCache(root: string): SeenCache {
  try { return JSON.parse(readFileSync(seenPath(root), 'utf8')) as SeenCache; } catch { return {}; }
}

export function loadSeen(root: string, spec: string): Record<string, string> { return readSeenCache(root)[spec] ?? {}; }

export function saveSeen(root: string, spec: string, seen: Record<string, string>): void {
  const dir = join(root, '.steno', 'cache');
  mkdirSync(dir, { recursive: true });
  if (!existsSync(join(dir, '.gitignore'))) writeFileSync(join(dir, '.gitignore'), '# local steno cache; never committed\n*\n');
  writeFileSync(seenPath(root), JSON.stringify({ ...readSeenCache(root), [spec]: seen }, null, 2) + '\n');
}
