// Request validation: the refusals every CLI command that takes a Spec and every server request share, in the one
// fixed order of the JSON contract (steps 1 to 7). Nothing here writes.
import { statSync } from 'node:fs';
import { join } from 'node:path';
import type { Task } from './types.js';
import type { ProjectSnapshot, SpecEntry } from './project.js';
import { StenoError } from './contract.js';
import { ARTIFACTS } from './spec.js';
import { STATE_FILE, approvalError } from './state.js';
import { findTask } from './parse/tasks.js';

export type Request = { kind: 'read' | 'lint'; spec?: string; task?: string }
  | { kind: 'packet'; spec?: string; task?: string; budget?: unknown }
  | { kind: 'done' | 'reopen'; spec?: string; task?: string }
  | { kind: 'approve'; spec?: string; phase?: string };

export interface CheckOptions { cli: boolean; unsaved?: (paths: string[]) => string | undefined }

const APPROVABLE = ['brief', 'requirements', 'design', 'tasks'];
const isDir = (p: string) => { try { return statSync(p).isDirectory(); } catch { return false; } };
/** R5.15: an empty string counts as an omitted field. */
const given = (v: unknown): v is string => typeof v === 'string' && v !== '';
const invalid = (field: string, message: string) => new StenoError('invalid-request', message, { field });
const isUsable = (e: SpecEntry): e is Extract<SpecEntry, { spec: unknown }> => 'spec' in e;

/** A budget is valid when omitted or a positive whole number (a number, or a numeric string from the command line). */
function validBudget(b: unknown): boolean {
  if (b === undefined || b === null || b === '') return true;
  const n = typeof b === 'string' ? Number(b) : b;
  return typeof n === 'number' && Number.isInteger(n) && n > 0;
}

/** The Spec a CLI command acts on when none is named: the only Spec, or the only one whose Phase is not `done`. */
export function defaultSpec(snap: ProjectSnapshot): SpecEntry | undefined {
  if (snap.specs.length === 1) return snap.specs[0];
  // an Unusable Spec has no known Phase, so it may be the active one
  const active = snap.specs.filter(e => !isUsable(e) || e.spec.state.phase !== 'done');
  return active.length === 1 ? active[0] : undefined;
}

function unusableError(e: Exclude<SpecEntry, { spec: unknown }>): StenoError {
  const first = e.files[0];
  return new StenoError(e.flag, `${e.name}: ${first?.reason ?? e.flag}`, { spec: e.name, file: first?.file, reason: first?.reason });
}

/**
 * Run steps 1 to 7 of the refusal order on a request and throw the first refusal as a StenoError; otherwise return the
 * Spec entry it targets and, when it names one, the task. `snap` is the snapshot read from disk for this request.
 */
export function check(req: Request, snap: ProjectSnapshot, opts: CheckOptions): { entry: SpecEntry; task?: Task } {
  // 1. invalid-request: missing or malformed fields
  const name = given(req.spec) ? req.spec : undefined;
  const taskId = 'task' in req && given(req.task) ? req.task : undefined;
  if (!opts.cli && !name) throw invalid('spec', 'the request names no spec');
  if ((req.kind === 'packet' || req.kind === 'done' || req.kind === 'reopen') && !taskId) throw invalid('task', 'the request names no task');
  if (req.kind === 'approve' && !given(req.phase)) throw invalid('phase', 'the request names no phase');
  if (req.kind === 'packet' && !validBudget(req.budget))
    throw invalid('budget', `budget must be a positive whole number of tokens, got ${JSON.stringify(req.budget)}`);

  // 2. not-set-up: on the CLI only an Unreadable configuration counts (a missing .steno is caught when the root is found)
  if (!snap.setUp && (!opts.cli || isDir(join(snap.root, '.steno'))))
    throw new StenoError('not-set-up', snap.reason ?? `${snap.root} is not set up; run steno init`, { reason: snap.reason });

  // 3. not-found: the Spec
  const names = snap.specs.map(e => e.name);
  let entry: SpecEntry | undefined;
  if (name) {
    entry = snap.specs.find(e => e.name === name);
    if (!entry) throw new StenoError('not-found', `unknown spec "${name}"${names.length ? ` (have: ${names.join(', ')})` : ''}`, { spec: name });
  }

  // 4. unsupported / unreadable: the target Spec, or on the CLI with no Spec named, the first Unusable one (R7.13)
  if (entry) {
    if (!isUsable(entry) && req.kind !== 'lint') throw unusableError(entry);
  } else {
    const bad = [...snap.specs].sort((a, b) => a.name.localeCompare(b.name)).find(e => !isUsable(e));
    if (bad) throw unusableError(bad as Exclude<SpecEntry, { spec: unknown }>);
    entry = defaultSpec(snap);
    if (!entry) throw invalid('spec', names.length
      ? `several specs; pass one of: ${names.join(', ')}`
      : `no specs under ${snap.config.specsDir}. Run: steno new <slug>`);
  }

  // 5. not-found: the task
  let task: Task | undefined;
  if (taskId && isUsable(entry)) {
    const doc = entry.spec.tasks;
    if (!doc) throw new StenoError('not-found', `${entry.name}: tasks.md does not exist yet`, { spec: entry.name, file: join(entry.spec.root, 'tasks.md') });
    task = findTask(doc, taskId);
    if (!task) throw new StenoError('not-found', `${entry.name}: unknown task ${taskId}`, { spec: entry.name, field: 'task' });
  }

  // 6. invalid-request: the approve rules
  if (req.kind === 'approve' && isUsable(entry)) {
    const phase = req.phase!;
    const reason = !APPROVABLE.includes(phase)
      ? `phase must be ${APPROVABLE.join('|')}, got "${phase}"`
      : approvalError(entry.spec.state, phase);
    if (reason) throw new StenoError('invalid-request', reason, { field: 'phase', spec: entry.name, reason });
  }

  // 7. unsaved-edits: the files a change writes and, for approve and a packet, every Spec_Document
  if (opts.unsaved && isUsable(entry) && req.kind !== 'read' && req.kind !== 'lint') {
    const dir = entry.spec.root;
    const paths = req.kind === 'done' || req.kind === 'reopen'
      ? [join(dir, 'tasks.md'), join(dir, STATE_FILE)]
      : [...ARTIFACTS.map(f => join(dir, f)), ...(req.kind === 'approve' ? [join(dir, STATE_FILE)] : [])];
    const hit = opts.unsaved(paths);
    if (hit) throw new StenoError('unsaved-edits', `${hit} has unsaved edits; save it first`, { spec: entry.name, file: hit });
  }
  return task ? { entry, task } : { entry };
}
