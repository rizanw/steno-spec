// What a host says around reopening, so every host asks and confirms in the same words. Reopening undoes a step
// the user took on purpose, which is why it asks first and says what is kept.

/** A task of a spec, or the whole spec when `task` is absent. */
export interface ReopenTarget { spec: string; task?: string }

/** The question before reopening, and the line under it that says what stays. */
export function reopenWording(r: ReopenTarget): { title: string; body: string } {
  if (r.task === undefined) {
    return { title: `Reopen ${r.spec}?`, body: 'steno moves the spec back to execution so you can add tasks; its approvals and finished tasks stay.' };
  }
  return { title: `Reopen ${r.task} of ${r.spec}?`, body: 'steno marks the task open again; the code it wrote stays as it is.' };
}

/** The message once the server reopened it. */
export function reopenedMessage(r: ReopenTarget): string {
  return r.task === undefined ? `${r.spec} is open again. Add tasks to tasks.md, then run them.` : `${r.task} of ${r.spec} is open again.`;
}
