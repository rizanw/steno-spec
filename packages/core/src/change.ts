// State changes: done, reopen and approve applied to the files on disk, all or nothing. The CLI and the server call
// these after `check`, with the snapshot `check` used.
import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Spec, SpecState } from './types.js';
import type { ProjectSnapshot } from './project.js';
import { PROTOCOL_VERSION, StenoError, type ChangeResult } from './contract.js';
import { STATE_FILE, derivePhase, stateText, syncDonePhase } from './state.js';
import { allTasksDone, parseTasks, setTaskDone } from './parse/tasks.js';
import { hasErrors, lintSpec } from './lint.js';
import { specDiagnostics } from './diagnostics.js';

/** Writes the final bytes of one file. */
export type Writer = (path: string, bytes: Uint8Array) => void;

/** Write a temporary file beside the target, then rename it over the target. */
export const defaultWriter: Writer = (path, bytes) => {
  const tmp = `${path}.steno-${process.pid}.tmp`;
  try { writeFileSync(tmp, bytes); renameSync(tmp, path); } catch (e) { rmSync(tmp, { force: true }); throw e; }
};

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const today = () => new Date().toISOString().slice(0, 10);
const readBytes = (path: string): Buffer | undefined => {
  try { return readFileSync(path); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw e; }
};

/** The usable Spec `check` returned for this snapshot, and whether its state was derived from its documents. */
function usable(snap: ProjectSnapshot, name: string): { spec: Spec; derived: boolean } {
  const e = snap.specs.find(x => x.name === name);
  if (!e) throw new StenoError('not-found', `unknown spec "${name}"`, { spec: name });
  if (!('spec' in e)) throw new StenoError(e.flag, `${name}: ${e.files[0]?.reason ?? e.flag}`, { spec: name, file: e.files[0]?.file, reason: e.files[0]?.reason });
  return e;
}

/** A copy of the state; a derived one gets today's date as `created` and for each derived approval. */
function workingState(e: { spec: Spec; derived: boolean }): SpecState {
  const s = structuredClone(e.spec.state);
  if (e.derived) { s.created = today(); for (const k of Object.keys(s.approvals) as (keyof SpecState['approvals'])[]) s.approvals[k] = today(); }
  return s;
}

/**
 * Write every file or none. The original bytes of each file are read first; the files are then written one at a time,
 * and when a write fails each file that existed is restored and each file the change created is removed.
 */
function writeAll(files: { path: string; text: string; original?: Buffer }[], write: Writer): void {
  const touched: typeof files = [];
  try {
    for (const f of files) {
      touched.push(f);
      // put the byte order mark back when the file had one
      const body = Buffer.from(f.text, 'utf8');
      write(f.path, f.original?.subarray(0, 3).equals(BOM) ? Buffer.concat([BOM, body]) : body);
    }
  } catch (cause) {
    const left: string[] = [];
    for (const f of touched) {
      try { if (f.original) writeFileSync(f.path, f.original); else rmSync(f.path, { force: true }); } catch { left.push(f.path); }
    }
    if (left.length) throw new StenoError('failed', `the change failed and could not be undone; left changed: ${left.join(', ')}`, { reason: (cause as Error)?.message });
    if (cause instanceof StenoError) throw cause;
    throw new StenoError('failed', `the change failed, nothing was changed: ${(cause as Error)?.message ?? String(cause)}`);
  }
}

/** Mark a task done or reopen it, with its subtasks, its parents and the Phase, as `steno done [--undo]` does. */
export function applyTaskChange(snap: ProjectSnapshot, spec: string, task: string, done: boolean, opts: { write?: Writer } = {}): ChangeResult {
  const e = usable(snap, spec);
  const doc = e.spec.tasks;
  if (!doc) throw new StenoError('not-found', `${spec}: tasks.md does not exist yet`, { spec });
  const tasksPath = join(e.spec.root, 'tasks.md'), statePath = join(e.spec.root, STATE_FILE);
  const originals = { tasks: readBytes(tasksPath), state: readBytes(statePath) };
  const text = setTaskDone(doc, task, done);
  const state = workingState(e);
  const moved = syncDonePhase(state, allTasksDone(parseTasks(text)));
  const files = [{ path: tasksPath, text, original: originals.tasks }];
  if (moved || e.derived) files.push({ path: statePath, text: stateText(state), original: originals.state });
  writeAll(files, opts.write ?? defaultWriter);
  return { protocolVersion: PROTOCOL_VERSION, spec, phase: state.phase, task, done };
}

/**
 * Approve the current stage, as `steno approve` does: the lint gate on that stage's saved files, then today's date as the
 * approval. With errors and no `force` it throws `lint-blocked` with the error findings and writes nothing.
 * Approving `brief` moves to `requirements` with no lint.
 */
export function applyApprove(snap: ProjectSnapshot, spec: string, phase: string, opts: { force?: boolean; write?: Writer } = {}): ChangeResult {
  const e = usable(snap, spec);
  const state = workingState(e);
  let forced = false;
  if (phase !== 'brief') {
    const stage = phase as 'requirements' | 'design' | 'tasks';
    if (hasErrors(lintSpec(e.spec, stage))) {
      if (!opts.force) {
        const findings = specDiagnostics(snap, spec, stage).filter(d => d.severity === 'error');
        throw new StenoError('lint-blocked', `${spec}: fix the ${stage} lint errors first`, { spec, findings });
      }
      forced = true;
    }
    state.approvals[stage] = today();
  }
  state.phase = phase === 'brief' ? 'requirements' : derivePhase(state, !!e.spec.tasks && allTasksDone(e.spec.tasks));
  const statePath = join(e.spec.root, STATE_FILE);
  writeAll([{ path: statePath, text: stateText(state), original: readBytes(statePath) }], opts.write ?? defaultWriter);
  return { protocolVersion: PROTOCOL_VERSION, spec, phase: state.phase, approved: phase as ChangeResult['phase'], ...(forced ? { forced: true as const } : {}) };
}
