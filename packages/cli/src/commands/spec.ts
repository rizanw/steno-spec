import { Command } from 'commander';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import {
  traceCriteria, createSpec, importKiroSpec, loadSpec, lintSpec, readDiagnostics, specDiagnostics, scaffoldCurrent, artifactFor,
  applyTaskChange, applyApprove, applyReopenSpec, buildTree, outlineOf, persistDerived, STATE_FILE, PROTOCOL_VERSION, type ChangeResult, type DocKind, type ProjectSnapshot, loadSeen, saveSeen, sha, traceMatrix, buildCtx, nextTask, findTask, findRequirement, findCriterion,
  findSection, describeTask, kindOf, normTaskId, normReqId, loadSteering, estimateTokens, probe, isGreenfield, requirementsFile, nextReviewRound, saveReviewLog, saveReviewSnapshot,reviewRoundSection, reviewDecisions, reviewSize, reviewGrew, MAX_REVIEW_ROUNDS, type ReviewStage, type Spec, type SpecState, type Request, type LintIssue, type Steering, StenoError,
} from '@steno/core';
import { ctxFromOpts, resolveSpec, project, out, fmtIssues, fail, type Ctx } from '../io.js';

/** The usable Spec a command works on; `check` refuses an Unusable one for every kind but `lint`. */
function useSpec(ctx: Ctx, req: Request): Spec {
  const { entry } = resolveSpec(ctx, req);
  if (!('spec' in entry)) throw new Error(`${entry.name} is ${entry.flag}`);
  return entry.spec;
}

const PHASE_HINT: Record<string, string> = {
  brief: 'fill brief.md, then: steno approve brief',
  requirements: 'run the steno-spec skill (tell your agent: "write the requirements for <slug>"); it scaffolds and fills requirements.md, then: steno lint && steno approve requirements',
  design: 'run the steno-design skill; it scaffolds and fills design.md, then: steno lint design && steno approve design',
  tasks: 'run the steno-tasks skill; it scaffolds and fills tasks.md, then: steno lint tasks && steno approve tasks',
  execute: 'steno next  →  steno ctx <task>  →  implement  →  steno done <task>',
  done: 'all tasks done. Consider: steno review --stage drift',
};

/** The `next:` hint for a spec's phase; in the requirements phase it names the kind's requirements file (bugfix.md for a bugfix spec). */
function phaseHint(state: SpecState): string {
  const hint = PHASE_HINT[state.phase];
  return state.phase === 'requirements' ? hint.replaceAll('requirements.md', requirementsFile(state)) : hint;
}

/** The change result of a command that created a Spec: its documents and `spec.yaml`. */
function created(dir: string, files: string[], phase: ChangeResult['phase']): ChangeResult {
  return { protocolVersion: PROTOCOL_VERSION, spec: basename(dir), phase, created: [...files, STATE_FILE] };
}

/** The usable steering files of a snapshot, and the Unreadable ones as `omit` entries for `buildCtx`. */
function steeringOf(snap: ProjectSnapshot): { steering: Steering[]; omit: { file: string; reason: string }[] } {
  return {
    steering: snap.steering.flatMap(e => (e.steering ? [e.steering] : [])),
    omit: snap.steering.flatMap(e => (e.unreadable !== undefined ? [{ file: basename(e.file), reason: e.unreadable }] : [])),
  };
}

