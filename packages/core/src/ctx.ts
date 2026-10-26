import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Spec, Task, DesignSection } from './types.js';
import { reqOf, CRIT_ID } from './ids.js';
import { findCriterion, findRequirement } from './parse/requirements.js';
import { findSection } from './parse/design.js';
import { findTask } from './parse/tasks.js';
import { estimateTokens } from './tokens.js';
import { loadSteering, matchingSteering } from './steering.js';

export interface CtxPacket { text: string; tokens: number; budget: number; trimmed: string[]; files: string[] }

const PATH_RE = /`([\w./-]+\/[\w./-]+\.[a-z]{1,6}|[\w-]+\.[a-z]{1,6})`/g;

/**
 * Paths mentioned in backticks. Existing files are listed as-is; a path with a directory that does not exist yet
 * is listed with a "(new)" marker, since the task is probably creating it. Bare filenames must exist to count.
 */
export function likelyFiles(projectRoot: string, ...texts: string[]): string[] {
  const out = new Set<string>();
  for (const t of texts) for (const m of t.matchAll(PATH_RE)) {
    const p = m[1];
    if (existsSync(join(projectRoot, p))) out.add(p);
    else if (p.includes('/') && !/^(https?:|\.\.)/.test(p)) out.add(`${p} (new)`);
  }
  return [...out];
}

const TEST_DIRS = ['test', 'tests', '__tests__', 'spec'];
const IS_TEST = /(?:^|\/)(?:tests?|__tests__|spec)\/|[._](?:test|spec)\.[a-z]+$|(?:^|\/)test_[^/]+$/;

/**
 * Existing test files for a source file, by the common conventions: next to it (`a.test.ts`, `a.spec.ts`, `a_test.go`,
 * `test_a.py`, `__tests__/a.test.ts`) or in a test folder beside `src/` (`test/a.test.ts`, mirrored sub-folders included).
 * A task changes behaviour and its tests together, so the packet should name both.
 */
export function testFilesFor(projectRoot: string, file: string): string[] {
  if (IS_TEST.test(file)) return [];
  const slash = file.lastIndexOf('/');
  const dir = slash < 0 ? '' : file.slice(0, slash + 1);
  const name = file.slice(slash + 1);
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return [];
  const base = name.slice(0, dot), ext = name.slice(dot);
  const names = [`${base}.test${ext}`, `${base}.spec${ext}`, `${base}_test${ext}`, `test_${base}${ext}`];
  // "packages/core/src/a/b.ts" → package "packages/core/", inner "a/"
  const src = /^((?:.*?\/)?)(?:src|lib|app)\/(.*)$/.exec(dir);
  const pkg = src ? src[1] : dir, inner = src ? src[2] : '';
  const candidates = [
    ...names.map(n => dir + n),
    ...names.map(n => `${dir}__tests__/${n}`),
    ...TEST_DIRS.flatMap(t => names.flatMap(n => [`${pkg}${t}/${inner}${n}`, `${pkg}${t}/${n}`])),
  ];
  return [...new Set(candidates)].filter(c => existsSync(join(projectRoot, c)));
}

function truncateLines(body: string, keep: number, pointer: string): { text: string; cut: boolean } {
  const lines = body.split('\n');
  if (lines.length <= keep) return { text: body, cut: false };
  if (keep <= 0) return { text: `…(${pointer})`, cut: true };
  return { text: lines.slice(0, keep).join('\n') + `\n…(${pointer})`, cut: true };
}

const FOOTER_LINE = /^\s*(?:_|\*\*)(?:Satisfies|Validates):/i;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * For a secondary section, keep only the lines that mention one of the task's criteria
 * (as `R1.5` or `1.5`), plus the first line. Falls back to the whole body when nothing matches.
 */
function filterToCriteria(body: string, critIds: string[]): string {
  if (!critIds.length) return body;
  const nums = critIds.map(id => id.replace(/^R/, ''));
  const re = new RegExp(`(?:^|[^\\w.])R?(?:${nums.map(escapeRe).join('|')})(?![\\w.])`);
  const lines = body.split('\n').filter(l => !FOOTER_LINE.test(l));   // the _Satisfies_/_Validates_ footer is already implied by the task
  const hits = lines.filter((l, i) => i === 0 || re.test(l));
  return hits.length > 1 && hits.length < lines.length ? hits.join('\n') : lines.join('\n');
}

interface Block { id: string; head: string; body: string; primary: boolean }

