import { statSync } from 'node:fs';
import { join } from 'node:path';
import {
  findProjectRoot, loadProject, persistDerived, check, StenoError,
  type ProjectSnapshot, type SpecEntry, type Request, type Task, type LintIssue,
} from '@steno/core';

export interface Ctx { root: string; json: boolean }

export function ctxFromOpts(opts: { json?: boolean; root?: string }): Ctx {
  return { root: findProjectRoot(opts.root ?? process.cwd()), json: !!opts.json };
}

const isDir = (p: string) => { try { return statSync(p).isDirectory(); } catch { return false; } };

/**
 * The project for a command that takes no Spec. Throws `not-set-up` when the configuration is Unreadable;
 * a missing `.steno/` is left to the command, as before.
 */
export function project(ctx: Ctx): ProjectSnapshot {
  const snap = loadProject(ctx.root);
  if (!snap.setUp && isDir(join(snap.root, '.steno')))
    throw new StenoError('not-set-up', snap.reason ?? `${snap.root} is not set up; run steno init`, { reason: snap.reason });
  return snap;
}

/**
 * Pick the Spec a command works on through `check` (steps 1 to 6 of the refusal order), refusing Unusable ones, then
 * write the derived `spec.yaml` of the entry it returns. Returns the snapshot too, for the commands that need it.
 */
export function resolveSpec(ctx: Ctx, req: Request): { entry: SpecEntry; task?: Task; snap: ProjectSnapshot } {
  const snap = loadProject(ctx.root);
  const r = check(req, snap, { cli: true });
  persistDerived(snap, r.entry.name);
  return { ...r, snap };
}

export function out(ctx: Ctx, data: unknown, text: string | (() => string)): void {
  if (ctx.json) process.stdout.write(JSON.stringify(data, null, 2) + '\n');
  else process.stdout.write((typeof text === 'function' ? text() : text) + '\n');
}

export function fmtIssues(issues: LintIssue[]): string {
  if (!issues.length) return 'ok: no issues';
  const lines = issues.map(i => `${i.level === 'error' ? 'E' : 'W'} ${i.file}${i.line ? `:${i.line}` : ''}${i.id ? ` ${i.id}` : ''}  ${i.msg}  [${i.rule}]`);
  const e = issues.filter(i => i.level === 'error').length;
  lines.push(`${e} error${e === 1 ? '' : 's'}, ${issues.length - e} warning${issues.length - e === 1 ? '' : 's'}`);
  return lines.join('\n');
}

/** Stop the command with a `failed` error; `main.ts` reports it. */
export function fail(msg: string): never { throw new StenoError('failed', msg); }