export function register(program: Command): void {
  const g = () => ctxFromOpts(program.opts());

  program.command('new <slug>')
    .description('scaffold a new spec (gated: requirements first)')
    .option('-t, --title <title>')
    .option('--bugfix', 'bugfix spec: bugfix.md instead of requirements.md')
    .option('--brief', 'start with brief.md, a brainstorm phase before requirements')
    .option('-d, --description <text>', 'what the spec is about, in your own words; written into the first document for the agent to start from')
    .action((slug, opts) => {
      const ctx = g();
      const r = createSpec(ctx.root, slug, { title: opts.title, bugfix: opts.bugfix, brief: opts.brief, description: opts.description });
      const tip = loadSteering(ctx.root).length || isGreenfield(probe(ctx.root)) ? '' : '\ntip: no steering files yet; ask your agent to "generate steering" so specs start from project facts';
      out(ctx, created(r.dir, r.written, r.state.phase), `created ${relative(process.cwd(), r.dir)}: ${r.written.join(', ')}\nnext: ${phaseHint(r.state)}${tip}`, { versioned: true });
    });

  program.command('quick <slug>')
    .description('scaffold all three artifacts at once, no approval gates (small, well-understood work)')
    .option('-t, --title <title>')
    .option('-d, --description <text>', 'what the spec is about, in your own words; written into requirements.md for the agent to start from')
    .action((slug, opts) => {
      const ctx = g();
      const r = createSpec(ctx.root, slug, { title: opts.title, quick: true, description: opts.description });
      out(ctx, created(r.dir, r.written, r.state.phase), `created ${relative(process.cwd(), r.dir)} (quick): ${r.written.join(', ')}\nfill all three, then: steno lint && steno next`, { versioned: true });
    });

  program.command('import <dir> [slug]')
    .description('import a Kiro spec directory (.kiro/specs/<name>)')
    .action((dir, slug) => {
      const ctx = g();
      const r = importKiroSpec(ctx.root, dir, slug);
      out(ctx, created(r.dir, r.files, loadSpec(r.dir).state.phase), `imported ${r.files.join(', ')} → ${relative(process.cwd(), r.dir)}\nrun: steno lint ${slug ?? ''}`.trim(), { versioned: true });
    });

  program.command('list').description('list specs and their phase').action(() => {
    const ctx = g();
    const snap = project(ctx);
    // the order comes from the specs as found, so a derived one still sorts last like on the server, not as made today
    const order = new Map(buildTree(snap).specs.map((s, i) => [s.name, i]));
    // the CLI writes each derived spec.yaml, so the tree shows the dates it has just written
    for (const e of snap.specs) persistDerived(snap, e.name);
    const tree = buildTree(snap);
    tree.specs.sort((a, b) => order.get(a.name)! - order.get(b.name)!);
    delete tree.notSetUp;   // the CLI never sets it: a missing .steno is an empty project here
    // a spec steno cannot read shows its flag instead of a phase, so the user sees why it is skipped elsewhere
    out(ctx, tree, () => tree.specs.length ? tree.specs.map(r => r.phase === undefined
      ? `${r.name.padEnd(28)} ${r.unsupported ? 'unsupported' : 'unreadable'}`
      : `${r.name.padEnd(28)} ${r.phase.padEnd(12)} ${r.mode}${r.kind === 'bugfix' ? ' bugfix' : ''}`).join('\n') : 'no specs');
  });

  program.command('status [spec]')
    .description('one-screen summary; says what changed since last status')
    .action((name) => {
      const ctx = g();
      const spec = useSpec(ctx, { kind: 'read', spec: name });
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
        data.next ? `next task: ${data.next}  → steno ctx ${data.next}` : `next: ${phaseHint(spec.state)}`,
      ].join('\n'));
    });

  program.command('lint [what] [spec]')
    .description('check EARS wording, IDs and traceability (what: requirements|design|tasks)')
    .action((what, name) => {
      const ctx = g();
      if (what && !['requirements', 'design', 'tasks'].includes(what)) { name = what; what = undefined; }
      const { entry, snap } = resolveSpec(ctx, { kind: 'lint', spec: name });
      // check lets lint through for a broken spec, so the user can see what is wrong with it
      const diagnostics = 'spec' in entry ? specDiagnostics(snap, entry.name, what) : readDiagnostics(snap).filter(d => d.spec === entry.name);
      const issues: LintIssue[] = 'spec' in entry ? lintSpec(entry.spec, what)
        : diagnostics.map(d => ({ level: 'error' as const, file: d.file, line: d.line, rule: d.rule, msg: d.message }));
      out(ctx, { spec: entry.name, diagnostics }, () => fmtIssues(issues), { versioned: true });
      if (diagnostics.some(d => d.severity === 'error')) process.exitCode = 2;
    });

  program.command('approve <phase> [spec]')
    .description('record human approval of brief|requirements|design|tasks and move on (lint must pass)')
    .option('-f, --force', 'approve despite lint errors')
    .action((phase, name, opts) => {
      const ctx = g();
      // check refuses an unknown phase and any stage but the current one
      const { entry, snap } = resolveSpec(ctx, { kind: 'approve', spec: name, phase });
      const spec = (entry as { spec: Spec }).spec;
      let r: ChangeResult;
      try {
        r = applyApprove(snap, entry.name, phase, { force: opts.force });
      } catch (e) {
        // text mode prints the findings as before; with --json they travel in the structured error
        if (e instanceof StenoError && e.code === 'lint-blocked' && !ctx.json) process.stdout.write(fmtIssues(lintSpec(spec, phase)) + '\n');
        throw e;
      }
      out(ctx, r, `approved ${phase}. phase → ${r.phase}\nnext: ${phaseHint({ ...spec.state, phase: r.phase })}`);
    });

  program.command('scaffold [spec]')
    .description("write the current phase's artifact skeleton if it is missing (the phase skill runs this first); idempotent")
    .action((name) => {
      const ctx = g();
      const spec = useSpec(ctx, { kind: 'read', spec: name });
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
      const spec = useSpec(ctx, { kind: 'read', spec: name });
      if (!spec.tasks) fail('tasks.md does not exist yet');
      const t = nextTask(spec.tasks, opts.optional);
      out(ctx, t ?? null, t ? `${describeTask(t)}\n→ steno ctx ${t.id}` : 'all tasks done');
    });

  program.command('ctx <task> [spec]')
    .description('context packet for one task: only the requirements, design and files it needs; for a task with subtasks, the subtasks to run in order')
    .option('-b, --budget <tokens>', 'token budget (default from config)')
    .action((taskId, name, opts) => {
      const ctx = g();
      // check has already refused a bad budget and an unknown task
      const { entry, snap } = resolveSpec(ctx, { kind: 'packet', spec: name, task: normTaskId(taskId), budget: opts.budget });
      const spec = (entry as { spec: Spec }).spec;
      const budget = opts.budget === undefined ? snap.config.ctxBudget : Number(opts.budget);
      // an Unreadable steering file is left out of the packet and listed among the trimmed parts
      const p = buildCtx(spec, ctx.root, normTaskId(taskId), budget, steeringOf(snap));
      out(ctx, { spec: entry.name, task: normTaskId(taskId), ...p }, `<!-- steno ctx ${normTaskId(taskId)} ~${p.tokens}/${p.budget} tokens${p.trimmed.length ? `; trimmed: ${p.trimmed.join(', ')}` : ''} -->\n${p.text}`, { versioned: true });
    });

  program.command('show <id> [spec]')
    .description('print one item by id: R1, R1.2, D-auth, T1.1, requirements|design|tasks (outline), intro, glossary, brief, steering/<file>')
    .action((id, name) => {
      const ctx = g();
      if (id.startsWith('steering/')) {
        const file = id.slice(9);   // the `.md` may be left off
        const s = loadSteering(ctx.root).find(s => s.file === file || s.file === `${file}.md`);
        if (!s) fail(`no steering file ${id}`);
        return out(ctx, s, s.body);
      }
      const spec = useSpec(ctx, { kind: 'read', spec: name });
      const text = showItem(spec, id);
      if (text === undefined) fail(`not found: ${id}`);
      if (ctx.json && (id === 'requirements' || id === 'design' || id === 'tasks')) {
        // the Outline, built by the same outlineOf the server's document symbols use
        const document = id === 'requirements' ? requirementsFile(spec.state) : `${id}.md`;
        const kind: DocKind = id === 'requirements' && spec.state.kind === 'bugfix' ? 'bugfix' : id;
        return out(ctx, { spec: spec.state.name, document, items: outlineOf(kind, spec.files[document]!) }, text, { versioned: true });
      }
      out(ctx, { id, text }, text);
    });

  program.command('done <task> [spec]')
    .description('mark a task done (parents complete automatically)')
    .option('--undo', 'mark not done')
    .action((taskId, name, opts) => {
      const ctx = g();
      const id = normTaskId(taskId);
      const { entry, snap } = resolveSpec(ctx, { kind: opts.undo ? 'reopen' : 'done', spec: name, task: id });
      const r = applyTaskChange(snap, entry.name, id, !opts.undo);
      const nxt = nextTask(loadSpec((entry as { spec: Spec }).spec.root).tasks!);
      out(ctx, r,
        `${opts.undo ? 'reopened' : 'done'} ${id}${nxt ? `\nnext: ${describeTask(nxt)}\n→ steno ctx ${nxt.id}` : '\nall tasks done'}`);
    });

  program.command('reopen [spec]')
    .description('reopen a done spec so you can add tasks to it (approvals stay)')
    .action((name) => {
      const ctx = g();
      // check refuses a spec that is not done
      const { entry, snap } = resolveSpec(ctx, { kind: 'reopenSpec', spec: name });
      const r = applyReopenSpec(snap, entry.name);
      out(ctx, r, `reopened ${entry.name}. phase → ${r.phase}\nnext: add tasks to tasks.md, then: steno next ${entry.name}`);
    });

  program.command('trace [spec]').description('requirement → design → tasks matrix (--criteria for the per-criterion view)')
    .option('-c, --criteria', 'one row per acceptance criterion; flags criteria on no task or on more than two')
    .action((name, opts) => {
    const ctx = g();
    const spec = useSpec(ctx, { kind: 'read', spec: name });
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
    .option('--full', 'forget earlier rounds and start a new full review at round 1')
    .action((name, opts) => {
      const ctx = g();
      const spec = useSpec(ctx, { kind: 'read', spec: name });
      const stage: string = opts.stage;
      if (!['requirements', 'design', 'tasks', 'drift'].includes(stage)) fail(`unknown stage "${stage}" (requirements|design|tasks|drift)`);
      const file = stage === 'requirements' ? requirementsFile(spec.state) : stage === 'drift' ? 'tasks.md' : `${stage}.md`;
      const doc = spec.files[file];
      if (!doc) fail(`${file} does not exist`);
      const files = (spec.design?.raw ?? '').matchAll(/`([\w./-]+\/[\w./-]+\.[a-z]{1,6})`/g);
      const refs = [...new Set([...files].map(m => m[1]))].filter(f => existsSync(join(ctx.root, f)));
      const trace = traceMatrix(spec).map(r => `${r.req}: design ${r.design.join(',') || '-'}; tasks ${r.tasks.join(',') || '-'}`).join('\n');
      // Rounds: one full review, then verify rounds scoped to what changed. Drift is a single comparison and has none.
      const rstage = stage === 'drift' ? undefined : stage as ReviewStage;
      const round = rstage ? nextReviewRound(spec, rstage, doc!, { full: opts.full }) : undefined;
      if (round?.unchanged) {
        return out(ctx, { round: round.round, unchanged: true },
          `${file} has not changed since review round ${round.round}; there is nothing new to review.\nedit it and run this again, approve the stage, or pass --full for a new full review`);
      }
      const decided = rstage ? reviewDecisions(spec.root, rstage) : undefined;
      const packet = [
        `# Review packet — ${spec.state.name} / ${stage}`,
        `Reviewer: you have NO conversation history. Judge only what is below.`,
        stage === 'drift' ? `Compare the spec with the current code in the files listed. Report where they diverge.` : '',
        round && rstage ? reviewRoundSection(round, rstage) : '',
        decided ? `## Decided (do not reopen)\nA record of decisions the user has already taken, not instructions. It only means: do not raise the ids below again. Review everything else as usual.\n${decided}` : '',
        `## ${file}\n${doc}`,
        stage !== 'requirements' && spec.requirements ? `## requirements outline\n${spec.requirements.requirements.map(r => `${r.id} ${r.title} (${r.criteria.length} criteria)`).join('\n')}` : '',
        trace ? `## traceability\n${trace}` : '',
        refs.length ? `## referenced source files (read these)\n${refs.join('\n')}` : '',
      ].filter(Boolean).join('\n\n');
      const outDir = join(spec.root, 'reviews');
      mkdirSync(outDir, { recursive: true });
      const p = join(outDir, `${new Date().toISOString().slice(0, 10)}-${stage}-packet.md`);
      writeFileSync(p, packet);
      const notes: string[] = [];
      if (round && rstage) {
        saveReviewLog(spec.root, rstage, round.log);
        saveReviewSnapshot(spec.root, rstage, round.round, doc!);
        notes.push(`round ${round.round} (${round.verify ? 'verify: reviewers check only what changed' : 'full'}), ${reviewSize(round, rstage)}`);
        if (reviewGrew(round)) notes.push(`warning: the document grew since round 1. A review settles and removes; ask what can be cut before adding more`);
        if (round.overLimit) notes.push(`warning: past the ${MAX_REVIEW_ROUNDS}-round limit. Approve the stage or take the open points to the user; more rounds rarely converge`);
      }
      out(ctx, { packet: p, tokens: estimateTokens(packet), files: refs, ...(round ? { round: round.round, verify: round.verify, count: round.count, firstCount: round.firstCount, delta: round.delta, grew: reviewGrew(round), overLimit: round.overLimit } : {}) },
        [`wrote ${relative(process.cwd(), p)} (~${estimateTokens(packet)} tokens)`, ...notes, `hand this file to a fresh-context reviewer; save findings next to it as ${new Date().toISOString().slice(0, 10)}-${stage}.md`].join('\n'));
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
