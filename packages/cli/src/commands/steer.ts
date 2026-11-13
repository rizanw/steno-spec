import { Command } from 'commander';
import { relative } from 'node:path';
import { scan, writeSteering, lintSteering, listSteering, templateFor, extractSchema, formatSchema, STEERING_TOPICS, GREENFIELD_MSG, loadConfig,
  steeringDiagnostics, steeringMatches, readDiagnostics, configDiagnostics, type Suggestion, type LintIssue } from '@steno/core';
import { ctxFromOpts, project, out, fmtIssues, fail } from '../io.js';

function fmtSuggestion(s: Suggestion): string {
  const where = s.inclusion === 'fileMatch' ? `"${s.pattern}"` : s.inclusion;
  return `  ${s.file.padEnd(14)} ${s.exists ? 'exists' : s.strength === 'weak' ? 'weak  ' : 'new   '}  ${where}\n${''.padEnd(26)}${s.reason}${s.read.length ? `\n${''.padEnd(26)}read: ${s.read.join(', ')}` : ''}`;
}

export function register(program: Command): void {
  const g = () => ctxFromOpts(program.opts());
  const steer = program.command('steer').description('project steering: scan the repo, scaffold, lint and list steering files');

  steer.command('scan')
    .description('fingerprint the repo (manifests and folders only) and suggest steering files; zero tokens')
    .action(() => {
      const ctx = g();
      const r = scan(ctx.root);
      if (r.greenfield) return out(ctx, r, `# steno steer scan  (${r.scanned.files} files, ${r.sourceFiles} source, 0 manifests)\n${GREENFIELD_MSG}`);
      const missing = r.suggestions.filter(s => !s.exists && s.strength !== 'weak');
      const weak = r.suggestions.filter(s => !s.exists && s.strength === 'weak');
      const p = r.profile;
      out(ctx, r, () => [
        `# steno steer scan  (${r.scanned.dirs} dirs, ${r.scanned.files} files, ${p.manifests.length} manifests)`,
        `languages: ${p.languages.join(', ') || '?'}   frameworks: ${p.frameworks.join(', ') || 'none detected'}`,
        `package manager: ${p.packageManager ?? '?'}   tests: ${p.testRunner ?? '?'}   monorepo: ${p.monorepo ? 'yes' : 'no'}`,
        `top-level: ${p.topLevel.slice(0, 10).map(t => `${t.dir} (${t.files})`).join('  ')}`,
        '',
        `steering in ${loadConfig(ctx.root).steeringDir}: ${r.suggestions.filter(s => s.exists).length} of ${r.suggestions.length} suggested files exist`,
        ...r.suggestions.map(fmtSuggestion),
        '',
        ...(weak.length ? [`weak evidence (not written by --all; add one with steno steer new <file>, or all with --all --weak): ${weak.map(s => s.file).join(', ')}`] : []),
        missing.length ? `next: steno steer new --all   (or: steno steer new ${missing[0].file})  then fill each file and run: steno steer lint` : 'next: steno steer lint',
      ].join('\n'));
    });

  steer.command('new [file]')
    .description(`write a steering skeleton (known topics: ${STEERING_TOPICS.join(', ')}; any kebab-case name works)`)
    .option('-m, --match <globs>', 'fileMatchPattern: comma list of globs (implies --inclusion fileMatch)')
    .option('-i, --inclusion <mode>', 'always | fileMatch | manual (default: what scan suggests)')
    .option('--all', 'write the core three and every strong suggestion that does not exist yet')
    .option('--weak', 'with --all: also write weak suggestions (one or two files of evidence)')
    .option('-f, --force', 'overwrite an existing file; with --all, also write in a greenfield folder')
    .action((file, opts) => {
      const ctx = g();
      if (opts.all && !opts.force && scan(ctx.root).greenfield) fail(GREENFIELD_MSG);
      const inclusion = opts.inclusion as 'always' | 'fileMatch' | 'manual' | undefined;
      if (inclusion && !['always', 'fileMatch', 'manual'].includes(inclusion)) fail(`inclusion must be always | fileMatch | manual`);
      const written: { file: string; inclusion: string; pattern?: string }[] = [];
      if (opts.all) {
        for (const s of scan(ctx.root).suggestions.filter(s => !s.exists && (opts.weak || s.strength !== 'weak'))) {
          const r = writeSteering(ctx.root, s.file, { inclusion: s.inclusion, pattern: s.pattern });
          written.push({ file: relative(process.cwd(), r.path), inclusion: r.inclusion, pattern: r.pattern });
        }
      } else {
        if (!file) fail('name a file (steno steer new database.md) or pass --all');
        const r = writeSteering(ctx.root, file, { inclusion: opts.match ? 'fileMatch' : inclusion, pattern: opts.match, force: opts.force });
        written.push({ file: relative(process.cwd(), r.path), inclusion: r.inclusion, pattern: r.pattern });
      }
      out(ctx, { written }, () => [
        ...written.map(w => `wrote ${w.file}  [${w.inclusion}${w.pattern ? ` ${w.pattern}` : ''}]`),
        written.length ? 'fill the headings with facts (real paths, commands, names), delete the ones that do not apply, then: steno steer lint' : 'nothing to write',
      ].join('\n'));
    });

  steer.command('template <file>')
    .description('print the skeleton `steer new` would write, to see the expected shape of an existing file without overwriting it')
    .action((file) => { const ctx = g(); const text = templateFor(ctx.root, file); out(ctx, { file, text }, text); });

  steer.command('schema')
    .description('print the database schema, one compact line per table with foreign keys, from SQL migrations or schema.prisma; paste into database.md')
    .option('--full', 'keep timestamps and back-relations')
    .action((opts) => {
      const ctx = g();
      const s = extractSchema(ctx.root);
      out(ctx, s, formatSchema(s, { full: opts.full }) + (s.source === 'none' ? '' : '\n\nlegend: pk in (); →table = foreign key; ? nullable; ! unique; =gen generated; parent ← children'));
    });

  steer.command('lint')
    .description('check steering files: frontmatter, patterns that match nothing, size, placeholders, the always-budget')
    .action(() => {
      const ctx = g();
      const snap = project(ctx);
      // the builders the server calls, plus the no-match warning only this command gives
      const lint = steeringDiagnostics(snap, steeringMatches(ctx.root));
      // Unreadable steering files and configuration warnings, which lintSteering does not see
      const extra = [...readDiagnostics(snap).filter(d => d.rule === 'steering/unreadable'), ...configDiagnostics(snap)];
      const diagnostics = [...lint, ...extra];
      const issues: LintIssue[] = [
        ...lintSteering(ctx.root),
        ...extra.map(d => ({ level: d.severity === 'error' ? 'error' as const : 'warn' as const, file: d.file, line: d.line, rule: d.rule, msg: d.message })),
      ];
      out(ctx, { diagnostics }, () => fmtIssues(issues), { versioned: true });
      if (diagnostics.some(d => d.severity === 'error')) process.exitCode = 2;
    });

  steer.command('list')
    .description('steering files with inclusion, pattern, token cost and how many repo files each pattern matches')
    .action(() => {
      const ctx = g();
      const r = listSteering(ctx.root);
      out(ctx, r, () => r.rows.length ? [
        ...r.rows.map(x => `${x.file.padEnd(14)} ${x.inclusion.padEnd(9)} ~${String(x.tokens).padStart(4)} tok  ${x.matches !== undefined ? `${x.matches} files  ` : ''}${x.pattern ?? ''}`),
        `always: ~${r.alwaysTokens}/${r.budget} tokens enter every ctx packet`,
      ].join('\n') : `no steering files in ${loadConfig(ctx.root).steeringDir}. Run: steno steer scan`);
    });
}
