import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { saveState } from './state.js';
import { assertSlug, isSpecDir, loadSpec, specDir, stateFromArtifacts } from './spec.js';
import { lintSpec } from './lint.js';

/** Convert Kiro's `### Requirement 1: Title` headings to `## R1 Title`, and `#### Acceptance Criteria` to `###`. */
export function normalizeKiroRequirements(raw: string): string {
  return raw
    .replace(/^###\s+Requirement\s+(\d+)\s*(?:[:\-–]\s*(.*?))?\s*$/gim, (_m, n, t) => `## R${n} ${(t ?? '').trim()}`.trimEnd())
    .replace(/^####\s+Acceptance Criteria\s*$/gim, '### Acceptance Criteria');
}

/** Kiro tasks reference `_Requirements: 1.1, 2_`, so add the R prefix. The checkbox syntax is the same. */
export function normalizeKiroTasks(raw: string): string {
  return raw.replace(/_Requirements:\s*([^_]*)_/gi, (_m, refs: string) =>
    `_Requirements: ${refs.split(',').map(s => s.trim()).filter(Boolean).map(s => (/^\d/.test(s) ? `R${s}` : s)).join(', ')}_`);
}

export function importKiroSpec(projectRoot: string, from: string, name = basename(from)): { dir: string; files: string[]; issues: number } {
  if (!existsSync(from)) throw new Error(`no such directory: ${from}`);
  try { assertSlug(name); } catch (e) { throw new Error(`${(e as Error).message}; pass a slug: steno import <dir> <slug>`); }
  const dir = specDir(projectRoot, name);
  if (isSpecDir(dir)) throw new Error(`spec already exists: ${dir}`);
  mkdirSync(join(dir, 'reviews'), { recursive: true });
  const files: string[] = [];
  for (const f of readdirSync(from)) {
    if (!f.endsWith('.md')) continue;
    let text = readFileSync(join(from, f), 'utf8');
    if (f === 'requirements.md' || f === 'bugfix.md') text = normalizeKiroRequirements(text);
    if (f === 'tasks.md') text = normalizeKiroTasks(text);
    writeFileSync(join(dir, f), text); files.push(f);
  }
  saveState(dir, stateFromArtifacts(name, dir));
  return { dir, files, issues: lintSpec(loadSpec(dir)).length };
}
