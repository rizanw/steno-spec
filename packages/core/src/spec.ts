import { existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { DesignDoc, RequirementsDoc, Spec, SpecState, TasksDoc } from './types.js';
import { loadState, newState, saveState, STATE_FILE } from './state.js';
import { parseRequirements } from './parse/requirements.js';
import { parseDesign } from './parse/design.js';
import { allTasksDone, parseTasks } from './parse/tasks.js';
import { specsRoot } from './config.js';
import { diskSource, type FileSource } from './source.js';
import { StenoError } from './contract.js';
import { requirementsTemplate, bugfixTemplate, designTemplate, tasksTemplate, briefTemplate, requestLine, withRequest } from './templates.js';

export const ARTIFACTS = ['brief.md', 'requirements.md', 'bugfix.md', 'design.md', 'tasks.md'] as const;

export function specDir(projectRoot: string, name: string): string { return join(specsRoot(projectRoot), name); }

const SLUG = /^[a-z0-9][a-z0-9-]*$/;

/** Spec names become directory names under the specs folder, so only kebab-case slugs are allowed (no `/`, `..`, or absolute paths). */
export function assertSlug(name: string): void {
  if (!SLUG.test(name)) throw new Error(`spec name must be a kebab-case slug, got "${name}"`);
}

/** A spec folder has steno's state file, or (for a Kiro folder shared via `specsDir`) at least one spec artifact. */
export function isSpecDir(dir: string, src: FileSource = diskSource): boolean {
  const names = src.list(dir);
  return names.includes(STATE_FILE) || ARTIFACTS.some(f => names.includes(f));
}

export function listSpecs(projectRoot: string): string[] {
  const root = specsRoot(projectRoot);
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter(d => d.isDirectory() && isSpecDir(join(root, d.name)))
    .map(d => d.name).sort();
}

/** State for a spec written elsewhere (Kiro): every stage whose file exists counts as approved; the phase follows from what is there. */
export function stateFromArtifacts(name: string, dir: string, src: FileSource = diskSource): SpecState {
  const names = src.list(dir);
  const has = (f: string) => names.includes(f);
  const state = newState(name, { kind: has('bugfix.md') ? 'bugfix' : 'feature' });
  const today = state.created;
  if (has('requirements.md') || has('bugfix.md')) state.approvals.requirements = today;
  if (has('design.md')) state.approvals.design = today;
  if (has('tasks.md')) state.approvals.tasks = today;
  const tasks = has('tasks.md') ? src.read(join(dir, 'tasks.md')) : undefined;
  const allDone = !!tasks && 'text' in tasks && allTasksDone(parseCached(join(dir, 'tasks.md'), tasks.text, parseTasks));
  state.phase = has('tasks.md') ? (allDone ? 'done' : 'execute') : has('design.md') ? 'tasks' : state.approvals.requirements ? 'design' : 'requirements';
  return state;
}

// Parsed documents by path; a reload reparses only files whose text changed. Parsed documents are never mutated.
const parsed = new Map<string, { text: string; doc: unknown }>();
function parseCached<T>(path: string, text: string, parse: (t: string) => T): T {
  const hit = parsed.get(path);
  if (hit && hit.text === text) return hit.doc as T;
  const doc = parse(text);
  parsed.set(path, { text, doc });
  return doc;
}

/** A spec from its state and the text of each document present (by file name). */
export function buildSpec(dir: string, state: SpecState, files: Record<string, string>): Spec {
  const reqFile = requirementsFile(state);
  const reqRaw = files[reqFile];
  return {
    root: dir, state, files,
    requirements: reqRaw ? parseCached<RequirementsDoc>(join(dir, reqFile), reqRaw, parseRequirements) : undefined,
    design: files['design.md'] ? parseCached<DesignDoc>(join(dir, 'design.md'), files['design.md'], parseDesign) : undefined,
    tasks: files['tasks.md'] ? parseCached<TasksDoc>(join(dir, 'tasks.md'), files['tasks.md'], parseTasks) : undefined,
    brief: files['brief.md'],
  };
}

/**
 * Load a spec. A folder with artifacts but no state file (a Kiro spec in a shared `specsDir`) gets one on first touch.
 * Throws `unsupported` / `unreadable` (a StenoError) when the state record or a document cannot be used.
 */
export function loadSpec(dir: string, src: FileSource = diskSource): Spec {
  if (!existsSync(join(dir, STATE_FILE)) && isSpecDir(dir, src)) saveState(dir, stateFromArtifacts(basename(dir), dir, src));
  const state = loadState(dir);
  const files: Record<string, string> = {};
  for (const f of ARTIFACTS) {
    const p = join(dir, f);
    const r = src.read(p);
    if (!r) continue;
    if ('error' in r) { const reason = `${f} ${r.error}`; throw new StenoError('unreadable', `${basename(dir)}: ${reason}`, { spec: basename(dir), file: p, reason }); }
    files[f] = r.text;
  }
  return buildSpec(dir, state, files);
}

export interface NewSpecOptions {
  title?: string; bugfix?: boolean; quick?: boolean; brief?: boolean;
  /** the user's own words on what the spec is about; written as a `> Request:` line in the first document */
  description?: string;
}

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
  // only the first document carries the request; it is what the agent writes first
  const request = requestLine(opts.description);
  if (opts.brief) put('brief.md', withRequest(briefTemplate(title), request));
  else put(opts.bugfix ? 'bugfix.md' : 'requirements.md', withRequest(opts.bugfix ? bugfixTemplate(title) : requirementsTemplate(title), request));
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
