// What the panel decides without drawing anything: which rows show, what each action is called, which icon a row
// gets. Kept free of React Native so it can be tested directly.
import type { Action, PanelSnapshot, Phase, Row, RowIcon } from '../shared/contracts';
import { atLeast } from './vendor/host.mjs';

export const ACTION_LABELS: Record<Action, string> = {
  approve: 'Approve', done: 'Mark Done', reopen: 'Reopen', run: 'Run Task', runNext: 'Run Next Task',
  write: 'Write This Phase', review: 'Review This Phase', steer: 'Generate Steering', open: 'Open',
  newSpec: 'New Spec', setUp: 'Set Up', reopenSpec: 'Reopen Spec',
};

/** Each phase as the Write and Review actions name it. */
const PHASE_WORDS: Record<Phase, string> = {
  brief: 'Brief', requirements: 'Requirements', design: 'Design', tasks: 'Tasks', execute: 'Execution', done: 'Drift',
};

/**
 * An action's name on one row. Write and Review name the phase they work on, such as Write Tasks: "This Phase"
 * means nothing to someone looking at a row whose phase they have not checked. Review of a finished spec is its
 * drift check, hence Review Drift. Once the phase's document is written, Write revises it, hence Revise Tasks.
 */
export function actionLabel(action: Action, row: Row | undefined): string {
  const phase = row?.target?.phase;
  if (phase && action === 'review') return `Review ${PHASE_WORDS[phase]}`;
  if (phase && action === 'write') return `${row?.target?.written ? 'Revise' : 'Write'} ${PHASE_WORDS[phase]}`;
  return ACTION_LABELS[action];
}

/** Lucide names for each action, matching the codicons of the VS Code view's inline buttons. */
export const ACTION_ICONS: Record<Action, string> = {
  approve: 'Check', done: 'CircleCheck', reopen: 'Undo2', run: 'Play', runNext: 'FastForward', write: 'Pencil',
  review: 'Eye', steer: 'Sparkles', open: 'FileText', newSpec: 'Plus', setUp: 'Wrench', reopenSpec: 'RotateCcw',
};

/** Lucide names for core's row icons, chosen to read like the VS Code tree's codicons. */
export const ROW_ICONS: Record<RowIcon, string> = {
  spec: 'FilePen', execute: 'CirclePlay', done: 'CircleCheck', warning: 'TriangleAlert', document: 'FileText',
  finished: 'Check', next: 'ArrowRight', task: 'Circle', steering: 'FileText', instruction: 'Bot',
};

/**
 * The actions a row shows as buttons, in order. Tapping a row opens its file, so Open gets no button of its own,
 * except on a row that expands when tapped, such as the tasks document: there the button is the only way to read it.
 * `expands` is whether anything folds under the row.
 */
export function rowButtons(row: Row, expands: boolean): Action[] {
  const out: Action[] = [];
  if (row.actions.includes('open') && expands && row.primary !== 'open') out.push('open');
  if (row.primary && (row.primary !== 'open' || expands)) out.push(row.primary);
  return out;
}

/**
 * Whether a row needs the "more" button: only when an action has no other way in. An Open that tapping the row
 * already does counts as reachable, so a row whose every action is a button or the tap itself gets no sheet.
 */
export function needsMore(row: Row, expands: boolean): boolean {
  const buttons = rowButtons(row, expands);
  return row.actions.some(a => !buttons.includes(a) && !(a === 'open' && !expands));
}

/** The command that installs a `steno` the agents can run, pinned to the version the plugin bundles. */
export const installCommand = (version: string): string => `npm install -g steno-spec@${version}`;

/** What the warning bar says about the agents' `steno`, or nothing when it matches. */
export function agentStenoWarning(agentSteno: PanelSnapshot['agentSteno']): string | undefined {
  const { found, protocol, version, matches, bundled } = agentSteno;
  if (matches) return undefined;
  const install = installCommand(bundled);
  if (!found) return `Your coding agents have no steno command. Install it: ${install}`;
  if (version !== undefined && !atLeast(version, bundled)) {
    return `The steno your coding agents run is ${version}, older than this plugin's ${bundled}. Install the current one: ${install}`;
  }
  return `The steno your coding agents run speaks ${protocol === undefined ? 'an unknown protocol' : `protocol ${protocol}`}, not this plugin's. Install the current one: ${install}`;
}

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
