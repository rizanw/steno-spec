import type { TasksDoc, Task } from '../types.js';
import { normReqId } from '../ids.js';

const TASK = /^(\s*)[-*]\s+\[([ xX])\](\*?)\s+(\d+(?:\.\d+)*)\.?\s+(.*?)\s*$/;
const FOOTER = /_(Requirements|Design):\s*([^_]*)_/gi;
const TITLE = /^#\s+(.*)$/;
const CHECKPOINT = /^(?:final\s+)?checkpoint\b/i;

export function parseTasks(raw: string): TasksDoc {
  const lines = raw.split(/\r?\n/);
  const doc: TasksDoc = { title: '', tasks: [], raw };
  const byId = new Map<string, Task>();
  let last: Task | undefined;

  lines.forEach((line, idx) => {
    const ln = idx + 1;
    if (!doc.title) { const t = TITLE.exec(line); if (t) { doc.title = t[1].trim(); return; } }
    const m = TASK.exec(line);
    if (m) {
      const num = m[4];
      const id = `T${num}`;
      const parentNum = num.includes('.') ? num.slice(0, num.lastIndexOf('.')) : undefined;
      const task: Task = {
        id, num, title: m[5], done: m[2] !== ' ', optional: m[3] === '*', checkpoint: CHECKPOINT.test(m[5]),
        requirements: [], design: [], line: ln, depth: num.split('.').length - 1,
        parent: parentNum ? `T${parentNum}` : undefined, children: [],
      };
      doc.tasks.push(task);
      byId.set(id, task);
      if (task.parent) byId.get(task.parent)?.children.push(id);
      last = task;
      return;
    }
    if (!last) return;
    if (/^#{1,2}\s/.test(line)) { last = undefined; return; }
    let f: RegExpExecArray | null;
    FOOTER.lastIndex = 0;
    while ((f = FOOTER.exec(line))) {
      const refs = f[2].split(',').map(s => s.trim()).filter(Boolean);
      if (f[1].toLowerCase() === 'requirements') last.requirements.push(...refs.map(normReqId));
      else last.design.push(...refs);
    }
  });
  return doc;
}

export function findTask(doc: TasksDoc, id: string): Task | undefined {
  return doc.tasks.find(t => t.id === id);
}
export function isLeaf(t: Task): boolean { return t.children.length === 0; }

/** First not-done leaf task in document order. Optional tasks skipped unless includeOptional. */
export function nextTask(doc: TasksDoc, includeOptional = false): Task | undefined {
  return doc.tasks.find(t => isLeaf(t) && !t.done && (includeOptional || !t.optional));
}

/** True when every required leaf task is ticked. Optional tasks never block. Use this wherever "all done" is checked. */
export function allTasksDone(doc: TasksDoc): boolean { return !nextTask(doc); }

/** Return new raw text with the task's checkbox set; parents auto-complete when all children done. */
export function setTaskDone(doc: TasksDoc, id: string, done = true): string {
  const eol = doc.raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = doc.raw.split(/\r?\n/);
  const flip = (t: Task, d: boolean) => {
    lines[t.line - 1] = lines[t.line - 1].replace(/\[( |x|X)\]/, d ? '[x]' : '[ ]');
    t.done = d;
  };
  const t = findTask(doc, id);
  if (!t) throw new Error(`unknown task ${id}`);
  flip(t, done);
  // cascade down, through every level
  const down = (p: Task) => { for (const c of p.children) { const ct = findTask(doc, c); if (ct) { flip(ct, done); down(ct); } } };
  down(t);
  // cascade up
  let p = t.parent ? findTask(doc, t.parent) : undefined;
  while (p) {
    const all = p.children.every(c => findTask(doc, c)?.done);
    flip(p, done ? all : false);
    p = p.parent ? findTask(doc, p.parent) : undefined;
  }
  return lines.join(eol);
}
