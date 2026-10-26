import type { Spec } from './types.js';
import { reqOf } from './ids.js';

export interface TraceRow { req: string; title: string; criteria: number; design: string[]; tasks: string[]; tasksDone: number }

/** Traceability matrix: each requirement with its design sections and tasks. */
export function traceMatrix(spec: Spec): TraceRow[] {
  const rows: TraceRow[] = [];
  for (const r of spec.requirements?.requirements ?? []) {
    const design = (spec.design?.sections ?? []).filter(s => s.satisfies.some(x => reqOf(x) === r.id)).map(s => s.id!);
    const tasks = (spec.tasks?.tasks ?? []).filter(t => t.requirements.some(x => reqOf(x) === r.id));
    rows.push({ req: r.id, title: r.title, criteria: r.criteria.length, design, tasks: tasks.map(t => t.id), tasksDone: tasks.filter(t => t.done).length });
  }
  return rows;
}

export interface CritRow { crit: string; text: string; tasks: string[]; design: string[] }

/** Per-criterion view: which tasks and design sections claim each acceptance criterion. */
export function traceCriteria(spec: Spec): CritRow[] {
  const rows: CritRow[] = [];
  for (const r of spec.requirements?.requirements ?? []) for (const c of r.criteria) {
    const tasks = (spec.tasks?.tasks ?? []).filter(t => t.requirements.includes(c.id) || t.requirements.includes(r.id)).map(t => t.id);
    const design = (spec.design?.sections ?? []).filter(s => s.satisfies.includes(c.id) || s.satisfies.includes(r.id)).map(s => s.id!);
    rows.push({ crit: c.id, text: c.text, tasks, design });
  }
  return rows;
}
