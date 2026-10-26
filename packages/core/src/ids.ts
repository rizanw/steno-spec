/** Stable identifiers used across all steno artifacts. */
export const REQ_ID = /^R(\d+)$/;            // R1
export const CRIT_ID = /^R(\d+)\.(\d+)$/;     // R1.2
export const DESIGN_ID = /^D-[A-Za-z0-9][\w-]*$/; // D-auth
export const TASK_ID = /^T?(\d+(?:\.\d+)*)$/; // T1.1 or 1.1

export type IdKind = 'requirement' | 'criterion' | 'design' | 'task' | 'unknown';

export function kindOf(id: string): IdKind {
  if (CRIT_ID.test(id)) return 'criterion';
  if (REQ_ID.test(id)) return 'requirement';
  if (DESIGN_ID.test(id)) return 'design';
  if (TASK_ID.test(id)) return 'task';
  return 'unknown';
}

/** Normalise a task reference: "1.1" -> "T1.1", "T2" -> "T2". */
export function normTaskId(id: string): string {
  const m = TASK_ID.exec(id.trim());
  return m ? `T${m[1]}` : id.trim();
}

/** Normalise a requirement reference: Kiro writes "1.2", steno writes "R1.2". */
export function normReqId(id: string): string {
  const s = id.trim();
  if (/^\d+(\.\d+)?$/.test(s)) return `R${s}`;
  return s;
}

/** Parent requirement of a criterion id ("R1.2" -> "R1"); identity for "R1". */
export function reqOf(id: string): string {
  const m = CRIT_ID.exec(id);
  return m ? `R${m[1]}` : id;
}

export function parentTaskId(id: string): string | undefined {
  const n = normTaskId(id).slice(1);
  const i = n.lastIndexOf('.');
  return i === -1 ? undefined : `T${n.slice(0, i)}`;
}
