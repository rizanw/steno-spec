// Task lenses: data only. The server registers no handler for either command ID, so choosing a lens reaches only the Client.
import { CONTRACT, type TasksDoc } from '@steno/core';

export const LENS_RUN = 'steno.task.run', LENS_DONE = 'steno.task.done';
// the IDs here must be the ones the contract names
const named: readonly string[] = CONTRACT.lensCommands;
if (!named.includes(LENS_RUN) || !named.includes(LENS_DONE)) throw new Error('lens command IDs differ from the contract');

export interface TaskLens { line: number; command: string; title: string; args: { spec: string; task: string; optional: boolean } }

/** A run lens above each unchecked task, parents included, a done lens above each checked task; `line` is 1-based. */
export function taskLenses(spec: string, doc: TasksDoc): TaskLens[] {
  return doc.tasks.map((t): TaskLens => {
    const suffix = t.optional ? ' (optional)' : '';
    return {
      line: t.line,
      command: t.done ? LENS_DONE : LENS_RUN,
      title: (t.done ? 'Done' : `Run ${t.id}`) + suffix,
      args: { spec, task: t.id, optional: t.optional },
    };
  });
}
