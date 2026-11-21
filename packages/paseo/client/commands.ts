// The panel's actions in Paseo's Command Center (⌘K). An item cannot draw anything itself, so every item that needs
// the panel leaves an intent with the server and opens the panel; the panel's next snapshot carries the intent, and
// the panel acts on it. Approve… reaches the server only as an intent: the user still picks the row and presses the
// button, so no agent can approve through this path.
import type { PluginClientContext, PluginWorkspaceCommandContext } from '@getpaseo/plugin/client';
import { intent, restart, type Action, type Row } from '../shared/contracts';
import { actionLabel } from './model';

export const PANEL_ID = 'steno';

/** The intents that end in a picker of rows, as the Command Center titles them. */
export const PICKED_ITEMS: readonly { action: Action; title: string; icon: string }[] = [
  { action: 'approve', title: 'Approve…', icon: 'Check' },
  { action: 'done', title: 'Mark Task Done…', icon: 'CircleCheck' },
  { action: 'reopen', title: 'Reopen Task…', icon: 'Undo2' },
  { action: 'run', title: 'Run Task…', icon: 'Play' },
  { action: 'runNext', title: 'Run Next Task…', icon: 'FastForward' },
  { action: 'write', title: 'Write This Phase…', icon: 'Pencil' },
  { action: 'review', title: 'Review This Phase…', icon: 'Eye' },
  { action: 'open', title: 'Open Document…', icon: 'FileText' },
];

/** The rows that offer `action`, in panel order; the picker lists exactly these. */
export const rowsOffering = (rows: readonly Row[], action: Action): Row[] => rows.filter(row => row.actions.includes(action));

/** What the picker asks, worded for the person choosing rather than after the panel's rows. */
const PICKER_TITLES: Partial<Record<Action, string>> = {
  approve: 'Approve a phase', done: 'Mark a task done', reopen: 'Reopen a task', run: 'Run a task',
  runNext: 'Run the next task', write: 'Write a phase', review: 'Review a phase', open: 'Open a document',
};

/** Said instead of an empty picker, naming what is missing. */
const NOTHING_TO_PICK: Partial<Record<Action, string>> = {
  approve: 'Nothing to approve: no spec has a phase waiting for approval.',
  done: 'Nothing to mark done: no spec in execution has an open task.',
  reopen: 'Nothing to reopen: no task is done yet.',
  run: 'Nothing to run: no spec in execution has an open task.',
  runNext: 'Nothing to run: no spec in execution has a task left.',
  write: 'Nothing to write: no spec has a phase left to write.',
  review: 'Nothing to review: no spec has a phase to review.',
  open: 'Nothing to open: there are no specs or steering files yet.',
};

export const nothingToPick = (action: Action): string => NOTHING_TO_PICK[action] ?? `Nothing to ${actionLabel(action, undefined).toLowerCase()} right now.`;

/** One line of the picker. The action is in the picker's title, so a line says only which thing it applies to. */
export interface PickerEntry { row: Row; label: string; detail?: string }
/** Lines under one spec's name, or under Steering; a picker of whole specs has one section with no title. */
export interface PickerSection { key: string; title?: string; entries: PickerEntry[] }
export interface Picker { action: Action; title: string; sections: PickerSection[] }

/** Write and Review read best with the phase they work on, such as Write Tasks, since the spec's name alone hides it. */
const PHASE_NAMED: readonly Action[] = ['write', 'review'];

const problemsText = (row: Row): string | undefined => {
  const { errors = 0, warnings = 0 } = row.problems ?? {};
  const parts = [errors && `${errors} ${errors === 1 ? 'error' : 'errors'}`, warnings && `${warnings} ${warnings === 1 ? 'warning' : 'warnings'}`];
  return parts.filter(Boolean).join(' · ') || undefined;
};

const joined = (...parts: (string | false | undefined)[]): string | undefined => parts.filter(Boolean).join(' · ') || undefined;

function entryFor(row: Row, action: Action): PickerEntry {
  if (row.kind === 'spec') return { row, label: row.label, detail: joined(PHASE_NAMED.includes(action) && actionLabel(action, row), row.detail) };
  if (row.kind === 'task') return { row, label: row.label, detail: joined(row.target?.task, row.detail) };
  if (row.kind === 'document') return { row, label: row.label, detail: problemsText(row) };
  return { row, label: row.label, detail: row.detail };
}

/**
 * The picker for `action`, or none when no row offers it. Documents and tasks are grouped under their spec's
 * title, in panel order, so the spec's name is said once instead of on every line; steering files go under Steering.
 */
export function pickerFor(action: Action, rows: readonly Row[]): Picker | undefined {
  const offering = rowsOffering(rows, action);
  if (!offering.length) return undefined;
  const title = PICKER_TITLES[action] ?? actionLabel(action, undefined);
  const specTitles = new Map(rows.filter(r => r.kind === 'spec' && r.target).map(r => [r.target!.spec, r.label]));
  const sections: PickerSection[] = [];
  for (const row of offering) {
    const group = row.kind === 'spec' ? '' : row.target ? `spec:${row.target.spec}` : row.kind;
    let section = sections.at(-1);
    if (!section || section.key !== group) {
      const heading = row.kind === 'spec' ? undefined : row.target ? specTitles.get(row.target.spec) ?? row.target.spec : row.kind === 'steering' ? 'Steering' : undefined;
      section = { key: group, title: heading, entries: [] };
      sections.push(section);
    }
    section.entries.push(entryFor(row, action));
  }
  return { action, title, sections };
}

const openPanel = (ctx: PluginWorkspaceCommandContext) => ctx.openPanel(PANEL_ID, { location: 'explorer' });

/** Leave the intent first, so a panel that opens fresh finds it in its first snapshot. */
async function sendIntent(ctx: PluginWorkspaceCommandContext, action: Action): Promise<void> {
  await ctx.rpc(intent, { workspaceId: ctx.workspace.ref.id, action });
  openPanel(ctx);
}

export function registerCommands(client: PluginClientContext): () => void {
  const item = (id: string, title: string, icon: string, onSelect: (ctx: PluginWorkspaceCommandContext) => void | Promise<void>) =>
    // Paseo refuses an id with a dot and scopes ids to the plugin itself, so they stay plain kebab-case
    client.addCommandCenterItem({ id, title, icon, keywords: ['steno', 'spec'], context: 'workspace', onSelect });
  const removers = [
    item('open', 'Open steno', 'PanelLeft', openPanel),
    item('new-spec', 'New Spec', 'Plus', ctx => sendIntent(ctx, 'newSpec')),
    item('set-up', 'Set Up steno', 'Wrench', ctx => sendIntent(ctx, 'setUp')),
    item('steer', 'Generate Steering', 'Sparkles', ctx => sendIntent(ctx, 'steer')),
    item('restart', 'Restart steno Server', 'RefreshCw', async ctx => { await ctx.rpc(restart, { workspaceId: ctx.workspace.ref.id }); }),
    ...PICKED_ITEMS.map(({ action, title, icon }) => item(`pick-${action.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}`, title, icon, ctx => sendIntent(ctx, action))),
  ];
  return () => { for (const remove of removers) remove(); };
}
