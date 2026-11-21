// Which actions an editor offers on each spec and task row. The VS Code extension turns these lists into the
// context values its menus match on; another host can show the same actions on the same rows.
import type { OutlineItem, SpecTree, TreeSpec } from '../contract.js';
import { unusable } from './rows.js';

/** An action a host offers on a row: approve a phase, mark a task done or reopen it, or hand work to the agent. */
export type HostAction = 'approve' | 'done' | 'reopen' | 'run' | 'runNext' | 'write' | 'review';

/** The phases a gated spec can approve; `execute` and `done` have nothing left to approve. */
export const APPROVABLE: readonly string[] = ['brief', 'requirements', 'design', 'tasks'];

/** The phases in which a spec still has a document to write. */
const WRITABLE: readonly string[] = ['brief', 'requirements', 'design', 'tasks'];

/** The phases with a stage to review; `done` reviews for drift against the finished code. */
const REVIEWABLE: readonly string[] = ['requirements', 'design', 'tasks', 'done'];

/** Whether a host offers "Approve" on this spec: usable, gated, and in a phase that awaits approval. */
export function canApprove(spec: TreeSpec): boolean {
  return !unusable(spec) && spec.mode === 'gated' && spec.phase !== undefined && APPROVABLE.includes(spec.phase);
}

/** The actions a spec's row offers; a spec the server could not use offers none. */
export function specActions(spec: TreeSpec): HostAction[] {
  if (unusable(spec)) return [];
  const phase = spec.phase ?? '';
  const actions: HostAction[] = [];
  if (canApprove(spec)) actions.push('approve');
  if (WRITABLE.includes(phase)) actions.push('write');
  if (REVIEWABLE.includes(phase)) actions.push('review');
  if (phase === 'execute') actions.push('runNext');
  return actions;
}

/**
 * The actions a task's row offers. A done task can be reopened; an open one marked done, and run when it has
 * no subtasks and its spec is usable and in execute. A parent task is finished through its subtasks.
 */
export function taskActions(spec: TreeSpec, done: boolean, leaf: boolean): HostAction[] {
  if (done) return ['reopen'];
  return leaf && !unusable(spec) && spec.phase === 'execute' ? ['done', 'run'] : ['done'];
}

/** Find a task by id anywhere in the outline. */
function findTask(items: readonly OutlineItem[], id: string): OutlineItem | undefined {
  for (const item of items) {
    if (item.id === id) return item;
    const inner = findTask(item.children, id);
    if (inner) return inner;
  }
  return undefined;
}

/**
 * Whether a folder's tree offers "Run" on this task, so a run lens and the tree always agree. A spec or task the
 * tree does not know is not runnable.
 */
export function runnable(tree: SpecTree | undefined, specName: string, taskId: string): boolean {
  const spec = tree?.specs.find(s => s.name === specName);
  if (!spec || unusable(spec)) return false;
  const item = findTask(spec.taskItems ?? [], taskId);
  return item !== undefined && taskActions(spec, item.done === true, item.children.length === 0).includes('run');
}
