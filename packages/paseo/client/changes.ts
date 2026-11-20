// Approve, done and reopen as the panel runs them: which request a row's action makes, the confirmation a reopen
// needs before anything is sent, and the words for each outcome. No React here, so the rules are tested directly.
import type { Action, ChangeOutcome, ChangeResult, Diagnostic, Row, StructuredError } from '../shared/contracts';

export interface ChangeRequest { kind: 'approve' | 'done' | 'reopen'; spec: string; phase?: ChangeResult['phase']; task?: string }

export const CHANGE_ACTIONS: readonly Action[] = ['approve', 'done', 'reopen'];

/** The change a row's action asks for, or none when the action is not a change or the row lacks its target. */
export function changeFor(row: Row, action: Action): ChangeRequest | undefined {
  const target = row.target;
  if (!target) return undefined;
  if (action === 'approve') return target.phase ? { kind: 'approve', spec: target.spec, phase: target.phase } : undefined;
  if (action === 'done' || action === 'reopen') return target.task ? { kind: action, spec: target.spec, task: target.task } : undefined;
  return undefined;
}

/**
 * Run one change. A reopen waits for `confirm` and, when the user declines, sends nothing and returns `undefined`;
 * marking a task open again is the one change the user may not have meant.
 */
export async function performChange(
  request: ChangeRequest,
  confirm: (request: ChangeRequest) => Promise<boolean>,
  send: (request: ChangeRequest) => Promise<ChangeOutcome>,
): Promise<ChangeOutcome | undefined> {
  if (request.kind === 'reopen' && !(await confirm(request))) return undefined;
  return send(request);
}

const PHASE_NAMES: Record<ChangeResult['phase'], string> = {
  brief: 'Brief', requirements: 'Requirements', design: 'Design', tasks: 'Tasks', execute: 'Execution', done: 'Done',
};

/** The toast after a change the server accepted. */
export function successMessage(request: ChangeRequest, result: ChangeResult): string {
  if (request.kind === 'done') return `${request.task} of ${result.spec} is done.`;
  if (request.kind === 'reopen') return `${request.task} of ${result.spec} is open again.`;
  const approved = request.phase ? `${PHASE_NAMES[request.phase]} approved.` : 'Approved.';
  return result.phase === 'done' ? `${approved} ${result.spec} is finished.` : `${approved} ${result.spec} moves on to ${PHASE_NAMES[result.phase].toLowerCase()}.`;
}

/** One lint problem as the refusal lists it: where, how bad, what. */
export const problemLine = (d: Diagnostic): string => `${d.file}:${d.line}  ${d.severity}  ${d.message}`;

/** The lines a refusal shows under its message; only a lint block has any. */
export const refusalProblems = (error: StructuredError): string[] => (error.findings ?? []).map(problemLine);
