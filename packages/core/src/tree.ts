// The spec tree: every Spec and steering file of a snapshot, as the server returns it and `steno list --json` prints it.
import { relative, resolve, sep } from 'node:path';
import type { TasksDoc } from './types.js';
import { PROTOCOL_VERSION, type SpecTree, type TaskCounts, type TreeSpec, type TreeSteering } from './contract.js';
import type { ProjectSnapshot, SpecEntry } from './project.js';
import { isLeaf, nextTask } from './parse/tasks.js';
import { ARTIFACTS, artifactFor } from './spec.js';
import { outlineOf, taskOutline, type DocKind } from './outline.js';
import { lintEmptySections, lintPlaceholders } from './lint.js';

/** Tasks without subtasks: `total` and `done` for required ones, `optionalTotal` and `optionalDone` for optional ones. */
export function taskCounts(doc?: TasksDoc): TaskCounts {
  const out: TaskCounts = { total: 0, done: 0, optionalTotal: 0, optionalDone: 0 };
  for (const t of doc?.tasks ?? []) {
    if (!isLeaf(t)) continue;
    if (t.optional) { out.optionalTotal++; if (t.done) out.optionalDone++; } else { out.total++; if (t.done) out.done++; }
  }
  return out;
}

/**
 * Whether the document a phase is spent writing has been filled in: it has items of its kind (requirements, design
 * sections, tasks, brief headings) and no template placeholder or empty section left. A fresh skeleton is not written,
 * so a host can still offer writing it as the main action.
 */
export function isWritten(file: string, text: string | undefined): boolean {
  if (text === undefined) return false;
  return outlineOf(file.replace(/\.md$/, '') as DocKind, text).length > 0
    && !lintPlaceholders(text, file).length && !lintEmptySections(text, file).length;
}

function treeSpec(snap: ProjectSnapshot, e: SpecEntry): TreeSpec {
  const rel = (abs: string) => relative(snap.root, abs).split(sep).join('/');
  if (!('spec' in e)) return { name: e.name, [e.flag]: true, files: e.files.map(f => ({ file: rel(f.file), reason: f.reason })) };
  const { state, files, tasks } = e.spec;
  const approvals: NonNullable<TreeSpec['approvals']> = {};
  for (const [k, date] of Object.entries(state.approvals) as [keyof typeof approvals, string | undefined][])
    if (date) approvals[k] = e.derived ? null : date;
  const next = tasks ? nextTask(tasks) : undefined;
  const out: TreeSpec = { name: e.name };
  if (state.title !== undefined) out.title = state.title;
  Object.assign(out, {
    kind: state.kind, mode: state.mode, phase: state.phase, approvals,
    tasks: taskCounts(tasks), next: next ? { id: next.id, title: next.title } : null,
    documents: ARTIFACTS.filter(f => files[f] !== undefined),
    taskItems: tasks ? taskOutline(tasks, files['tasks.md'] ?? '') : [],
  });
  const current = artifactFor(state);
  if (current && isWritten(current, files[current])) out.written = true;
  return out;
}

function treeSteering(snap: ProjectSnapshot, e: ProjectSnapshot['steering'][number]): TreeSteering {
  const path = relative(snap.root, e.file).split(sep).join('/');
  if (e.unreadable !== undefined) return { path, unreadable: true, reason: e.unreadable };
  const { inclusion, pattern } = e.steering!;
  return inclusion === 'fileMatch' && pattern !== undefined ? { path, inclusion, pattern } : { path, inclusion };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The `created` date a Spec sorts by, or undefined when it has none of its own: an Unusable Spec, a derived one (its
 * date is just today's, made up on every load), or a `spec.yaml` whose `created` is missing or not a YYYY-MM-DD date.
 */
function createdOf(e: SpecEntry): string | undefined {
  if (!('spec' in e) || e.derived) return undefined;
  return DATE.test(e.spec.state.created) ? e.spec.state.created : undefined;
}

/** Newest `created` first, the same day by name; Specs with no date of their own last, by name. */
function byCreated(a: SpecEntry, b: SpecEntry): number {
  const ca = createdOf(a), cb = createdOf(b);
  if (ca !== cb) {
    if (ca === undefined) return 1;
    if (cb === undefined) return -1;
    return ca < cb ? 1 : -1;
  }
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

/** The spec tree of a snapshot; `notSetUp` is set when the snapshot is not set up, else the configured folders relative to the root. */
export function buildTree(snap: ProjectSnapshot): SpecTree {
  const tree: SpecTree = {
    protocolVersion: PROTOCOL_VERSION,
    specs: [...snap.specs].sort(byCreated).map(e => treeSpec(snap, e)),
    steering: snap.steering.map(e => treeSteering(snap, e)),
  };
  if (!snap.setUp) { tree.notSetUp = true; return tree; }
  const rel = (dir: string) => relative(snap.root, resolve(snap.root, dir)).split(sep).join('/');
  tree.specsDir = rel(snap.config.specsDir);
  tree.steeringDir = rel(snap.config.steeringDir);
  return tree;
}
