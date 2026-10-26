import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  traceCriteria, createSpec, importKiroSpec, listSpecs, loadSpec, specDir, lintSpec, hasErrors, saveState, scaffoldCurrent, artifactFor,
  derivePhase, approvalError, syncDonePhase, allTasksDone, loadSeen, saveSeen, sha, traceMatrix, loadConfig, buildCtx, nextTask, setTaskDone, findTask, findRequirement, findCriterion,
  findSection, describeTask, kindOf, normTaskId, normReqId, loadSteering, estimateTokens, probe, isGreenfield, type Spec,
} from '@steno/core';
import { ctxFromOpts, resolveSpec, out, fmtIssues, fail } from '../io.js';

const PHASE_HINT: Record<string, string> = {
  brief: 'fill brief.md, then: steno approve brief',
  requirements: 'run the steno-spec skill (tell your agent: "write the requirements for <slug>"); it scaffolds and fills requirements.md, then: steno lint && steno approve requirements',
  design: 'run the steno-design skill; it scaffolds and fills design.md, then: steno lint design && steno approve design',
  tasks: 'run the steno-tasks skill; it scaffolds and fills tasks.md, then: steno lint tasks && steno approve tasks',
  execute: 'steno next  →  steno ctx <task>  →  implement  →  steno done <task>',
  done: 'all tasks done. Consider: steno review --stage drift',
};

