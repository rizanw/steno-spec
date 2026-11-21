// The panel's rows, built on the server from the language server's tree. Text, icons and order come from core's
// host rules, so a spec reads the same here as in the VS Code tree; the client only draws what it gets.
import {
  canApprove, DEFAULT_SPECS_DIR, DOCUMENT_PHASE, documentRow, specActions, taskActions, instructionRow, specOrder, specRow, steeringOrder, steeringRow, taskRows, unusable,
  type Diagnostic, type RowText, type SpecTree, type TaskRow, type TreeSpec,
} from './vendor/host.mjs';
import type { Action, Row } from '../shared/contracts';

export const SPECS_KEY = 'specs';

/** The fields every row takes from core's text for it; an empty description shows nothing. */
function text(row: RowText): Pick<Row, 'label' | 'detail' | 'tooltip' | 'icon'> {
  return { label: row.label, detail: row.description || undefined, tooltip: row.tooltip, icon: row.icon };
}

/** How many errors and warnings the language server reported for one file. */
function problems(diagnostics: ReadonlyMap<string, readonly Diagnostic[]>, path: string): Row['problems'] {
  const list = diagnostics.get(path) ?? [];
  const errors = list.filter(d => d.severity === 'error').length;
  return { errors, warnings: list.length - errors };
}

/** The first of `preferred` the row offers: the one action its button runs, the rest wait in its sheet. */
function first(actions: readonly Action[], preferred: readonly Action[]): Action | undefined {
  return preferred.find(a => actions.includes(a));
}

/** A row's actions with its button: Run Task before Mark Done on a task, Approve before Open on a document. */
function act(actions: Action[], preferred: readonly Action[]): Pick<Row, 'actions' | 'primary'> {
  return { actions, primary: first(actions, preferred) };
}

/**
 * Approve sits on the document being approved, not on the spec, so the user approves with that text in view.
 * Only the document of the spec's current phase offers it, and only while core's `canApprove` holds.
 */
function documentActions(spec: TreeSpec, document: string): Action[] {
  return canApprove(spec) && DOCUMENT_PHASE[document] === spec.phase ? ['approve', 'open'] : ['open'];
}

/** A spec's tasks, each under its parent task, the top ones under the tasks document. */
function taskRowsOf(spec: TreeSpec, parent: string, depth: number, rows: readonly TaskRow[]): Row[] {
  return rows.flatMap(task => {
    const key = `task:${spec.name}/${task.id}`;
    const row: Row = {
      key, parent, depth, kind: 'task', ...text(task), target: { spec: spec.name, task: task.id },
      ...act(taskActions(spec, task.done), ['run', 'done']),
    };
    return [row, ...taskRowsOf(spec, key, depth + 1, task.children)];
  });
}

/** One spec's row and, unless the server could not use it, its documents and their tasks. */
function rowsOfSpec(tree: SpecTree, spec: TreeSpec, diagnostics: ReadonlyMap<string, readonly Diagnostic[]>): Row[] {
  const key = `spec:${spec.name}`;
  const own: Row = {
    key, parent: SPECS_KEY, depth: 1, kind: 'spec', ...text(specRow(spec)),
    // the phase names the spec's Write and Review actions, such as Write Tasks
    target: { spec: spec.name, ...(spec.phase ? { phase: spec.phase } : {}), ...(spec.written ? { written: true as const } : {}) },
    // once the phase's document is written, writing it again is rarely wanted: Review becomes the button and Write
    // waits in the sheet. A brief has no review, so a written one gets no button. A finished spec gets no button
    // either: Reopen and the drift review wait in its sheet, so a list of finished specs stays quiet. A spec with open
    // tasks is never shown as finished; core reads it as in execute, where Run Next is the button.
    ...act(specActions(spec).filter(a => a !== 'approve'), spec.written ? ['runNext', 'review'] : ['runNext', 'write']),
  };
  // core's row already carries the reason in its hover; an unusable spec has nothing below it to act on
  if (unusable(spec)) return [own];
  const dir = (tree.specsDir ?? DEFAULT_SPECS_DIR).split('/').filter(Boolean).join('/');
  return [own, ...(spec.documents ?? []).flatMap(document => {
    const path = `${dir}/${spec.name}/${document}`;
    const docKey = `doc:${spec.name}/${document}`;
    const row: Row = {
      key: docKey, parent: key, depth: 2, kind: 'document', ...text(documentRow(spec, document)),
      target: { spec: spec.name, phase: DOCUMENT_PHASE[document] }, path, problems: problems(diagnostics, path),
      ...act(documentActions(spec, document), ['approve', 'open']),
    };
    return document === 'tasks.md' ? [row, ...taskRowsOf(spec, docKey, 3, taskRows(spec))] : [row];
  })];
}

/**
 * The spec tree's rows in display order. A folder that is not a steno project gets one notice: set it up, or,
 * when `enclosing` names the steno project it lies inside, open that one instead.
 */
export function specRows(tree: SpecTree, diagnostics: ReadonlyMap<string, readonly Diagnostic[]>, enclosing?: string): Row[] {
  if (tree.notSetUp) {
    return enclosing === undefined
      ? [{ key: 'notice:not-set-up', depth: 0, kind: 'notice', label: 'This folder is not a steno project', detail: 'Set it up to write specs with your coding agent', actions: ['setUp'], primary: 'setUp' }]
      : [{ key: 'notice:inside', depth: 0, kind: 'notice', label: `Inside the steno project ${enclosing}`, detail: 'Open that project to work on its specs', actions: [] }];
  }
  const header: Row = { key: SPECS_KEY, depth: 0, kind: 'header', label: 'Specs', actions: ['newSpec'], primary: 'newSpec' };
  if (tree.specs.length === 0) {
    return [header, { key: 'notice:no-specs', parent: SPECS_KEY, depth: 1, kind: 'notice', label: 'No specs yet', detail: 'Create one to start a feature or a bugfix', actions: ['newSpec'], primary: 'newSpec' }];
  }
  return [header, ...specOrder(tree.specs).flatMap(spec => rowsOfSpec(tree, spec, diagnostics))];
}

export const STEERING_KEY = 'steering';

/**
 * The steering list's rows: the instruction files at the root, the steering files, then the instruction files
 * only one agent reads. `rootFound` and `agentFound` are the instruction files present, as workspace paths. A
 * folder that is not a steno project gets none; the spec rows already say what to do there.
 */
export function steeringRows(tree: SpecTree, rootFound: readonly string[], agentFound: readonly string[]): Row[] {
  if (tree.notSetUp) return [];
  const header: Row = { key: STEERING_KEY, depth: 0, kind: 'header', label: 'Steering', actions: ['steer'], primary: 'steer' };
  const byPath = new Map(tree.steering.map(entry => [entry.path, entry]));
  const rows = steeringOrder(tree.steering, rootFound, agentFound).map(({ kind, path }): Row => ({
    key: `${kind}:${path}`, parent: STEERING_KEY, depth: 1, kind, path, actions: ['open'], primary: 'open',
    ...text(kind === 'steering' ? steeringRow(byPath.get(path)!) : instructionRow(path)),
  }));
  if (tree.steering.length === 0) {
    rows.push({
      key: 'notice:no-steering', parent: STEERING_KEY, depth: 1, kind: 'notice', label: 'No steering files yet',
      detail: 'Steering tells your coding agent what this project is and how it is built', actions: ['steer'], primary: 'steer',
    });
  }
  return [header, ...rows];
}
