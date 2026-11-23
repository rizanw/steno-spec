// Approve, done, reopen and reopening a spec, sent to the active worktree's language server. Orca cannot say whether
// a file has unsaved edits, so no buffer text goes with a request and the server reads the files as last saved. A
// refusal comes back as a value carrying steno's structured error, so the panel can list each blocking problem.
import type { OrcaWorkerApi } from 'orca/worker';
import { failed, readRefusal, reopenedMessage, REQUESTS, type PanelRow } from '@steno/core/host';
import type { ChangeResult } from '@steno/core';
import type { FolderServer } from '@steno/host';
import type { ActResult } from '../shared/messages.js';

export type Change = 'approve' | 'done' | 'reopen' | 'reopenSpec';
export const CHANGES: readonly string[] = ['approve', 'done', 'reopen', 'reopenSpec'] satisfies Change[];

/** `phase` is the one being approved, so an approval sent from a panel drawn before the spec moved on is refused. */
export interface ChangeRequest { action: Change; spec: string; phase?: string; task?: string }

const METHODS = { approve: REQUESTS.approve, done: REQUESTS.taskDone, reopen: REQUESTS.taskReopen, reopenSpec: REQUESTS.specReopen } as const;

/** The change a row's action asks for, or `undefined` when the row does not offer it. */
export function changeOf(row: PanelRow | undefined, action: Change): ChangeRequest | undefined {
  if (!row?.target || !row.actions.includes(action)) return undefined;
  const { spec, task, phase } = row.target;
  if (action === 'approve') return { action, spec, ...(phase ? { phase } : {}) };
  if (action === 'reopenSpec') return { action, spec };
  return task === undefined ? undefined : { action, spec, task };
}

/** What the notification says once the server made the change. */
export function successMessage(req: ChangeRequest, result: ChangeResult): string {
  if (req.action === 'approve') return `${req.spec}: ${result.approved ?? req.phase ?? 'stage'} approved, now in ${result.phase}`;
  if (req.action === 'done') return `${req.task} of ${req.spec} is done.`;
  return reopenedMessage({ spec: req.spec, task: req.action === 'reopen' ? req.task : undefined });
}

/** Send one change to `server`; a success is announced in a notification, a refusal is returned for the panel to draw. */
export async function applyChange(orca: Pick<OrcaWorkerApi, 'host'>, server: FolderServer, req: ChangeRequest): Promise<ActResult> {
  const params = req.action === 'approve' ? { spec: req.spec, phase: req.phase }
    : req.action === 'reopenSpec' ? { spec: req.spec } : { spec: req.spec, task: req.task };
  let result: ChangeResult;
  try {
    result = await server.request<ChangeResult>(METHODS[req.action], params);
  } catch (err) {
    return { refusal: readRefusal(err) ?? failed(err instanceof Error ? err.message : String(err)) };
  }
  // the change already happened; a notification Orca could not show must not read as steno refusing it
  await orca.host.call('notifications.show', { title: successMessage(req, result) }).catch(() => undefined);
  return { done: true };
}