export function register(program: Command): void {
  const g = () => ctxFromOpts(program.opts());

  program.command('new <slug>')
    .description('scaffold a new spec (gated: requirements first)')
    .option('-t, --title <title>')
    .option('--bugfix', 'bugfix spec: bugfix.md instead of requirements.md')
    .option('--brief', 'also create brief.md for a brainstorm phase')
    .action((slug, opts) => {
      const ctx = g();
      const r = createSpec(ctx.root, slug, { title: opts.title, bugfix: opts.bugfix, brief: opts.brief });
      const tip = loadSteering(ctx.root).length || isGreenfield(probe(ctx.root)) ? '' : '\ntip: no steering files yet; ask your agent to "generate steering" so specs start from project facts';
      out(ctx, r, `created ${relative(process.cwd(), r.dir)}: ${r.written.join(', ')}\nnext: ${PHASE_HINT[r.state.phase]}${tip}`);
    });

  program.command('quick <slug>')
    .description('scaffold all three artifacts at once, no approval gates (small, well-understood work)')
    .option('-t, --title <title>')
    .action((slug, opts) => {
      const ctx = g();
      const r = createSpec(ctx.root, slug, { title: opts.title, quick: true });
      out(ctx, r, `created ${relative(process.cwd(), r.dir)} (quick): ${r.written.join(', ')}\nfill all three, then: steno lint && steno next`);
    });

  program.command('import <dir> [slug]')
    .description('import a Kiro spec directory (.kiro/specs/<name>)')
    .action((dir, slug) => {
      const ctx = g();
      const r = importKiroSpec(ctx.root, dir, slug);
      out(ctx, r, `imported ${r.files.join(', ')} → ${relative(process.cwd(), r.dir)}\nrun: steno lint ${slug ?? ''}`.trim());
    });

  program.command('list').description('list specs and their phase').action(() => {
    const ctx = g();
    const rows = listSpecs(ctx.root).map(n => { const s = loadSpec(specDir(ctx.root, n)); return { name: n, phase: s.state.phase, mode: s.state.mode, kind: s.state.kind }; });
    out(ctx, rows, rows.length ? rows.map(r => `${r.name.padEnd(28)} ${r.phase.padEnd(12)} ${r.mode}${r.kind === 'bugfix' ? ' bugfix' : ''}`).join('\n') : 'no specs');
  });

  program.command('status [spec]')
    .description('one-screen summary; says what changed since last status')
    .action((name) => {
      const ctx = g();
      const spec = resolveSpec(ctx, name);
      const tasks = spec.tasks?.tasks ?? [];
      const leaves = tasks.filter(t => t.children.length === 0);
      const done = leaves.filter(t => t.done).length;
      const issues = lintSpec(spec);
      const errs = issues.filter(i => i.level === 'error').length;
      const changed: string[] = [];
      const seen = loadSeen(ctx.root, spec.state.name);
      const now: Record<string, string> = {};
      for (const [f, text] of Object.entries(spec.files)) { now[f] = sha(text); if (seen[f] !== now[f]) changed.push(f); }
      // --json is read-only, so an agent polling status does not reset what the human sees as changed.
      const stale = changed.length > 0 || Object.keys(seen).some(f => !(f in now));
      if (!ctx.json && stale) saveSeen(ctx.root, spec.state.name, now);
      const data = {
        spec: spec.state.name, title: spec.state.title, phase: spec.state.phase, mode: spec.state.mode, kind: spec.state.kind,
        approvals: spec.state.approvals,
        requirements: spec.requirements?.requirements.length ?? 0,
        criteria: spec.requirements?.requirements.reduce((n, r) => n + r.criteria.length, 0) ?? 0,
        designSections: spec.design?.sections.length ?? 0,
        tasks: { total: leaves.length, done },
        lint: { errors: errs, warnings: issues.length - errs },
        skeleton: issues.filter(i => i.rule === 'spec/placeholder').map(i => i.file),
        notStarted: (() => { const f = artifactFor(spec.state); return f && !spec.files[f] ? f : undefined; })(),
        changedSinceLastStatus: changed,
        steering: loadSteering(ctx.root).length,
        next: spec.state.phase === 'execute' ? nextTask(spec.tasks!)?.id : undefined,
      };
      out(ctx, data, () => [
        `${data.spec} — ${data.title}  [${data.kind}, ${data.mode}]`,
        `phase: ${data.phase}   approved: ${Object.keys(data.approvals).join(', ') || 'none'}`,
        `R ${data.requirements} (${data.criteria} criteria)   D ${data.designSections} sections   T ${data.tasks.done}/${data.tasks.total} done`,
        `lint: ${data.lint.errors} errors, ${data.lint.warnings} warnings${errs ? '  → steno lint' : ''}`,
        ...(data.notStarted ? [`${data.notStarted}: not started — run the steno-${({ brief: 'brainstorm', requirements: 'spec', design: 'design', tasks: 'tasks' } as Record<string, string>)[data.phase]} skill (it runs steno scaffold)`] : []),
        ...(data.skeleton.length ? [`skeleton: ${data.skeleton.join(', ')} still ${data.skeleton.length > 1 ? 'have' : 'has'} template placeholders — not written yet`] : []),
        `changed since last status: ${changed.length ? changed.join(', ') : 'nothing'}`,
        ...(data.steering || isGreenfield(probe(ctx.root)) ? [] : ['steering: none (ask your agent to "generate steering")']),
        data.next ? `next task: ${data.next}  → steno ctx ${data.next}` : `next: ${PHASE_HINT[data.phase]}`,
      ].join('\n'));
    });

  program.command('lint [what] [spec]')
    .description('check EARS wording, IDs and traceability (what: requirements|design|tasks)')
    .action((what, name) => {
      const ctx = g();
      if (what && !['requirements', 'design', 'tasks'].includes(what)) { name = what; what = undefined; }
      const spec = resolveSpec(ctx, name);
      const issues = lintSpec(spec, what);
      out(ctx, { spec: spec.state.name, issues }, fmtIssues(issues));
      if (hasErrors(issues)) process.exitCode = 2;
    });

  program.command('approve <phase> [spec]')
    .description('record human approval of brief|requirements|design|tasks and move on (lint must pass)')
    .option('-f, --force', 'approve despite lint errors')
    .action((phase, name, opts) => {
      const ctx = g();
      const spec = resolveSpec(ctx, name);
      if (!['brief', 'requirements', 'design', 'tasks'].includes(phase)) fail(`phase must be brief|requirements|design|tasks`);
      const gate = approvalError(spec.state, phase);
      if (gate) fail(gate);
      if (phase !== 'brief') {
        const issues = lintSpec(spec, phase);
        if (hasErrors(issues) && !opts.force) { process.stdout.write(fmtIssues(issues) + '\n'); fail(`fix errors first (or --force)`); }
        spec.state.approvals[phase as 'requirements'] = new Date().toISOString().slice(0, 10);
      }
      const allDone = !!spec.tasks && allTasksDone(spec.tasks);
      spec.state.phase = phase === 'brief' ? 'requirements' : derivePhase(spec.state, allDone);
      saveState(spec.root, spec.state);
      out(ctx, { spec: spec.state.name, approved: phase, phase: spec.state.phase },
        `approved ${phase}. phase → ${spec.state.phase}\nnext: ${PHASE_HINT[spec.state.phase]}`);
    });

  program.command('scaffold [spec]')
    .description("write the current phase's artifact skeleton if it is missing (the phase skill runs this first); idempotent")
    .action((name) => {
      const ctx = g();
      const spec = resolveSpec(ctx, name);
      const f = artifactFor(spec.state);
      if (!f) fail(`phase ${spec.state.phase} has no artifact to scaffold`);
      const written = scaffoldCurrent(spec);
      out(ctx, { spec: spec.state.name, phase: spec.state.phase, file: f, written: !!written },
        written ? `wrote ${f} skeleton. Replace every <…> placeholder; steno lint flags any left.` : `${f} already exists; nothing written.`);
    });

  program.command('next [spec]')
    .description('print the next unfinished task')
    .option('--optional', 'include optional (*) tasks')
    .action((name, opts) => {
      const ctx = g();
      const spec = resolveSpec(ctx, name);
      if (!spec.tasks) fail('tasks.md does not exist yet');
      const t = nextTask(spec.tasks, opts.optional);
      out(ctx, t ?? null, t ? `${describeTask(t)}\n→ steno ctx ${t.id}` : 'all tasks done');
    });

  program.command('ctx <task> [spec]')
    .description('context packet for one task: only the requirements, design and files it needs')
    .option('-b, --budget <tokens>', 'token budget (default from config)')
    .action((taskId, name, opts) => {
      const ctx = g();
      const spec = resolveSpec(ctx, name);
      const budget = Number(opts.budget ?? loadConfig(ctx.root).ctxBudget);
      if (!Number.isInteger(budget) || budget <= 0) fail(`budget must be a positive whole number of tokens, got "${opts.budget ?? budget}"`);
      const p = buildCtx(spec, ctx.root, normTaskId(taskId), budget);
      out(ctx, p, `<!-- steno ctx ${normTaskId(taskId)} ~${p.tokens}/${p.budget} tokens${p.trimmed.length ? `; trimmed: ${p.trimmed.join(', ')}` : ''} -->\n${p.text}`);
    });

  program.command('show <id> [spec]')
    .description('print one item by id: R1, R1.2, D-auth, T1.1, requirements|design|tasks (outline), intro, glossary, brief, steering/<file>')
    .action((id, name) => {
      const ctx = g();
      if (id.startsWith('steering/')) {
        const s = loadSteering(ctx.root).find(s => s.file === id.slice(9));
        if (!s) fail(`no steering file ${id}`);
        return out(ctx, s, s.body);
      }
      const spec = resolveSpec(ctx, name);
      const text = showItem(spec, id);
      if (text === undefined) fail(`not found: ${id}`);
      out(ctx, { id, text }, text);
    });

  program.command('done <task> [spec]')
    .description('mark a task done (parents complete automatically)')
    .option('--undo', 'mark not done')
    .action((taskId, name, opts) => {
      const ctx = g();
      const spec = resolveSpec(ctx, name);
      if (!spec.tasks) fail('tasks.md does not exist yet');
      const id = normTaskId(taskId);
      const raw = setTaskDone(spec.tasks, id, !opts.undo);
      writeFileSync(join(spec.root, 'tasks.md'), raw);
      const fresh = loadSpec(spec.root);
      if (syncDonePhase(fresh.state, allTasksDone(fresh.tasks!))) saveState(fresh.root, fresh.state);
      const nxt = nextTask(fresh.tasks!);
      out(ctx, { task: id, done: !opts.undo, next: nxt?.id ?? null, phase: fresh.state.phase },
        `${opts.undo ? 'reopened' : 'done'} ${id}${nxt ? `\nnext: ${describeTask(nxt)}\n→ steno ctx ${nxt.id}` : '\nall tasks done'}`);
    });

  program.command('trace [spec]').description('requirement → design → tasks matrix (--criteria for the per-criterion view)')
    .option('-c, --criteria', 'one row per acceptance criterion; flags criteria on no task or on more than two')
    .action((name, opts) => {
    const ctx = g();
    const spec = resolveSpec(ctx, name);
    if (opts.criteria) {
      const crows = traceCriteria(spec);
      const flag = (n: number) => n === 0 ? '  ← none' : n > 2 ? `  ← ${n} tasks` : '';
      return out(ctx, crows, crows.map(r => `${r.crit.padEnd(6)} tasks ${r.tasks.join(',') || '-'}  design ${r.design.join(',') || '-'}${flag(r.tasks.length)}`).join('\n') || 'no criteria');
    }
    const rows = traceMatrix(spec);
    out(ctx, rows, rows.map(r => `${r.req.padEnd(5)} ${r.title.slice(0, 30).padEnd(30)} crit ${r.criteria}  design ${r.design.join(',') || '-'}  tasks ${r.tasks.join(',') || '-'} (${r.tasksDone}/${r.tasks.length} done)`).join('\n') || 'no requirements');
  });

  program.command('review [spec]')
    .description('write a fresh-reviewer packet (document + referenced files) for a stage')
    .option('-s, --stage <stage>', 'requirements|design|tasks|drift', 'requirements')
    .action((name, opts) => {
      const ctx = g();
      const spec = resolveSpec(ctx, name);
      const stage: string = opts.stage;
      const file = stage === 'requirements' ? (spec.files['requirements.md'] ? 'requirements.md' : 'bugfix.md') : stage === 'drift' ? 'tasks.md' : `${stage}.md`;
      const doc = spec.files[file];
      if (!doc) fail(`${file} does not exist`);
      const files = (spec.design?.raw ?? '').matchAll(/`([\w./-]+\/[\w./-]+\.[a-z]{1,6})`/g);
      const refs = [...new Set([...files].map(m => m[1]))].filter(f => existsSync(join(ctx.root, f)));
      const trace = traceMatrix(spec).map(r => `${r.req}: design ${r.design.join(',') || '-'}; tasks ${r.tasks.join(',') || '-'}`).join('\n');
      const packet = [
        `# Review packet — ${spec.state.name} / ${stage}`,
        `Reviewer: you have NO conversation history. Judge only what is below.`,
        stage === 'drift' ? `Compare the spec with the current code in the files listed. Report where they diverge.` : '',
        `## ${file}\n${doc}`,
        stage !== 'requirements' && spec.requirements ? `## requirements outline\n${spec.requirements.requirements.map(r => `${r.id} ${r.title} (${r.criteria.length} criteria)`).join('\n')}` : '',
        trace ? `## traceability\n${trace}` : '',
        refs.length ? `## referenced source files (read these)\n${refs.join('\n')}` : '',
      ].filter(Boolean).join('\n\n');
      const outDir = join(spec.root, 'reviews');
      mkdirSync(outDir, { recursive: true });
      const p = join(outDir, `${new Date().toISOString().slice(0, 10)}-${stage}-packet.md`);
      writeFileSync(p, packet);
      out(ctx, { packet: p, tokens: estimateTokens(packet), files: refs }, `wrote ${relative(process.cwd(), p)} (~${estimateTokens(packet)} tokens)\nhand this file to a fresh-context reviewer; save findings next to it as ${new Date().toISOString().slice(0, 10)}-${stage}.md`);
    });
}

