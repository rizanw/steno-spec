import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import YAML from 'yaml';
import { configTemplate } from './templates.js';

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

export function loadConfig(root: string): Config {
  const p = configPath(root);
  if (!existsSync(p)) return { ...DEFAULT_CONFIG };
  const parsed = (YAML.parse(readFileSync(p, 'utf8')) ?? {}) as Partial<Config>;
  const cfg = { ...DEFAULT_CONFIG, ...parsed };
  if (cfg.reviewer !== 'egm') cfg.reviewer = 'default';   // an unknown value means steno's own reviewers
  return cfg;
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
