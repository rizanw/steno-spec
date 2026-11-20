// What the panel decides without drawing anything: which rows show, what each action is called, which icon a row
// gets. Kept free of React Native so it can be tested directly.
import type { Action, PanelSnapshot, Phase, Row, RowIcon } from '../shared/contracts';

export const ACTION_LABELS: Record<Action, string> = {
  approve: 'Approve', done: 'Mark Done', reopen: 'Reopen', run: 'Run Task', runNext: 'Run Next Task',
  write: 'Write This Phase', review: 'Review This Phase', steer: 'Generate Steering', open: 'Open',
  newSpec: 'New Spec', setUp: 'Set Up',
};

/** Each phase as the Write and Review actions name it. */
const PHASE_WORDS: Record<Phase, string> = {
  brief: 'Brief', requirements: 'Requirements', design: 'Design', tasks: 'Tasks', execute: 'Execution', done: 'Drift',
};

/**
 * An action's name on one row. Write and Review name the phase they work on, such as Write Tasks: "This Phase"
 * means nothing to someone looking at a row whose phase they have not checked. Review of a finished spec is its
 * drift check, hence Review Drift.
 */
export function actionLabel(action: Action, row: Row | undefined): string {
  const phase = row?.target?.phase;
  if (phase && (action === 'write' || action === 'review')) return `${action === 'write' ? 'Write' : 'Review'} ${PHASE_WORDS[phase]}`;
  return ACTION_LABELS[action];
}

/** Lucide names for each action, matching the codicons of the VS Code view's inline buttons. */
export const ACTION_ICONS: Record<Action, string> = {
  approve: 'Check', done: 'CircleCheck', reopen: 'Undo2', run: 'Play', runNext: 'FastForward', write: 'Pencil',
  review: 'Eye', steer: 'Sparkles', open: 'FileText', newSpec: 'Plus', setUp: 'Wrench',
};

/** Lucide names for core's row icons, chosen to read like the VS Code tree's codicons. */
export const ROW_ICONS: Record<RowIcon, string> = {
  spec: 'FilePen', execute: 'CirclePlay', done: 'CircleCheck', warning: 'TriangleAlert', document: 'FileText',
  finished: 'Check', next: 'ArrowRight', task: 'Circle', steering: 'FileText', instruction: 'Bot',
};

/** The command that installs a `steno` the agents can run, named in the warning bar. */
export const INSTALL_COMMAND = 'npm install -g steno-spec';

/** Both headers start open, so a first look shows every spec and steering file without a tap. */
export const DEFAULT_EXPANDED = ['specs', 'steering'];

export const allRows = (snapshot: PanelSnapshot): Row[] => [...snapshot.specRows, ...snapshot.steeringRows];

/** The keys of rows that have rows folded under them. */
export function parents(rows: readonly Row[]): Set<string> {
  return new Set(rows.flatMap(row => (row.parent ? [row.parent] : [])));
}

/** The rows whose every ancestor is expanded, in the order given. */
export function visibleRows(rows: readonly Row[], expanded: readonly string[]): Row[] {
  const byKey = new Map(rows.map(row => [row.key, row]));
  const open = new Set(expanded);
  return rows.filter(row => {
    for (let parent = row.parent; parent !== undefined; parent = byKey.get(parent)?.parent) {
      if (!open.has(parent)) return false;
    }
    return true;
  });
}

/** Expand a collapsed row or collapse an expanded one. */
export function toggled(expanded: readonly string[], key: string): string[] {
  return expanded.includes(key) ? expanded.filter(k => k !== key) : [...expanded, key];
}

/** Rows that open in the document view when tapped: anything with a file behind it. */
export const opensDocument = (row: Row): boolean => row.path !== undefined;
