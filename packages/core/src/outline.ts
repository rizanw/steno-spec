// The nested outline of one document, built from its text (requirements, criteria, design sections, tasks, headings).
import type { OutlineItem } from './contract.js';
import { parseRequirements } from './parse/requirements.js';
import { parseDesign } from './parse/design.js';
import { parseTasks } from './parse/tasks.js';

export type DocKind = 'requirements' | 'bugfix' | 'design' | 'tasks' | 'brief' | 'steering';

const MAX_TITLE = 80;

/** The title when there is one; otherwise the first line of `text`, cut to 79 characters and an ellipsis when longer than 80. */
export function itemTitle(title: string, text: string): string {
  if (title) return title;
  const first = Array.from(text.split(/\r?\n/)[0] ?? '');
  return first.length > MAX_TITLE ? first.slice(0, MAX_TITLE - 1).join('') + '…' : first.join('');
}

/** Headings of level `min` to `max` outside fenced code, nested by level; each runs to the line before the next heading of the same or a higher level. */
function headingItems(text: string, min: number, max: number): OutlineItem[] {
  const lines = text.split(/\r?\n/);
  const roots: OutlineItem[] = [];
  const open: { level: number; item: OutlineItem }[] = [];
  const close = (level: number, end: number) => { while (open.length && open[open.length - 1].level >= level) open.pop()!.item.endLine = end; };
  let fenced = false;
  lines.forEach((ln, i) => {
    if (/^\s*```/.test(ln)) { fenced = !fenced; return; }
    const m = fenced ? null : /^(#{1,6})\s+(.*?)\s*$/.exec(ln);
    if (!m) return;
    const level = m[1].length;
    close(level, i);
    if (level < min || level > max) return;
    const item: OutlineItem = { kind: 'heading', title: itemTitle(m[2], ln), line: i + 1, endLine: i + 1, children: [] };
    (open.length ? open[open.length - 1].item.children : roots).push(item);
    open.push({ level, item });
  });
  close(0, lines.length);
  return roots;
}

function requirementItems(text: string): OutlineItem[] {
  return parseRequirements(text).requirements.map(r => ({
    kind: 'requirement' as const, id: r.id, title: itemTitle(r.title, r.story ?? r.criteria[0]?.text ?? r.id),
    line: r.line, endLine: r.endLine,
    children: r.criteria.map((c, i) => ({
      kind: 'criterion' as const, id: c.id, title: itemTitle('', c.text),
      line: c.line, endLine: i + 1 < r.criteria.length ? r.criteria[i + 1].line - 1 : r.endLine, children: [],
    })),
  }));
}

/** A bugfix document: its requirements, plus each level-2 heading whose section holds no requirement. */
function bugfixItems(text: string): OutlineItem[] {
  const reqs = requirementItems(text);
  const free = headingItems(text, 2, 2).filter(h => !reqs.some(r => r.line >= h.line && r.line <= h.endLine));
  return [...reqs, ...free].sort((a, b) => a.line - b.line);
}

function designItems(text: string): OutlineItem[] {
  const roots: OutlineItem[] = [];
  const open: { level: number; item: OutlineItem }[] = [];
  for (const s of parseDesign(text).sections) {
    if (s.level < 2 || s.level > 4) continue;
    while (open.length && open[open.length - 1].level >= s.level) open.pop();
    const item: OutlineItem = { kind: 'section', id: s.id, title: itemTitle(s.heading, s.body), line: s.line, endLine: s.endLine, children: [] };
    (open.length ? open[open.length - 1].item.children : roots).push(item);
    open.push({ level: s.level, item });
  }
  return roots;
}

/**
 * Tasks nested under their parent only when the parent comes first and every task between them is nested under it too;
 * any other task is top-level. A task runs to the line before the next task not nested under it, or the end.
 */
function taskItems(text: string): OutlineItem[] {
  const lines = text.split(/\r?\n/);
  const roots: OutlineItem[] = [];
  const path: { id: string; item: OutlineItem }[] = [];   // the chain from a root to the last task
  for (const t of parseTasks(text).tasks) {
    let at = -1;
    if (t.parent) for (let i = path.length - 1; i >= 0; i--) if (path[i].id === t.parent) { at = i; break; }
    while (path.length > at + 1) path.pop()!.item.endLine = t.line - 1;
    const item: OutlineItem = { kind: 'task', id: t.id, title: itemTitle(t.title, lines[t.line - 1].trim()), line: t.line, endLine: t.line, children: [] };
    (at >= 0 ? path[at].item.children : roots).push(item);
    path.push({ id: t.id, item });
  }
  for (const p of path) p.item.endLine = lines.length;
  return roots;
}

/** The Outline items of a document of `kind`, in line order. */
export function outlineOf(kind: DocKind, text: string): OutlineItem[] {
  switch (kind) {
    case 'requirements': return requirementItems(text);
    case 'bugfix': return bugfixItems(text);
    case 'design': return designItems(text);
    case 'tasks': return taskItems(text);
    case 'brief': case 'steering': return headingItems(text, 2, 3);
  }
}
