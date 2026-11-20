// Diagnostics: lint findings, read errors and configuration warnings as editor-ready entries with a
// root-relative path and a 1-based file line. Pure: every builder works from a ProjectSnapshot.
import { basename, join, relative, sep } from 'node:path';
import type { LintIssue } from './types.js';
import type { Diagnostic } from './contract.js';
import type { ProjectSnapshot } from './project.js';
import { configPath } from './config.js';
import { lintSpec } from './lint.js';
import { STATE_FILE } from './state.js';
import { lintSteeringFiles } from './steer.js';

/** `abs` relative to the snapshot root, with forward slashes. */
const rel = (snap: ProjectSnapshot, abs: string) => relative(snap.root, abs).split(sep).join('/');
const severity = (i: LintIssue): Diagnostic['severity'] => (i.level === 'error' ? 'error' : 'warning');

/**
 * The lint Diagnostics of one usable Spec, for one stage when `only` is given (as `steno lint` and the lint gate).
 * A finding on a file the Spec has keeps its line (line 1 when it has none); a finding on a file the Spec lacks, such
 * as `spec/missing`, goes to line 1 of the Spec's `spec.yaml` path. An Unusable or unknown Spec gives nothing.
 */
export function specDiagnostics(snap: ProjectSnapshot, name: string, only?: 'requirements' | 'design' | 'tasks'): Diagnostic[] {
  const entry = snap.specs.find(e => e.name === name);
  if (!entry || !('spec' in entry)) return [];
  const { spec } = entry;
  return lintSpec(spec, only).map(i => {
    const exists = spec.files[i.file] !== undefined;
    return {
      file: rel(snap, join(spec.root, exists ? i.file : STATE_FILE)),
      line: exists ? i.line ?? 1 : 1,
      severity: severity(i), rule: i.rule, message: i.msg, spec: name,
    };
  });
}

/**
 * The steering lint Diagnostics of the snapshot's readable steering files. The no-match warning appears only when
 * `matches` is given. A finding on no file (`steering/budget`) goes to line 1 of the configuration path.
 */
export function steeringDiagnostics(snap: ProjectSnapshot, matches?: Map<string, number>): Diagnostic[] {
  if (!snap.setUp) return [];
  const readable = snap.steering.filter(e => e.text !== undefined);
  const byName = new Map(readable.map(e => [basename(e.file), e.file]));
  const files = readable.map(e => ({ file: basename(e.file), text: e.text! }));
  const config = rel(snap, configPath(snap.root));
  return lintSteeringFiles(files, snap.config.steeringBudget, matches).map(i => {
    const path = i.file.startsWith('steering/') ? byName.get(i.file.slice('steering/'.length)) : undefined;
    return {
      file: path ? rel(snap, path) : config,
      line: path ? i.line ?? 1 : 1,
      severity: severity(i), rule: i.rule, message: i.msg,
    };
  });
}

/**
 * One error on line 1 of each file steno cannot use: an Unreadable configuration (`config/unreadable`), each file of an
 * Unusable Spec (`spec/unsupported` or `spec/unreadable`) and each Unreadable steering file (`steering/unreadable`).
 */
export function readDiagnostics(snap: ProjectSnapshot): Diagnostic[] {
  const config = rel(snap, configPath(snap.root));
  if (!snap.setUp) {
    // The other reason a project is not set up is a missing `.steno/`, which has no file to put a Diagnostic on.
    const unreadable = snap.reason?.startsWith('.steno/config.yaml');
    return unreadable ? [{ file: config, line: 1, severity: 'error', rule: 'config/unreadable', message: snap.reason! }] : [];
  }
  const out: Diagnostic[] = [];
  for (const e of snap.specs) {
    if ('spec' in e) continue;
    for (const f of e.files) out.push({ file: rel(snap, f.file), line: 1, severity: 'error', rule: `spec/${e.flag}`, message: f.reason, spec: e.name });
  }
  for (const e of snap.steering) {
    if (e.unreadable !== undefined) out.push({ file: rel(snap, e.file), line: 1, severity: 'error', rule: 'steering/unreadable', message: e.unreadable });
  }
  return out;
}

/** A warning on the configuration path, at its line, for each key that was ignored or replaced by its default. */
export function configDiagnostics(snap: ProjectSnapshot): Diagnostic[] {
  if (!snap.setUp) return [];
  const file = rel(snap, configPath(snap.root));
  return snap.configWarnings.map(w => w.kind === 'unknown-key'
    ? { file, line: w.line, severity: 'warning', rule: 'config/unknown-key', message: `unknown key "${w.key}" is ignored` }
    : { file, line: w.line, severity: 'warning', rule: 'config/invalid-value', message: `invalid value for "${w.key}"; using the default ${JSON.stringify(w.default)}` });
}

/**
 * Every Diagnostic of a project, as the server publishes them: lint of each usable Spec and of the steering files, read
 * errors and configuration warnings. For a snapshot that is not set up, only the `config/unreadable` error when that is
 * the cause.
 */
export function projectDiagnostics(snap: ProjectSnapshot, matches?: Map<string, number>): Diagnostic[] {
  if (!snap.setUp) return readDiagnostics(snap);
  return [
    ...snap.specs.flatMap(e => ('spec' in e ? specDiagnostics(snap, e.name) : [])),
    ...steeringDiagnostics(snap, matches),
    ...readDiagnostics(snap),
    ...configDiagnostics(snap),
  ];
}

