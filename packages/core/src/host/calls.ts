// Builds the short message we send to a coding agent, such as `/steno-run T3.1 my-spec`. It only ever names a
// skill, a spec and maybe a task; the agent fetches everything else itself, so no file contents end up in it.
import type { Phase } from '../types.js';

export type Handoff =
  | { kind: 'run'; spec: string; task?: string }
  | { kind: 'write' | 'review'; spec: string; phase: Phase }
  | { kind: 'steer' };
export interface SkillCall { skill: string; args: string[] }
export type CallForm = 'slash' | 'dollar' | 'plain';

/** What a spec name or task id must look like before we put it in a message: no spaces, quotes or shell characters. */
export const SAFE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const WRITE: Partial<Record<Phase, string>> = {
  brief: 'steno-brainstorm', requirements: 'steno-spec', design: 'steno-design', tasks: 'steno-tasks',
};
const REVIEW_STAGE: Partial<Record<Phase, string>> = {
  requirements: 'requirements', design: 'design', tasks: 'tasks', done: 'drift',
};

/**
 * Picks the skill to call and its arguments, in the order each skill expects them (`steno-run <task> <spec>`,
 * `steno-review <stage> <spec>`). Returns `undefined` when the action makes no sense in this phase, or when a
 * name isn't safe to send.
 */
export function skillCall(h: Handoff): SkillCall | undefined {
  if (h.kind === 'steer') return { skill: 'steno-steer', args: [] };
  if (!SAFE.test(h.spec)) return undefined;
  if (h.kind === 'run') {
    if (h.task === undefined) return { skill: 'steno-run', args: [h.spec] };
    return SAFE.test(h.task) ? { skill: 'steno-run', args: [h.task, h.spec] } : undefined;
  }
  if (h.kind === 'write') {
    const skill = WRITE[h.phase];
    return skill ? { skill, args: [h.spec] } : undefined;
  }
  const stage = REVIEW_STAGE[h.phase];
  return stage ? { skill: 'steno-review', args: [stage, h.spec] } : undefined;
}

/** Writes the call the way the agent expects it: `/steno-run T3.1 my-spec`, `$steno-run T3.1 my-spec`, or a plain sentence. */
export function render(call: SkillCall, form: CallForm): string {
  if (form === 'plain') {
    return `Use the ${call.skill} skill${call.args.length ? ` with: ${call.args.join(' ')}` : ''}`;
  }
  return [`${form === 'slash' ? '/' : '$'}${call.skill}`, ...call.args].join(' ');
}
