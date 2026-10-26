import { findProjectRoot, loadConfig, listSpecs, loadSpec, specDir, type Spec, type LintIssue } from '@steno/core';

export interface Ctx { root: string; json: boolean }

export function ctxFromOpts(opts: { json?: boolean; root?: string }): Ctx {
  return { root: findProjectRoot(opts.root ?? process.cwd()), json: !!opts.json };
}

/** Resolve a spec: explicit name, else the only spec, else the one whose phase is not done. */
export function resolveSpec(ctx: Ctx, name?: string): Spec {
  const names = listSpecs(ctx.root);
  if (!names.length) throw new Error(`no specs under ${loadConfig(ctx.root).specsDir}. Run: steno new <slug>`);
  let pick = name;
  if (!pick) {
    if (names.length === 1) pick = names[0];
    else {
      const active = names.map(n => loadSpec(specDir(ctx.root, n))).filter(s => s.state.phase !== 'done');
      if (active.length === 1) pick = active[0].state.name;
      else throw new Error(`several specs; pass one of: ${names.join(', ')}`);
    }
  }
  if (!names.includes(pick)) throw new Error(`unknown spec "${pick}" (have: ${names.join(', ')})`);
  return loadSpec(specDir(ctx.root, pick));
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

export function fail(msg: string): never { process.stderr.write(`steno: ${msg}\n`); process.exit(1); }
