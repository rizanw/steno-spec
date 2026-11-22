// Every row a panel draws for one folder, as plain data: its text and icon from the row rules, its actions and the
// one its main button runs. Paseo's panel draws these as they are; another host can draw the same rows the same way.
import type { Diagnostic, SpecTree, TreeSpec } from '../contract.js';
import { canApproveDocument, specActions, taskActions, type HostAction } from './actions.js';
import type { InstructionFiles } from './instructions.js';
import { documentPath } from './paths.js';
import {
  DOCUMENT_PHASE, documentRow, instructionRow, specOrder, specRow, steeringOrder, steeringRow, taskRows, unusable,
  type RowIcon, type RowText, type TaskRow,
} from './rows.js';

/** Core's spec and task actions, then the panel's own: generate steering, open a file, create a spec, set the folder up. */
export type PanelAction = HostAction | 'steer' | 'open' | 'newSpec' | 'setUp';

/** What a row's actions apply to, so a host never parses its key. `written`: the phase's document is filled in. */
export interface PanelTarget { spec: string; task?: string; phase?: NonNullable<TreeSpec['phase']>; written?: true }

/**
 * One visible line of a panel. `parent` is the key of the row it folds under; `path` is relative to the folder with
 * `/` separators; `problems` is set on document rows only; `primary` is the action its main button runs.
 */
export interface PanelRow {
  key: string; parent?: string; depth: number; kind: 'header' | 'spec' | 'document' | 'task' | 'steering' | 'instruction' | 'notice';
  label: string; detail?: string; tooltip?: string; icon?: RowIcon; target?: PanelTarget; path?: string;
  problems?: { errors: number; warnings: number }; actions: PanelAction[]; primary?: PanelAction;
}

const SPECS_KEY = 'specs';
const STEERING_KEY = 'steering';

type Diagnostics = ReadonlyMap<string, readonly Diagnostic[]>;

/** The fields every row takes from core's text for it; an empty description shows nothing. */
function text(row: RowText): Pick<PanelRow, 'label' | 'detail' | 'tooltip' | 'icon'> {
  return { label: row.label, detail: row.description || undefined, tooltip: row.tooltip, icon: row.icon };
}

/** How many errors and warnings the language server reported for one file. */
function problems(diagnostics: Diagnostics, path: string): PanelRow['problems'] {
  const list = diagnostics.get(path) ?? [];
  const errors = list.filter(d => d.severity === 'error').length;
  return { errors, warnings: list.length - errors };
}

/** A row's actions with its button, the first of `preferred` it offers: the rest wait in its sheet. */
function act(actions: PanelAction[], preferred: readonly PanelAction[]): Pick<PanelRow, 'actions' | 'primary'> {
  return { actions, primary: preferred.find(a => actions.includes(a)) };
}

/** Approve sits on the document being approved, not on the spec; see `canApproveDocument`. */
function documentActions(spec: TreeSpec, document: string): PanelAction[] {
  return canApproveDocument(spec, document) ? ['approve', 'open'] : ['open'];
}

/** A spec's tasks, each under its parent task, the top ones under the tasks document. */
function taskRowsOf(spec: TreeSpec, parent: string, depth: number, rows: readonly TaskRow[]): PanelRow[] {
  return rows.flatMap(task => {
    const key = `task:${spec.name}/${task.id}`;
    const row: PanelRow = {
      key, parent, depth, kind: 'task', ...text(task), target: { spec: spec.name, task: task.id },
      ...act(taskActions(spec, task.done), ['run', 'done']),
    };
    return [row, ...taskRowsOf(spec, key, depth + 1, task.children)];
  });
}