/**
 * Build the minimal packet an agent needs to implement one task:
 * task line + referenced criteria + glossary terms used + referenced design sections + likely files + matching steering.
 *
 * Design sections come in two tiers. Primary: the first explicit `_Design:` reference, plus any other explicit
 * reference that is not a correctness property. Secondary: properties, and sections inferred from `_Satisfies_`
 * when the task names none. Secondary sections are filtered to the task's criteria and trimmed first; the primary
 * section is cut last, so the signatures and rules an implementer needs survive the budget.
 */
export function buildCtx(spec: Spec, projectRoot: string, taskId: string, budget: number): CtxPacket {
  if (!spec.tasks) throw new Error('tasks.md does not exist yet');
  const task = findTask(spec.tasks, taskId);
  if (!task) throw new Error(`unknown task ${taskId}`);
  const parent = task.parent ? findTask(spec.tasks, task.parent) : undefined;
  const trimmed: string[] = [];

  // --- requirements slice
  const reqLines: string[] = [];
  const seenReq = new Set<string>();
  let refs = task.requirements.length ? task.requirements : parent?.requirements ?? [];
  let verifies: Task[] = [];
  if (task.checkpoint && !task.requirements.length) {
    verifies = checkpointScope(spec.tasks.tasks, task);
    refs = [...new Set(verifies.flatMap(t => t.requirements))];
  }
  const critIds: string[] = [];
  for (const ref of refs) {
    if (!spec.requirements) break;
    if (CRIT_ID.test(ref)) {
      const c = findCriterion(spec.requirements, ref);
      if (c) { reqLines.push(`${c.id} ${c.text}`); critIds.push(c.id); }
    } else {
      const r = findRequirement(spec.requirements, ref);
      if (r && !seenReq.has(r.id)) {
        seenReq.add(r.id);
        reqLines.push(`${r.id} ${r.title}${r.story ? ` — ${r.story}` : ''}`);
        for (const c of r.criteria) { reqLines.push(`  ${c.id} ${c.text}`); critIds.push(c.id); }
      }
    }
  }

  // --- glossary terms the criteria actually use (whole-word match)
  const reqText = reqLines.join('\n');
  const usedTerms = (spec.requirements?.glossary ?? []).filter(g => new RegExp(`(?<![\\w])${escapeRe(g.term)}(?![\\w])`).test(reqText));

  // --- design slice
  const explicit = task.design.length ? task.design : task.checkpoint ? [] : parent?.design ?? [];
  const isProperty = (s: DesignSection) => /^property\b/i.test(s.heading) || /^D-prop/i.test(s.id ?? '');
  const blocks: Block[] = [];
  const push = (id: string, primary: boolean) => {
    if (blocks.some(b => b.id === id)) return;
    const s = spec.design ? findSection(spec.design, id) : undefined;
    blocks.push(s ? { id, head: `### ${s.heading} {#${s.id}}`, body: s.body, primary: primary && !isProperty(s) } : { id, head: `### ${id} (not found)`, body: '', primary: false });
  };
  explicit.forEach(id => push(id, true));
  if (blocks.length && !blocks.some(b => b.primary)) blocks[0].primary = true; // a task that only names properties still gets one protected block
  if (!explicit.length && spec.design && !task.checkpoint) {
    const wanted = new Set(refs.map(reqOf));
    spec.design.sections.filter(s => s.satisfies.some(x => wanted.has(reqOf(x)))).forEach(s => push(s.id!, false));
    if (blocks.length) blocks[0].primary = true;
  }
  for (const b of blocks) if (!b.primary) b.body = filterToCriteria(b.body, critIds);

  // --- files: from the task itself and its own design sections; whole design only as a fallback
  let files = likelyFiles(projectRoot, task.title, ...blocks.map(b => b.body));
  if (!files.length) files = likelyFiles(projectRoot, spec.design?.raw ?? '').filter(f => !f.endsWith('(new)')).slice(0, 6);   // nothing task-specific: a short design-wide hint
  // tests live with the behaviour: name the existing test file of each source file, after the sources
  const tests = files.flatMap(f => testFilesFor(projectRoot, f)).filter(t => !files.includes(t));
  files = [...files, ...new Set(tests)];
  const steering = matchingSteering(loadSteering(projectRoot), files.map(f => f.replace(/ \(new\)$/, '')));

  const shortDef = (d: string) => { const m = /^(.{0,90}?[.;:])\s/.exec(d + ' '); return m ? m[1] : d.length > 90 ? d.slice(0, 87) + '…' : d; };
  const render = (primaryKeep: number, secondaryKeep: number, steerKeep: number, terms: 'full' | 'short' | 'none', filesMax: number) => {
    const parts: string[] = [];
    parts.push(`# ${task.id} ${task.title}${parent ? `\n(part of ${parent.id} ${parent.title})` : ''}`);
    const sibs = parent ? parent.children.map(c => findTask(spec.tasks!, c)!).filter(t => t.id !== task.id) : [];
    if (sibs.length) parts.push(`siblings: ${sibs.map(t => `${t.id}${t.done ? '✓' : ''}`).join(' ')}`);
    if (task.optional) parts.push('optional task');
    if (task.checkpoint) parts.push(`## Verifies\n${verifies.map(t => `${t.id} ${t.title}${t.done ? ' ✓' : ''}`).join('\n') || '(no preceding tasks found)'}\nRun the checks named in the task; every criterion below must hold end to end. Fix regressions before marking done.`);
    if (reqLines.length) parts.push(`## Requirements\n${reqText}`);
    if (usedTerms.length && terms !== 'none') parts.push(`## Terms\n${usedTerms.map(g => `${g.term}: ${terms === 'full' ? g.definition : shortDef(g.definition)}`).join('\n')}`);
    else if (usedTerms.length) { parts.push(`## Terms\n${usedTerms.map(g => g.term).join(', ')} …(steno show glossary)`); trimmed.push('glossary'); }
    if (blocks.length) {
      parts.push('## Design\n' + blocks.map(b => {
        const t = truncateLines(b.body, b.primary ? primaryKeep : secondaryKeep, `steno show ${b.id}`);
        if (t.cut) trimmed.push(b.id);
        return `${b.head}\n${t.text}`;
      }).join('\n\n'));
    }
    if (files.length) { const shown = files.slice(0, filesMax); parts.push(`## Likely files\n${shown.join('\n')}${files.length > shown.length ? `\n…+${files.length - shown.length} more (steno show ${blocks[0]?.id ?? 'design'})` : ''}`); }
    if (steering.length) {
      parts.push('## Steering\n' + steering.map(s => {
        const t = truncateLines(s.body, steerKeep, `steno show steering/${s.file}`);
        if (t.cut) trimmed.push(`steering/${s.file}`);
        return `[${s.file}]\n${t.text}`;
      }).join('\n'));
    }
    parts.push(`## When finished\nsteno done ${task.id}`);
    return parts.join('\n\n');
  };

  // Shrink lowest-value content first: steering, secondary design sections, glossary definitions, the file list, and only then the primary section.
  type Rung = [number, number, number, 'full' | 'short' | 'none', number];
  const ladder: Rung[] = [
    [80, 40, 40, 'full', 20], [80, 20, 12, 'full', 20], [80, 8, 6, 'full', 12], [80, 3, 3, 'short', 12], [80, 1, 0, 'short', 8],
    [80, 0, 0, 'none', 8], [60, 0, 0, 'none', 8], [40, 0, 0, 'none', 6], [25, 0, 0, 'none', 6], [12, 0, 0, 'none', 4], [6, 0, 0, 'none', 4],
  ];
  let text = '', tokens = 0;
  for (const [p, s, st, t, f] of ladder) {
    trimmed.length = 0;
    text = render(p, s, st, t, f); tokens = estimateTokens(text);
    if (tokens <= budget) break;
  }
  return { text, tokens, budget, trimmed: [...new Set(trimmed)], files };
}

/**
 * The tasks a checkpoint verifies: its sibling leaves that precede it, or, for a top-level checkpoint,
 * every leaf since the previous checkpoint.
 */
export function checkpointScope(all: Task[], cp: Task): Task[] {
  const leaf = (t: Task) => t.children.length === 0 && !t.checkpoint;
  const before = all.filter(t => t.line < cp.line);
  if (cp.parent) return before.filter(t => t.parent === cp.parent && leaf(t));
  const prevCp = [...before].reverse().find(t => t.checkpoint && !t.parent);
  return before.filter(t => leaf(t) && (!prevCp || t.line > prevCp.line));
}

export function describeTask(t: Task): string { return `${t.done ? '[x]' : '[ ]'}${t.optional ? '*' : ' '} ${t.id} ${t.title}`; }
