// The panel's actions in Paseo's Command Center (⌘K). An item cannot draw anything itself, so every item that needs
// the panel leaves an intent with the server and opens the panel; the panel's next snapshot carries the intent, and
// the panel acts on it. Approve… reaches the server only as an intent: the user still picks the row and presses the
// button, so no agent can approve through this path.
import type { PluginClientContext, PluginWorkspaceCommandContext } from '@getpaseo/plugin/client';
import { intent, restart, type Action, type Row } from '../shared/contracts';

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

const openPanel = (ctx: PluginWorkspaceCommandContext) => ctx.openPanel(PANEL_ID, { location: 'explorer' });

/** Leave the intent first, so a panel that opens fresh finds it in its first snapshot. */
async function sendIntent(ctx: PluginWorkspaceCommandContext, action: Action): Promise<void> {
  await ctx.rpc(intent, { workspaceId: ctx.workspace.ref.id, action });
  openPanel(ctx);
}

export function registerCommands(client: PluginClientContext): () => void {
  const item = (id: string, title: string, icon: string, onSelect: (ctx: PluginWorkspaceCommandContext) => void | Promise<void>) =>
    client.addCommandCenterItem({ id: `steno.${id}`, title, icon, keywords: ['steno', 'spec'], context: 'workspace', onSelect });
  const removers = [
    item('open', 'Open steno', 'PanelLeft', openPanel),
    item('newSpec', 'New Spec', 'Plus', ctx => sendIntent(ctx, 'newSpec')),
    item('setUp', 'Set Up steno', 'Wrench', ctx => sendIntent(ctx, 'setUp')),
    item('steer', 'Generate Steering', 'Sparkles', ctx => sendIntent(ctx, 'steer')),
    item('restart', 'Restart steno Server', 'RefreshCw', async ctx => { await ctx.rpc(restart, { workspaceId: ctx.workspace.ref.id }); }),
    ...PICKED_ITEMS.map(({ action, title, icon }) => item(`intent.${action}`, title, icon, ctx => sendIntent(ctx, action))),
  ];
  return () => { for (const remove of removers) remove(); };
}
