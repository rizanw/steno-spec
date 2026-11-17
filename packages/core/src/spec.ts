import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { Spec, SpecState } from './types.js';
import { loadState, newState, saveState, STATE_FILE } from './state.js';
import { parseRequirements } from './parse/requirements.js';
import { parseDesign } from './parse/design.js';
import { allTasksDone, parseTasks } from './parse/tasks.js';
import { specsRoot } from './config.js';
import { requirementsTemplate, bugfixTemplate, designTemplate, tasksTemplate, briefTemplate } from './templates.js';

export const ARTIFACTS = ['brief.md', 'requirements.md', 'bugfix.md', 'design.md', 'tasks.md'] as const;

export function specDir(projectRoot: string, name: string): string { return join(specsRoot(projectRoot), name); }

const SLUG = /^[a-z0-9][a-z0-9-]*$/;

/** Spec names become directory names under the specs folder, so only kebab-case slugs are allowed (no `/`, `..`, or absolute paths). */
export function assertSlug(name: string): void {
  if (!SLUG.test(name)) throw new Error(`spec name must be a kebab-case slug, got "${name}"`);
}

/** A spec folder has steno's state file, or (for a Kiro folder shared via `specsDir`) at least one spec artifact. */
export function isSpecDir(dir: string): boolean {
  return existsSync(join(dir, STATE_FILE)) || ARTIFACTS.some(f => existsSync(join(dir, f)));
}

export function listSpecs(projectRoot: string): string[] {
  const root = specsRoot(projectRoot);
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter(d => d.isDirectory() && isSpecDir(join(root, d.name)))
    .map(d => d.name).sort();
}

/** State for a spec written elsewhere (Kiro): every stage whose file exists counts as approved; the phase follows from what is there. */
export function stateFromArtifacts(name: string, dir: string): SpecState {
  const has = (f: string) => existsSync(join(dir, f));
  const state = newState(name, { kind: has('bugfix.md') ? 'bugfix' : 'feature' });
  const today = state.created;
  if (has('requirements.md') || has('bugfix.md')) state.approvals.requirements = today;
  if (has('design.md')) state.approvals.design = today;
  if (has('tasks.md')) state.approvals.tasks = today;
  const allDone = has('tasks.md') && allTasksDone(parseTasks(readFileSync(join(dir, 'tasks.md'), 'utf8')));
  state.phase = has('tasks.md') ? (allDone ? 'done' : 'execute') : has('design.md') ? 'tasks' : state.approvals.requirements ? 'design' : 'requirements';
  return state;
}

/** Load a spec. A folder with artifacts but no state file (a Kiro spec in a shared `specsDir`) gets one on first touch. */
export function loadSpec(dir: string): Spec {
  if (!existsSync(join(dir, STATE_FILE)) && isSpecDir(dir)) saveState(dir, stateFromArtifacts(basename(dir), dir));
  const state = loadState(dir);
  const files: Record<string, string> = {};
  for (const f of ARTIFACTS) { const p = join(dir, f); if (existsSync(p)) files[f] = readFileSync(p, 'utf8'); }
  const reqRaw = files[requirementsFile(state)];
  return {
    root: dir, state, files,
    requirements: reqRaw ? parseRequirements(reqRaw) : undefined,
    design: files['design.md'] ? parseDesign(files['design.md']) : undefined,
    tasks: files['tasks.md'] ? parseTasks(files['tasks.md']) : undefined,
    brief: files['brief.md'],
  };
}

export interface NewSpecOptions { title?: string; bugfix?: boolean; quick?: boolean; brief?: boolean }

/** Scaffold a spec directory. Gated mode writes only the first artifact (brief.md with --brief, else requirements.md/bugfix.md); quick mode writes all three. */
export function createSpec(projectRoot: string, name: string, opts: NewSpecOptions = {}): { dir: string; state: SpecState; written: string[] } {
  assertSlug(name);
  const dir = specDir(projectRoot, name);
  if (isSpecDir(dir)) throw new Error(`spec already exists: ${dir}`);
  mkdirSync(join(dir, 'reviews'), { recursive: true });
  const title = opts.title ?? name.replace(/-/g, ' ');
  const state = newState(name, { title, kind: opts.bugfix ? 'bugfix' : 'feature', mode: opts.quick ? 'quick' : 'gated', phase: opts.brief ? 'brief' : 'requirements' });
  if (opts.quick) state.phase = 'execute';
  const written: string[] = [];
  const put = (f: string, text: string) => { writeFileSync(join(dir, f), text); written.push(f); };
  if (opts.brief) put('brief.md', briefTemplate(title));
  else put(opts.bugfix ? 'bugfix.md' : 'requirements.md', opts.bugfix ? bugfixTemplate(title) : requirementsTemplate(title));
  if (opts.quick) { put('design.md', designTemplate(title)); put('tasks.md', tasksTemplate(title)); }
  saveState(dir, state);
  return { dir, state, written };
}

/** The file that holds a spec's requirements: `bugfix.md` for a bugfix spec, `requirements.md` otherwise. */
export function requirementsFile(state: Pick<SpecState, 'kind'>): 'bugfix.md' | 'requirements.md' {
  return state.kind === 'bugfix' ? 'bugfix.md' : 'requirements.md';
}

/** The artifact a phase is spent writing. */
export function artifactFor(state: SpecState): string | undefined {
  switch (state.phase) {
    case 'brief': return 'brief.md';
    case 'requirements': return requirementsFile(state);
    case 'design': return 'design.md';
    case 'tasks': return 'tasks.md';
    default: return undefined;
  }
}

/** Write the current phase's artifact skeleton if it is missing (called by `steno scaffold`, which the phase skill runs first). Idempotent. */
export function scaffoldCurrent(spec: Spec): string | undefined {
  const title = spec.state.title ?? spec.state.name;
  const f = artifactFor(spec.state);
  if (!f || spec.files[f]) return undefined;
  const tpl: Record<string, (t: string) => string> = { 'brief.md': briefTemplate, 'requirements.md': requirementsTemplate, 'bugfix.md': bugfixTemplate, 'design.md': designTemplate, 'tasks.md': tasksTemplate };
  writeFileSync(join(spec.root, f), tpl[f](title));
  return f;
}
