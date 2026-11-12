import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import YAML, { LineCounter, isMap, isScalar } from 'yaml';
import { configTemplate } from './templates.js';
import { diskSource, type FileSource } from './source.js';
import { StenoError } from './contract.js';

export interface Config {
  specsDir: string;
  /** Where steering files live; set to `.kiro/steering` to share them with Kiro. */
  steeringDir: string;
  ctxBudget: number;
  /** Token cap for the sum of `inclusion: always` steering files (they enter every packet). */
  steeringBudget: number;
  /** Who reviews a spec stage. default: steno's own read-only reviewers. egm: hand the packet to EGM when it is installed. */
  reviewer: 'default' | 'egm';
  agents: string[];
}
export const DEFAULT_CONFIG: Config = { specsDir: '.steno/specs', steeringDir: '.steno/steering', ctxBudget: 1500, steeringBudget: 4000, reviewer: 'default', agents: [] };

/** Walk up from `from` to the directory holding `.steno/`; fall back to `from`. */
export function findProjectRoot(from = process.cwd()): string {
  let dir = resolve(from);
  for (;;) {
    if (existsSync(join(dir, '.steno'))) return dir;
    const up = dirname(dir);
    if (up === dir) return resolve(from);
    dir = up;
  }
}

export function configPath(root: string): string { return join(root, '.steno', 'config.yaml'); }

/** A key of `.steno/config.yaml` that was ignored (`unknown-key`) or replaced by its default (`invalid-value`). */
export interface ConfigWarning { key: string; line: number; kind: 'unknown-key' | 'invalid-value'; default?: unknown }
/** The configuration as read: `unreadable` holds the reason when the file cannot be used, and `config` is then the defaults. */
export interface ConfigRead { config: Config; warnings: ConfigWarning[]; unreadable?: string }

const isPosInt = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v > 0;
const isFolder = (v: unknown) => typeof v === 'string' && v.trim() !== '';
const ACCEPTS: { [K in keyof Config]: (v: unknown) => boolean } = {
  specsDir: isFolder,
  steeringDir: isFolder,
  ctxBudget: isPosInt,
  steeringBudget: isPosInt,
  reviewer: v => v === 'default' || v === 'egm',
  agents: v => Array.isArray(v) && v.every(a => typeof a === 'string'),
};

const outside = (root: string, dir: string) => { const rel = relative(resolve(root), resolve(root, dir)); return rel.startsWith('..') || isAbsolute(rel); };

/** Read `.steno/config.yaml` without throwing. Unknown keys are ignored and bad values take their default, each with a warning. */
export function readConfig(root: string, src: FileSource = diskSource): ConfigRead {
  const config: Config = { ...DEFAULT_CONFIG, agents: [...DEFAULT_CONFIG.agents] };
  const warnings: ConfigWarning[] = [];
  const unreadable = (reason: string): ConfigRead => ({ config: { ...DEFAULT_CONFIG, agents: [] }, warnings: [], unreadable: reason });
  const r = src.read(configPath(root));
  if (!r) return { config, warnings };
  if ('error' in r) return unreadable(`.steno/config.yaml ${r.error}`);
  const lineCounter = new LineCounter();
  const doc = YAML.parseDocument(r.text, { lineCounter });
  if (doc.errors.length) return unreadable(`.steno/config.yaml is not valid YAML: ${doc.errors[0].message.split('\n')[0]}`);
  if (doc.contents == null || (isScalar(doc.contents) && doc.contents.value == null)) return { config, warnings };
  if (!isMap(doc.contents)) return unreadable('.steno/config.yaml is not a mapping');
  for (const pair of doc.contents.items) {
    const key = isScalar(pair.key) ? String(pair.key.value) : String(pair.key);
    const line = lineCounter.linePos((pair.key as { range?: [number, number, number] } | null)?.range?.[0] ?? 0).line;
    if (!Object.hasOwn(ACCEPTS, key)) { warnings.push({ key, line, kind: 'unknown-key' }); continue; }
    const k = key as keyof Config;
    const value: unknown = (pair.value as { toJSON?: () => unknown } | null)?.toJSON?.() ?? null;
    if (ACCEPTS[k](value)) (config as unknown as Record<string, unknown>)[k] = value;
    else warnings.push({ key, line, kind: 'invalid-value', default: DEFAULT_CONFIG[k] });
  }
  for (const k of ['specsDir', 'steeringDir'] as const)
    if (outside(root, config[k])) return unreadable(`.steno/config.yaml: ${k} "${config[k]}" is outside the project root`);
  return { config, warnings };
}

/** The configuration for a command. Throws `not-set-up` when the file is Unreadable; ignored keys and replaced values are silent here. */
export function loadConfig(root: string): Config {
  const r = readConfig(root);
  if (r.unreadable) throw new StenoError('not-set-up', `steno is not set up here: ${r.unreadable}`, { file: '.steno/config.yaml', reason: r.unreadable });
  return r.config;
}

/** Write only the keys given. Defaults are left out of the file so a newer steno version can change them. */
export function saveConfig(root: string, cfg: Partial<Config>): void {
  const p = configPath(root);
  mkdirSync(dirname(p), { recursive: true });
  const existing = existsSync(p) ? readFileSync(p, 'utf8') : configTemplate();
  const doc = YAML.parseDocument(existing);
  for (const [k, v] of Object.entries(cfg)) doc.set(k, v);
  writeFileSync(p, doc.toString());
}

export function specsRoot(root: string, cfg = loadConfig(root)): string { return resolve(root, cfg.specsDir); }
export function steeringRoot(root: string, cfg = loadConfig(root)): string { return resolve(root, cfg.steeringDir); }
