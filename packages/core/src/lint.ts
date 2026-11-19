import type { Spec, LintIssue, RequirementsDoc, DesignDoc, TasksDoc } from './types.js';
import { reqOf, CRIT_ID, REQ_ID } from './ids.js';
import { isLeaf } from './parse/tasks.js';
import { requirementsFile } from './spec.js';

const VAGUE = ['fast', 'quick', 'quickly', 'easy', 'easily', 'user-friendly', 'intuitive', 'appropriate', 'robust', 'efficient', 'seamless', 'etc', 'as needed', 'properly'];
/** True when some VAGUE word stands on its own, as the per-word check below reads it; one scan skips that check for most criteria. */
const ANY_VAGUE = new RegExp(`(?<= )(?:${VAGUE.join('|')})(?=[ ,.])`);
const EARS_START = /^(WHEN|IF|WHILE|WHERE|THE\b|THE SYSTEM)/i;
const MAX_WORDS = 35;
/** Above these a requirements document usually holds more than one deliverable, or cases that belong in design. */
const MAX_CRITERIA = 60, MAX_CRITERIA_PER_REQ = 12;
/** Backticked code spans that look like implementation details: paths, file extensions, calls, camelCase identifiers, JSX, CSS classes. */
const CODE_SPAN = /`([^`\n]+)`/g;
const IMPL_SMELL = /\/|\.(?:tsx?|jsx?|css|py|go|rs|kt|java)\b|\(|<[A-Z]|[a-z]+[A-Z][A-Za-z]|^[.#][a-z-]+$/;
/** The same patterns outside backticks: paths with a slash or source extension, calls like foo(), camelCase identifiers. Glossary Term_Names are excluded. */
const BARE_IMPL = /(?:^|[\s("'])((?:[a-z0-9_.-]+\/)+[a-z0-9_.-]+\.[a-z]{1,4}\b|(?:[a-z0-9_-]+\/){2,}[a-z0-9_-]+|[\w-]+\.(?:tsx?|jsx?|css|py|go|rs|kt|java)\b|[a-z][A-Za-z0-9]*\(\)|\b[a-z]+(?:[A-Z][a-z0-9]+)+\b)/g;

/** The requirement and criterion IDs of a requirements document, for lookups by ID. */
function reqIds(doc: RequirementsDoc): { reqs: Set<string>; crits: Set<string> } {
  return { reqs: new Set(doc.requirements.map(r => r.id)), crits: new Set(doc.requirements.flatMap(r => r.criteria.map(c => c.id))) };
}

export function lintRequirements(doc: RequirementsDoc, file = 'requirements.md'): LintIssue[] {
  const out: LintIssue[] = [];
  if (doc.requirements.length === 0) out.push({ level: 'error', rule: 'req/empty', file, msg: 'no requirements found (expected "### Requirement 1: Title" headings)' });
  const total = doc.requirements.reduce((n, r) => n + r.criteria.length, 0);
  if (total > MAX_CRITERIA) out.push({ level: 'warn', rule: 'req/too-large', file, msg: `${total} criteria in one spec: it probably holds more than one deliverable; split it or cut what nothing needs yet (max ${MAX_CRITERIA})` });
  const terms = doc.glossary.map(g => g.term);
  const seen = new Set<string>();
  for (const r of doc.requirements) {
    if (seen.has(r.id)) out.push({ level: 'error', rule: 'req/dup-id', file, line: r.line, id: r.id, msg: `duplicate id ${r.id}` });
    seen.add(r.id);
    if (!r.title) out.push({ level: 'warn', rule: 'req/title', file, line: r.line, id: r.id, msg: 'requirement has no title' });
    if (!r.story) out.push({ level: 'warn', rule: 'req/story', file, line: r.line, id: r.id, msg: 'missing **User Story:** line' });
    if (r.criteria.length === 0) out.push({ level: 'error', rule: 'req/no-criteria', file, line: r.line, id: r.id, msg: 'no acceptance criteria' });
    if (r.criteria.length > MAX_CRITERIA_PER_REQ) out.push({ level: 'warn', rule: 'req/too-many-criteria', file, line: r.line, id: r.id, msg: `${r.criteria.length} criteria: split the requirement, or move cases to design or Non-goals (max ${MAX_CRITERIA_PER_REQ})` });
    for (const c of r.criteria) {
      if (!/\bSHALL\b/.test(c.text)) {
        if (/\bshall\b/.test(c.text)) out.push({ level: 'warn', rule: 'ears/shall-case', file, line: c.line, id: c.id, msg: 'write SHALL in capitals' });
        else out.push({ level: 'error', rule: 'ears/shall', file, line: c.line, id: c.id, msg: 'acceptance criterion needs a SHALL clause' });
      }
      if (!EARS_START.test(c.text)) out.push({ level: 'warn', rule: 'ears/pattern', file, line: c.line, id: c.id, msg: 'start with WHEN / IF / WHILE / WHERE / THE system (EARS)' });
      if ((c.text.match(/\bSHALL\b/g) ?? []).length > 1) out.push({ level: 'warn', rule: 'ears/split', file, line: c.line, id: c.id, msg: 'more than one SHALL: split into separate criteria' });
      for (const w of c.text.match(/\b[A-Z][a-z]+(?:_[A-Z][a-z]+)+\b/g) ?? []) if (terms.length && !terms.includes(w)) out.push({ level: 'warn', rule: 'ears/undefined-term', file, line: c.line, id: c.id, msg: `${w} is not in the Glossary` });
      const words = c.text.trim().split(/\s+/).length;
      if (words > MAX_WORDS) out.push({ level: 'warn', rule: 'ears/too-long', file, line: c.line, id: c.id, msg: `${words} words: split it or drop detail that belongs in design (max ${MAX_WORDS})` });
      const bare = [...c.text.replace(CODE_SPAN, ' ').matchAll(BARE_IMPL)].map(m => m[1]);
      const impl = [...new Set([...[...c.text.matchAll(CODE_SPAN)].map(m => m[1]).filter(x => IMPL_SMELL.test(x)), ...bare])].slice(0, 3);
      if (impl.length) out.push({ level: 'warn', rule: 'ears/implementation', file, line: c.line, id: c.id, msg: `implementation detail in a requirement (${impl.join(', ')}) — say what the user sees; put the how in design.md` });
      const low = ` ${c.text.toLowerCase()} `;
      const vague = ANY_VAGUE.test(low) ? VAGUE.filter(v => low.includes(` ${v} `) || low.includes(` ${v},`) || low.includes(` ${v}.`)) : [];
      if (vague.length) out.push({ level: 'warn', rule: 'ears/vague', file, line: c.line, id: c.id, msg: `vague wording: ${vague.join(', ')} — make it testable` });
    }
  }
  return out;
}

export function lintDesign(doc: DesignDoc, reqs?: RequirementsDoc, file = 'design.md'): LintIssue[] {
  const out: LintIssue[] = [];
  if (doc.sections.length === 0) out.push({ level: 'error', rule: 'design/empty', file, msg: 'no sections found' });
  const ids = new Set<string>(), known = reqs && reqIds(reqs);
  for (const s of doc.sections) {
    if (ids.has(s.id!)) out.push({ level: 'error', rule: 'design/dup-id', file, line: s.line, id: s.id, msg: `duplicate id ${s.id}` });
    ids.add(s.id!);
    if (known) for (const ref of s.satisfies) {
      const ok = CRIT_ID.test(ref) ? known.crits.has(ref) : REQ_ID.test(ref) && known.reqs.has(ref);
      if (!ok) out.push({ level: 'error', rule: 'design/unknown-req', file, line: s.line, id: s.id, msg: `_Satisfies_ references unknown ${ref}` });
    }
  }
  const MAX_PER_SECTION = 6, MAX_SECTIONS_PER_CRIT = 3;
  const NO_FOOTER = /^(overview|testing strategy|open questions)$/i;
  const byCrit = new Map<string, string[]>();
  for (const s of doc.sections) {
    if (s.satisfies.length > MAX_PER_SECTION) out.push({ level: 'warn', rule: 'design/over-tagged', file, line: s.line, id: s.id, msg: `claims ${s.satisfies.length} criteria; tag only what this section implements (max ${MAX_PER_SECTION}) or split it` });
    if (s.satisfies.length && NO_FOOTER.test(s.heading)) out.push({ level: 'warn', rule: 'design/footer-on-overview', file, line: s.line, id: s.id, msg: `"${s.heading}" should not carry a _Satisfies_ footer; put traceability on the implementing sections` });
    for (const ref of s.satisfies) byCrit.set(ref, [...(byCrit.get(ref) ?? []), s.id!]);
  }
  for (const [ref, secs] of byCrit) if (secs.length > MAX_SECTIONS_PER_CRIT) out.push({ level: 'warn', rule: 'design/overlap', file, id: ref, msg: `${ref} is claimed by ${secs.length} sections (${secs.join(', ')}); keep it on the one or two that implement it` });
  if (reqs) {
    const covered = new Set(doc.sections.flatMap(s => s.satisfies.map(reqOf)));
    for (const r of reqs.requirements) if (!covered.has(r.id)) out.push({ level: 'warn', rule: 'design/uncovered-req', file, id: r.id, msg: `${r.id} "${r.title}" is not satisfied by any design section (_Satisfies: ${r.id}_)` });
  }
  return out;
}

export function lintTasks(doc: TasksDoc, reqs?: RequirementsDoc, design?: DesignDoc, file = 'tasks.md'): LintIssue[] {
  const out: LintIssue[] = [];
  if (doc.tasks.length === 0) out.push({ level: 'error', rule: 'tasks/empty', file, msg: 'no tasks found (expected "- [ ] 1. Title")' });
  const ids = new Set<string>(), all = new Set(doc.tasks.map(t => t.id));
  const known = reqs && reqIds(reqs), sections = design && new Set(design.sections.map(s => s.id));
  for (const t of doc.tasks) {
    if (ids.has(t.id)) out.push({ level: 'error', rule: 'tasks/dup-id', file, line: t.line, id: t.id, msg: `duplicate task number ${t.num}` });
    ids.add(t.id);
    if (t.parent && !all.has(t.parent)) out.push({ level: 'error', rule: 'tasks/orphan', file, line: t.line, id: t.id, msg: `parent ${t.parent} does not exist` });
    if (isLeaf(t) && !t.checkpoint && t.requirements.length === 0) out.push({ level: 'warn', rule: 'tasks/no-req', file, line: t.line, id: t.id, msg: 'leaf task has no _Requirements: R?_ footer' });
    if (known) for (const ref of t.requirements) {
      const ok = CRIT_ID.test(ref) ? known.crits.has(ref) : known.reqs.has(ref);
      if (!ok) out.push({ level: 'error', rule: 'tasks/unknown-req', file, line: t.line, id: t.id, msg: `references unknown ${ref}` });
    }
    if (sections) for (const ref of t.design) {
      if (!sections.has(ref)) out.push({ level: 'error', rule: 'tasks/unknown-design', file, line: t.line, id: t.id, msg: `references unknown design section ${ref}` });
    }
  }
  if (reqs) {
    const covered = new Set(doc.tasks.flatMap(t => t.requirements.map(reqOf)));
    for (const r of reqs.requirements) if (!covered.has(r.id)) out.push({ level: 'warn', rule: 'tasks/uncovered-req', file, id: r.id, msg: `${r.id} "${r.title}" has no task` });
  }
  return out;
}

/**
 * Angle-bracket placeholders left over from a steno template (`<short name>`, `THE <Component> SHALL`).
 * Fenced code and common HTML tags are ignored, and so is `<…>` glued to an identifier (`Record<Kind, number>`,
 * `Promise<void>`): that is a generic type, and no template puts a placeholder directly after a word character.
 */
const PLACEHOLDER = /<([A-Za-z0-9][^<>\n]*)>/g;
const HTML_TAG = /^(br|b|i|em|strong|code|sub|sup|hr|p)\/?$/i;
export function lintPlaceholders(text: string, file: string): LintIssue[] {
  const lines: number[] = [];
  let fenced = false;
  text.split(/\r?\n/).forEach((ln, i) => {
    if (/^\s*```/.test(ln)) { fenced = !fenced; return; }
    if (fenced) return;
    for (const m of ln.matchAll(PLACEHOLDER)) if (!HTML_TAG.test(m[1]) && !/\w/.test(ln[m.index - 1] ?? '')) { lines.push(i + 1); break; }
  });
  if (!lines.length) return [];
  const shown = lines.slice(0, 5).join(', ') + (lines.length > 5 ? ', …' : '');
  return [{ level: 'error', rule: 'spec/placeholder', file, line: lines[0], msg: `${lines.length} template placeholder line${lines.length > 1 ? 's' : ''} left (${shown}) — ${file} is still the skeleton; replace every <…>` }];
}

