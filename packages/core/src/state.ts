import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createHash } from 'node:crypto';
import YAML from 'yaml';
import type { SpecState, Phase } from './types.js';
import { PHASES } from './types.js';
import { diskSource } from './source.js';
import { StenoError } from './contract.js';

export const STATE_FILE = 'spec.yaml';

export function newState(name: string, opts: { title?: string; kind?: 'feature' | 'bugfix'; mode?: 'gated' | 'quick'; phase?: Phase } = {}): SpecState {
  return {
    name, title: opts.title ?? name, kind: opts.kind ?? 'feature', mode: opts.mode ?? 'gated',
    phase: opts.phase ?? 'requirements', created: new Date().toISOString().slice(0, 10), approvals: {},
  };
}

/** The current on-disk Format_Version of a spec; the only one this steno accepts. A record without one is version 1. */
export const FORMAT_VERSION = 1;

/** A usable state, or why the record cannot be used. */
export type StateRead = { state: SpecState } | { flag: 'unsupported' | 'unreadable'; reason: string };

const quote = (v: unknown) => (typeof v === 'number' ? String(v) : JSON.stringify(v) ?? String(v));
const isMapping = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const KINDS = ['feature', 'bugfix'] as const;
const MODES = ['gated', 'quick'] as const;

/** Turn the text of `spec.yaml` into a state. `formatVersion` is judged before any other key. */
export function parseState(text: string): StateRead {
  let raw: unknown;
  try { raw = YAML.parse(text); } catch (e) {
    return { flag: 'unreadable', reason: `spec.yaml is not valid YAML: ${(e as Error).message.split('\n')[0]}` };
  }
  if (!isMapping(raw)) return { flag: 'unreadable', reason: 'spec.yaml is not a mapping' };
  if (Object.hasOwn(raw, 'formatVersion') && raw.formatVersion !== FORMAT_VERSION) {
    const v = raw.formatVersion;
    return { flag: 'unsupported', reason: typeof v === 'number' && Number.isInteger(v) && v > FORMAT_VERSION
      ? `format version ${v} is newer than this steno understands; update steno`
      : `format version ${quote(v)} is not valid` };
  }
  const bad = (reason: string): StateRead => ({ flag: 'unreadable', reason: `spec.yaml ${reason}` });
  const oneOf = (key: string, allowed: readonly string[]) => {
    if (!Object.hasOwn(raw, key)) return `is missing the required key ${key}`;
    const v = (raw as Record<string, unknown>)[key];
    return allowed.includes(v as string) ? undefined : `has ${key} ${quote(v)}; expected ${allowed.join(', ')}`;
  };
  if (!Object.hasOwn(raw, 'name')) return bad('is missing the required key name');
  if (typeof raw.name !== 'string' || raw.name.trim() === '') return bad(`has name ${quote(raw.name)}; expected a non-empty string`);
  for (const [key, allowed] of [['kind', KINDS], ['mode', MODES], ['phase', PHASES]] as const) {
    const err = oneOf(key, allowed);
    if (err) return bad(err);
  }
  const approvals: SpecState['approvals'] = {};
  if (isMapping(raw.approvals))
    for (const k of ['requirements', 'design', 'tasks'] as const) { const v = raw.approvals[k]; if (v != null) approvals[k] = String(v); }
  const state: SpecState = {
    name: raw.name, kind: raw.kind as SpecState['kind'], mode: raw.mode as SpecState['mode'], phase: raw.phase as Phase,
    created: raw.created == null ? '' : String(raw.created), approvals,
  };
  if (typeof raw.title === 'string') state.title = raw.title;
  if (Object.hasOwn(raw, 'formatVersion')) state.formatVersion = FORMAT_VERSION;
  return { state }; // the old `seen` key and unknown keys are dropped
}

/** Load a spec's state. Throws when the record is missing, or `unsupported` / `unreadable` (a StenoError) when it cannot be used. */
export function loadState(specDir: string): SpecState {
  const p = join(specDir, STATE_FILE);
  const r = diskSource.read(p);
  if (!r) throw new Error(`not a steno spec (missing ${STATE_FILE}): ${specDir}`);
  const spec = basename(specDir);
  const read = 'error' in r ? { flag: 'unreadable' as const, reason: `${STATE_FILE} ${r.error}` } : parseState(r.text);
  if ('flag' in read) throw new StenoError(read.flag, `${spec}: ${read.reason}`, { spec, file: p, reason: read.reason });
  return read.state;
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