function showItem(spec: Spec, rawId: string): string | undefined {
  if (rawId === 'requirements') return spec.requirements?.requirements.map(r => `${r.id} ${r.title} (${r.criteria.length})`).join('\n');
  if (rawId === 'design') return spec.design?.sections.map(s => `${'  '.repeat(s.level - 2)}${s.id}  ${s.heading}${s.satisfies.length ? `  ← ${s.satisfies.join(', ')}` : ''}`).join('\n');
  if (rawId === 'tasks') return spec.tasks?.tasks.map(t => `${'  '.repeat(t.depth)}${describeTask(t)}`).join('\n');
  if (rawId === 'brief') return spec.brief;
  if (rawId === 'glossary') return spec.requirements?.glossary.map(g => `${g.term}: ${g.definition}`).join('\n');
  if (rawId === 'intro') return spec.requirements?.intro;
  const id = kindOf(rawId) === 'task' ? normTaskId(rawId) : normReqId(rawId);
  switch (kindOf(id)) {
    case 'requirement': { const r = spec.requirements && findRequirement(spec.requirements, id); return r && spec.requirements!.raw.split('\n').slice(r.line - 1, r.endLine).join('\n').trim(); }
    case 'criterion': { const c = spec.requirements && findCriterion(spec.requirements, id); return c && `${c.id} ${c.text}`; }
    case 'design': { const s = spec.design && findSection(spec.design, id); return s && `${'#'.repeat(s.level)} ${s.heading} {#${s.id}}\n${s.body}`; }
    case 'task': { const t = spec.tasks && findTask(spec.tasks, id); if (!t) return; const kids = t.children.map(c => findTask(spec.tasks!, c)!); return [describeTask(t), t.requirements.length ? `requirements: ${t.requirements.join(', ')}` : '', t.design.length ? `design: ${t.design.join(', ')}` : '', ...kids.map(k => '  ' + describeTask(k))].filter(Boolean).join('\n'); }
  }
  return undefined;
}
