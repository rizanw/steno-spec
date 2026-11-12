import { statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Spec } from './types.js';
import { readConfig, type Config, type ConfigWarning } from './config.js';
import { diskSource, type FileSource } from './source.js';
import { parseState, saveState, STATE_FILE } from './state.js';
import { ARTIFACTS, buildSpec, isSpecDir, stateFromArtifacts } from './spec.js';
import { loadSteeringEntries, type SteeringEntry } from './steering.js';

/**
 * A usable Spec (`derived` when its state came from its documents because it has no `spec.yaml`), or an Unusable one
 * with each file that makes it so: `spec.yaml` first, then the documents in `ARTIFACTS` order. Paths are absolute.
 */
export type SpecEntry = { name: string; spec: Spec; derived: boolean }
  | { name: string; flag: 'unsupported' | 'unreadable'; files: { file: string; reason: string }[] };

export interface ProjectSnapshot {
  root: string;
  /** Decided from saved files only: the root holds `.steno/` and the configuration is absent or readable. */
  setUp: boolean;
  reason?: string;
  config: Config;
  configWarnings: ConfigWarning[];
  specs: SpecEntry[];
  steering: SteeringEntry[];
}

const isDir = (p: string) => { try { return statSync(p).isDirectory(); } catch { return false; } };

/** Load one spec folder on its own; an Unusable spec becomes an entry instead of an error. Never writes. */
function loadEntry(dir: string, name: string, src: FileSource): SpecEntry {
  const problems: { file: string; reason: string }[] = [];
  let flag: 'unsupported' | 'unreadable' | undefined;
  let state;
  const statePath = join(dir, STATE_FILE);
  const st = src.read(statePath);
  if (st && 'error' in st) { flag = 'unreadable'; problems.push({ file: statePath, reason: `${STATE_FILE} ${st.error}` }); }
  else if (st) {
    const r = parseState(st.text);
    if ('flag' in r) { flag = r.flag; problems.push({ file: statePath, reason: r.reason }); } else state = r.state;
  }
  const files: Record<string, string> = {};
  for (const f of ARTIFACTS) {
    const p = join(dir, f);
    const r = src.read(p);
    if (!r) continue;
    if ('error' in r) { flag ??= 'unreadable'; problems.push({ file: p, reason: `${f} ${r.error}` }); } else files[f] = r.text;
  }
  if (flag) return { name, flag, files: problems };
  if (state) return { name, spec: buildSpec(dir, state, files), derived: false };
  return { name, spec: buildSpec(dir, stateFromArtifacts(name, dir, src), files), derived: true };
}

/**
 * Load every Spec and Steering_File once, each on its own, keeping the ones steno cannot use as entries. Never throws and
 * never writes (no derived `spec.yaml`, no `.steno/cache`). Whether the project is Set_Up comes from disk whatever `src` is.
 */
export function loadProject(root: string, src: FileSource = diskSource): ProjectSnapshot {
  root = resolve(root);
  const cfg = readConfig(root, diskSource);
  const base = { root, config: cfg.config, configWarnings: cfg.warnings, specs: [], steering: [] };
  if (!isDir(join(root, '.steno'))) return { ...base, setUp: false, reason: `no .steno folder in ${root}; run steno init` };
  if (cfg.unreadable) return { ...base, setUp: false, reason: cfg.unreadable };
  const specsDir = resolve(root, cfg.config.specsDir);
  const specs = src.list(specsDir)
    .filter(n => isSpecDir(join(specsDir, n), src))
    .map(n => loadEntry(join(specsDir, n), n, src));
  const steering = loadSteeringEntries(resolve(root, cfg.config.steeringDir), src);
  return { ...base, setUp: true, specs, steering };
}

/** Write the derived `spec.yaml` of a spec entry, dating each derived approval today; the entry is then no longer derived. */
export function persistDerived(snap: ProjectSnapshot, name: string): void {
  const entry = snap.specs.find(e => e.name === name);
  if (!entry || !('spec' in entry) || !entry.derived) return;
  const today = new Date().toISOString().slice(0, 10);
  const approvals = Object.fromEntries(Object.keys(entry.spec.state.approvals).map(k => [k, today]));
  const state = { ...entry.spec.state, created: today, approvals };
  saveState(entry.spec.root, state);
  entry.spec = { ...entry.spec, state };
  entry.derived = false;
}
