// What the panel draws, decided without drawing anything so it can be tested directly: which rows show, which
// actions get a button and what each is called. The rules are the Paseo panel's (packages/paseo/client/model.ts), so
// the two panels offer the same buttons on the same rows. A row offers only its own actions, so an action that does
// not apply to it is never on screen to be pressed.
import type { PanelAction, PanelRow, RowIcon } from '@steno/core/host';

/** Each action's name, the same names the Paseo panel uses. */
export const ACTION_LABELS: Record<PanelAction, string> = {
  approve: 'Approve', done: 'Mark Done', reopen: 'Reopen', run: 'Run Task', runNext: 'Run Next Task',
  write: 'Write This Phase', review: 'Review This Phase', steer: 'Generate Steering', open: 'Open',
  newSpec: 'New Spec', setUp: 'Set Up', reopenSpec: 'Reopen Spec',
};

type Phase = NonNullable<NonNullable<PanelRow['target']>['phase']>;
const PHASE_WORDS: Record<Phase, string> = {
  brief: 'Brief', requirements: 'Requirements', design: 'Design', tasks: 'Tasks', execute: 'Execution', done: 'Drift',
};

/**
 * An action's name on one row. Write and Review name the phase they work on, such as Write Tasks, since "This Phase"
 * means nothing to someone who has not checked the row's phase; once the document is written, Write revises it.
 */
export function actionLabel(action: PanelAction, row: PanelRow | undefined): string {
  const phase = row?.target?.phase;
  if (phase && action === 'review') return `Review ${PHASE_WORDS[phase]}`;
  if (phase && action === 'write') return `${row?.target?.written ? 'Revise' : 'Write'} ${PHASE_WORDS[phase]}`;
  return ACTION_LABELS[action];
}

/** Lucide names for each action, the Paseo panel's, matching the codicons of the VS Code view's inline buttons. */
export const ACTION_ICONS: Record<PanelAction, string> = {
  approve: 'Check', done: 'CircleCheck', reopen: 'Undo2', run: 'Play', runNext: 'FastForward', write: 'Pencil',
  review: 'Eye', steer: 'Sparkles', open: 'FileText', newSpec: 'Plus', setUp: 'Wrench', reopenSpec: 'RotateCcw',
};

/** Lucide names for core's row icons, the Paseo panel's, chosen to read like the VS Code tree's codicons. */
export const ROW_ICONS: Record<RowIcon, string> = {
  spec: 'FilePen', execute: 'CirclePlay', done: 'CircleCheck', warning: 'TriangleAlert', document: 'FileText',
  finished: 'Check', next: 'ArrowRight', task: 'Circle', steering: 'FileText', instruction: 'Bot',
};

/**
 * Both headers start open, so a first look shows every spec and steering file; specs and tasks start closed. The
 * `inside:` pair are the same headers of the enclosing project, listed under the notice in a folder nested in one.
 */
export const START_EXPANDED: readonly string[] = ['specs', 'steering', 'inside:specs', 'inside:steering'];

/**
 * One row as the panel draws it: whether rows fold under it, whether they show, and whether it keeps room for a
 * chevron. That room is kept only where some row at the same level has one, so the icons of a level line up, while a
 * level with nothing to unfold, such as the steering files, does not sit a chevron's width to the right.
 */
export interface VisibleRow { row: PanelRow; expands: boolean; open: boolean; chevronSlot: boolean }

/**
 * The rows to draw, in snapshot order: the spec rows then the steering rows, each shown only while every row above it
 * is expanded. A row whose parent is missing stays visible rather than disappearing with it.
 */
export function visibleRows(rows: readonly PanelRow[], expanded: readonly string[]): VisibleRow[] {
  const byKey = new Map(rows.map(row => [row.key, row]));
  const parents = new Set(rows.flatMap(row => (row.parent !== undefined && byKey.has(row.parent) ? [row.parent] : [])));
  // a notice draws no chevron, so what it holds (the enclosing project's tree) is always shown
  const open = new Set([...expanded, ...rows.filter(row => row.kind === 'notice').map(row => row.key)]);
  const shown = (row: PanelRow): boolean => {
    for (let parent = row.parent; parent !== undefined && byKey.has(parent); parent = byKey.get(parent)!.parent) {
      if (!open.has(parent)) return false;
    }
    return true;
  };
  const levelOf = (row: PanelRow) => (row.parent !== undefined && byKey.has(row.parent) ? row.parent : '');
  const levelsThatUnfold = new Set(rows.filter(row => parents.has(row.key)).map(levelOf));
  return rows.filter(shown).map(row => ({
    row, expands: parents.has(row.key), open: parents.has(row.key) && open.has(row.key), chevronSlot: levelsThatUnfold.has(levelOf(row)),
  }));
}

/** `expanded` with `key` added, or taken out if it was there. */
export const toggled = (expanded: readonly string[], key: string): string[] =>
  expanded.includes(key) ? expanded.filter(k => k !== key) : [...expanded, key];

/** What pressing a row does: show or hide what folds under it, open its file, or nothing. */
export function rowPress(visible: VisibleRow): 'toggle' | 'open' | undefined {
  if (visible.expands) return 'toggle';
  return visible.row.path !== undefined && visible.row.actions.includes('open') ? 'open' : undefined;
}

/**
 * The actions a row shows as buttons, in order. Pressing a row opens its file, so Open gets no button of its own,
 * except on a row that unfolds when pressed, such as the tasks document: there the button is the only way to read it.
 */
export function rowButtons(row: PanelRow, expands: boolean): PanelAction[] {
  const out: PanelAction[] = [];
  if (row.actions.includes('open') && expands && row.primary !== 'open') out.push('open');
  if (row.primary && row.actions.includes(row.primary) && (row.primary !== 'open' || expands)) out.push(row.primary);
  return out;
}

/**
 * Whether a row needs the `…` button: only when an action has no other way in. An Open that pressing the row
 * already does counts as reachable, so a row whose every action is a button or the press itself gets no menu.
 */
export function needsMore(row: PanelRow, expands: boolean): boolean {
  const buttons = rowButtons(row, expands);
  return row.actions.some(a => !buttons.includes(a) && !(a === 'open' && !expands));
}

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** A document's lint counts as the row shows them, errors first; none when it is clean. */
export function problemCounts(row: PanelRow): { errors?: string; warnings?: string } {
  const { errors = 0, warnings = 0 } = row.problems ?? {};
  return { ...(errors ? { errors: count(errors, 'error') } : {}), ...(warnings ? { warnings: count(warnings, 'warning') } : {}) };
}