/**
 * A `##`–`####` heading with nothing under it: no text and no deeper heading before the next heading of the same or a
 * higher level. Usually a template section that was never filled, or a list whose entries were all settled and deleted.
 */
export function lintEmptySections(text: string, file: string): LintIssue[] {
  const out: LintIssue[] = [];
  let fenced = false, open: { level: number; heading: string; line: number } | undefined;
  const close = (level: number) => {
    if (open && level <= open.level) out.push({ level: 'warn', rule: 'spec/empty-section', file, line: open.line, msg: `section "${open.heading}" is empty; fill it or delete the heading` });
    open = undefined;
  };
  text.split(/\r?\n/).forEach((ln, i) => {
    if (/^\s*```/.test(ln)) fenced = !fenced;
    const m = fenced ? null : /^(#{1,4})\s+(.*?)(?:\s*\{#[\w-]+\})?\s*$/.exec(ln);
    if (!m) { if (ln.trim()) open = undefined; return; }
    close(m[1].length);
    if (m[1].length > 1) open = { level: m[1].length, heading: m[2], line: i + 1 };
  });
  close(0);
  return out;
}

/** The `spec/missing` error for a stage; the requirements stage names the spec's own requirements file. */
function missingIssue(spec: Spec, stage: 'requirements' | 'design' | 'tasks'): LintIssue {
  const file = stage === 'requirements' ? requirementsFile(spec.state) : `${stage}.md`;
  return { level: 'error', rule: 'spec/missing', file, msg: `${file} does not exist` };
}

// The full lint of each spec folder, with what it was computed from: a server reload relints only the specs whose
// state, texts or parsed documents changed. Lint reads nothing else; the loader keeps a parsed document while its text stays.
type Docs = [Spec['requirements'], Spec['design'], Spec['tasks']];
const linted = new Map<string, { state: string; files: Record<string, string>; docs: Docs; issues: LintIssue[] }>();
const sameFiles = (a: Record<string, string>, b: Record<string, string>) => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(k => a[k] === b[k]);
};

/** The lint findings of a spec, for one stage when `only` is given. */
export function lintSpec(spec: Spec, only?: 'requirements' | 'design' | 'tasks'): LintIssue[] {
  if (only) return lintSpecNow(spec, only);
  const state = JSON.stringify(spec.state);
  const docs: Docs = [spec.requirements, spec.design, spec.tasks];
  const hit = linted.get(spec.root);
  if (hit && hit.state === state && hit.docs.every((d, i) => d === docs[i]) && sameFiles(hit.files, spec.files)) return hit.issues.map(i => ({ ...i }));
  const issues = lintSpecNow(spec);
  linted.set(spec.root, { state, files: { ...spec.files }, docs, issues });
  return issues.map(i => ({ ...i }));
}

function lintSpecNow(spec: Spec, only?: 'requirements' | 'design' | 'tasks'): LintIssue[] {
  const out: LintIssue[] = [];
  const reqFile = requirementsFile(spec.state);
  const STAGE_FILES: Record<string, string> = { requirements: reqFile, design: 'design.md', tasks: 'tasks.md' };
  for (const [stage, f] of Object.entries(STAGE_FILES)) if ((!only || only === stage) && spec.files[f]) out.push(...lintPlaceholders(spec.files[f], f));
  for (const [stage, f] of Object.entries(STAGE_FILES)) if ((!only || only === stage) && spec.files[f]) out.push(...lintEmptySections(spec.files[f], f));
  if ((!only || only === 'requirements') && spec.requirements) out.push(...lintRequirements(spec.requirements, reqFile));
  if ((!only || only === 'design') && spec.design) out.push(...lintDesign(spec.design, spec.requirements));
  if ((!only || only === 'tasks') && spec.tasks) out.push(...lintTasks(spec.tasks, spec.requirements, spec.design));
  if (only && !spec[only]) out.push(missingIssue(spec, only));
  if (!only && spec.state.phase !== 'brief' && !spec.requirements) out.push(missingIssue(spec, 'requirements'));
  return out;
}

export function hasErrors(issues: LintIssue[]): boolean { return issues.some(i => i.level === 'error'); }
