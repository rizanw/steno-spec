// `steno.change`: approve, done, reopen and reopening a spec, sent to the workspace's language server. A refusal comes back as a
// value with the server's structured error, so the panel can list each lint problem instead of one message.
import { failed, readRefusal, REQUESTS, type ChangeResult, type StructuredError } from './vendor/host.mjs';
import type { ChangeOutcome } from '../shared/contracts';
import type { FolderServer } from './pool';

/** The panel's name for each change and the server request that makes it. */
export const CHANGE_METHODS = { approve: REQUESTS.approve, done: REQUESTS.taskDone, reopen: REQUESTS.taskReopen, reopenSpec: REQUESTS.specReopen } as const;

/** Said when the server is stopped; nothing is sent, so nothing changed. */
export const STOPPED_MESSAGE = 'steno server stopped, nothing changed';

export interface ChangeRequest { kind: keyof typeof CHANGE_METHODS; spec: string; phase?: string; task?: string }

/** The structured error a server refusal carries in its `data`, or a `failed` one around anything else. */
export function refusal(err: unknown): StructuredError {
  return readRefusal(err) ?? failed(err instanceof Error ? err.message : String(err));
}

export async function applyChange(server: FolderServer, req: ChangeRequest): Promise<ChangeOutcome> {
  // checked here rather than left to the request, so the panel gets this message and can offer a restart
  if (server.state === 'stopped') return { ok: false, error: failed(STOPPED_MESSAGE) };
  const params = req.kind === 'approve' ? { spec: req.spec, phase: req.phase } : req.kind === 'reopenSpec' ? { spec: req.spec } : { spec: req.spec, task: req.task };
  try {
    return { ok: true, result: await server.request<ChangeResult>(CHANGE_METHODS[req.kind], params) };
  } catch (err) {
    return { ok: false, error: refusal(err) };
  }
}