/** One spec's row and, unless the server could not use it, its documents and their tasks. */
function rowsOfSpec(tree: SpecTree, spec: TreeSpec, diagnostics: Diagnostics): PanelRow[] {
  const key = `spec:${spec.name}`;
  const own: PanelRow = {
    key, parent: SPECS_KEY, depth: 1, kind: 'spec', ...text(specRow(spec)),
    // the phase names the spec's Write and Review actions, such as Write Tasks
    target: { spec: spec.name, ...(spec.phase ? { phase: spec.phase } : {}), ...(spec.written ? { written: true as const } : {}) },
    // once the phase's document is written, writing it again is rarely wanted: Review becomes the button and Write
    // waits in the sheet. A brief has no review, so a written one gets no button. A finished spec gets no button
    // either: Reopen and the drift review wait in its sheet, so a list of finished specs stays quiet. A spec with open
    // tasks is never shown as finished; core reads it as in execute, where Run Next is the button.
    ...act(specActions(spec).filter(a => a !== 'approve'), spec.written ? ['runNext', 'review'] : ['runNext', 'write']),
  };
  // the spec's row already carries the reason in its hover; an unusable spec has nothing below it to act on
  if (unusable(spec)) return [own];
  return [own, ...(spec.documents ?? []).flatMap(document => {
    const path = documentPath(tree, spec.name, document);
    const docKey = `doc:${spec.name}/${document}`;
    const row: PanelRow = {
      key: docKey, parent: key, depth: 2, kind: 'document', ...text(documentRow(spec, document)),
      target: { spec: spec.name, phase: DOCUMENT_PHASE[document] }, path, problems: problems(diagnostics, path),
      ...act(documentActions(spec, document), ['approve', 'open']),
    };
    return document === 'tasks.md' ? [row, ...taskRowsOf(spec, docKey, 3, taskRows(spec))] : [row];
  })];
}

/**
 * The spec list's rows in display order. A folder that is not a steno project gets one notice: set it up, or, when
 * `enclosing` names the steno project it lies inside, open that one instead.
 */
function specList(tree: SpecTree, diagnostics: Diagnostics, enclosing?: string): PanelRow[] {
  if (tree.notSetUp) {
    return enclosing === undefined
      ? [{ key: 'notice:not-set-up', depth: 0, kind: 'notice', label: 'This folder is not a steno project', detail: 'Set it up to write specs with your coding agent', actions: ['setUp'], primary: 'setUp' }]
      : [{ key: 'notice:inside', depth: 0, kind: 'notice', label: `Inside the steno project ${enclosing}`, detail: 'Open that project to work on its specs', actions: [] }];
  }
  const header: PanelRow = { key: SPECS_KEY, depth: 0, kind: 'header', label: 'Specs', actions: ['newSpec'], primary: 'newSpec' };
  if (tree.specs.length === 0) {
    return [header, { key: 'notice:no-specs', parent: SPECS_KEY, depth: 1, kind: 'notice', label: 'No specs yet', detail: 'Create one to start a feature or a bugfix', actions: ['newSpec'], primary: 'newSpec' }];
  }
  return [header, ...specOrder(tree.specs).flatMap(spec => rowsOfSpec(tree, spec, diagnostics))];
}

/**
 * The steering list's rows: the instruction files at the root, the steering files, then the instruction files only
 * one agent reads. A folder that is not a steno project gets none; the spec list already says what to do there.
 */
function steeringList(tree: SpecTree, instructions: InstructionFiles): PanelRow[] {
  if (tree.notSetUp) return [];
  const header: PanelRow = { key: STEERING_KEY, depth: 0, kind: 'header', label: 'Steering', actions: ['steer'], primary: 'steer' };
  const byPath = new Map(tree.steering.map(entry => [entry.path, entry]));
  const rows = steeringOrder(tree.steering, instructions.root, instructions.agent).map(({ kind, path }): PanelRow => ({
    key: `${kind}:${path}`, parent: STEERING_KEY, depth: 1, kind, path, actions: ['open'], primary: 'open',
    ...text(kind === 'steering' ? steeringRow(byPath.get(path)!) : instructionRow(path)),
  }));
  // instruction files are not steering: a project with only an AGENTS.md is still offered Generate Steering
  if (tree.steering.length === 0) {
    rows.push({
      key: 'notice:no-steering', parent: STEERING_KEY, depth: 1, kind: 'notice', label: 'No steering files yet',
      detail: 'Steering tells your coding agent what this project is and how it is built', actions: ['steer'], primary: 'steer',
    });
  }
  return [header, ...rows];
}

/**
 * Every row of a folder's panel, from the server's tree and diagnostics (keyed by folder-relative path) and the
 * instruction files present. `enclosing` is the nearest steno project around a folder that is not one itself.
 */
export function panelRows(input: {
  tree: SpecTree; diagnostics: Diagnostics; instructions: InstructionFiles; enclosing?: string;
}): { specRows: PanelRow[]; steeringRows: PanelRow[] } {
  const { tree, diagnostics, instructions, enclosing } = input;
  return { specRows: specList(tree, diagnostics, enclosing), steeringRows: steeringList(tree, instructions) };
}
