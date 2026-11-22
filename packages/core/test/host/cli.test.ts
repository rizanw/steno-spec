// New Spec, Set Up and the agent list over a fake `run`: the arguments each builds, the answer fields each checks,
// a CLI that cannot start, and Set Up refused inside another steno project.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { listAgents, newSpec, setUp, type NewSpecRequest, type RunCli } from '../../src/host/cli.js';
import type { CliExit } from '../../src/host/refusal.js';

const ROOT = '/work/app';

/** A `run` that records each call and answers with `exit`, its stdout given as a value to print as JSON. */
function fake(answer: Partial<Omit<CliExit, 'stdout'>> & { json?: unknown; stdout?: string } = {}) {
  const calls: { args: string[]; cwd: string }[] = [];
  const run: RunCli = async (args, cwd) => {
    calls.push({ args, cwd });
    return { code: answer.code === undefined ? 0 : answer.code, stdout: answer.stdout ?? JSON.stringify(answer.json ?? {}), stderr: answer.stderr ?? '' };
  };
  return { run, calls, args: () => calls[0]?.args };
}

const created = { protocolVersion: 1, spec: 'auth', phase: 'requirements', created: ['requirements.md', 'spec.yaml'] };
const installed = { root: ROOT, skills: ['steno-spec'], agents: { claude: `${ROOT}/.claude/skills` } };
const nowhere = () => false;

describe('newSpec', () => {
  it('reads no name, title or description as a flag', async () => {
    const text = fc.oneof(fc.string(), fc.string().map(s => `-${s}`), fc.string().map(s => `--${s}=x y`));
    const req: fc.Arbitrary<NewSpecRequest> = fc.record({
      kind: fc.constantFrom('feature' as const, 'bugfix' as const),
      writer: fc.constantFrom('agent' as const, 'brainstorm' as const, 'self' as const),
      name: text, title: fc.option(text, { nil: undefined }), description: fc.option(text, { nil: undefined }),
    });
    await fc.assert(fc.asyncProperty(req, async r => {
      const f = fake({ json: created });
      await newSpec(f.run, ROOT, r);
      const args = f.args()!;
      expect(args.slice(0, 4)).toEqual(['--root', ROOT, '--json', 'new']);
      const end = args.indexOf('--');
      expect(args.slice(end + 1)).toEqual([r.name]);
      // between `new` and `--`, only fixed flags and values joined to their own flag
      const about = r.description?.trim();
      expect(args.slice(4, end)).toEqual([
        ...(r.kind === 'bugfix' ? ['--bugfix'] : []),
        ...(r.kind === 'feature' && r.writer === 'brainstorm' ? ['--brief'] : []),
        ...(r.title ? [`--title=${r.title}`] : []),
        ...(about ? [`--description=${about}`] : []),
      ]);
    }));
  });

  it('builds the call each kind and writer asks for', async () => {
    const argsFor = async (r: NewSpecRequest) => { const f = fake({ json: created }); await newSpec(f.run, ROOT, r); return f.args(); };
    expect(await argsFor({ kind: 'feature', name: 'auth', writer: 'agent' })).toEqual(['--root', ROOT, '--json', 'new', '--', 'auth']);
    expect(await argsFor({ kind: 'bugfix', name: 'auth', title: 'Auth bug', writer: 'brainstorm' }))
      .toEqual(['--root', ROOT, '--json', 'new', '--bugfix', '--title=Auth bug', '--', 'auth']);
    expect(await argsFor({ kind: 'feature', name: 'auth', writer: 'brainstorm', title: '', description: '  login  ' }))
      .toEqual(['--root', ROOT, '--json', 'new', '--brief', '--description=login', '--', 'auth']);
    expect(await argsFor({ kind: 'feature', name: 'auth', writer: 'self', description: '   ' }))
      .toEqual(['--root', ROOT, '--json', 'new', '--', 'auth']);
  });

  it('runs in the root and gives the created spec, with or without its file list', async () => {
    const f = fake({ json: created });
    expect(await newSpec(f.run, ROOT, { kind: 'feature', name: 'auth', writer: 'agent' }))
      .toEqual({ ok: true, value: { spec: 'auth', phase: 'requirements', created: ['requirements.md', 'spec.yaml'] } });
    expect(f.calls[0].cwd).toBe(ROOT);
    const { created: _, ...bare } = created;
    expect(await newSpec(fake({ json: bare }).run, ROOT, { kind: 'feature', name: 'auth', writer: 'agent' }))
      .toEqual({ ok: true, value: { spec: 'auth', phase: 'requirements' } });
  });

  it('passes the refusal of a CLI that refused on exit 1 or 2 through unchanged', async () => {
    const refusal = { protocolVersion: 1, code: 'invalid-request', message: 'spec "auth" already exists', spec: 'auth' };
    for (const code of [1, 2]) {
      expect(await newSpec(fake({ code, json: refusal }).run, ROOT, { kind: 'feature', name: 'auth', writer: 'agent' }))
        .toEqual({ ok: false, error: refusal });
    }
  });

  it('fails a crash with the exit code, the first line of standard error and the whole stream as the log', async () => {
    const stderr = 'Error: boom\n    at x (cli.js:1:1)\n';
    expect(await newSpec(fake({ code: 3, stdout: 'not json', stderr }).run, ROOT, { kind: 'feature', name: 'auth', writer: 'agent' }))
      .toEqual({ ok: false, error: { protocolVersion: 1, code: 'failed', message: 'steno exited with code 3: Error: boom' }, log: stderr });
  });

  it('fails an answer with a missing or mistyped field', async () => {
    for (const json of [{ phase: 'requirements' }, { spec: 'auth', phase: 'nowhere' }, { spec: 'auth', phase: 'brief', created: 'brief.md' }]) {
      expect(await newSpec(fake({ json }).run, ROOT, { kind: 'feature', name: 'auth', writer: 'agent' }), JSON.stringify(json))
        .toEqual({ ok: false, error: { protocolVersion: 1, code: 'failed', message: 'steno new gave an answer the host cannot read' } });
    }
  });

  it('says steno could not start when run rejects, with no log', async () => {
    const run: RunCli = async () => { throw new Error('spawn node ENOENT'); };
    expect(await newSpec(run, ROOT, { kind: 'feature', name: 'auth', writer: 'agent' }))
      .toEqual({ ok: false, error: { protocolVersion: 1, code: 'failed', message: 'steno could not start: spawn node ENOENT' } });
  });
});

describe('setUp', () => {
  it('passes the selection as one comma list joined to its flag', async () => {
    const f = fake({ json: installed });
    await setUp(f.run, ROOT, ['claude', 'codex'], nowhere);
    expect(f.args()).toEqual(['--root', ROOT, '--json', 'init', '--agent=claude,codex']);
  });

  it('passes an empty selection as --agent=, which installs in .agents/skills only', async () => {
    const f = fake({ json: installed });
    await setUp(f.run, ROOT, [], nowhere);
    expect(f.args()).toEqual(['--root', ROOT, '--json', 'init', '--agent=']);
  });

  it('reports what was installed, with or without warnings', async () => {
    expect(await setUp(fake({ json: installed }).run, ROOT, ['claude'], nowhere)).toEqual({ ok: true, value: installed });
    const warned = { ...installed, warnings: ['config.yaml unreadable'] };
    expect(await setUp(fake({ json: warned }).run, ROOT, ['claude'], nowhere)).toEqual({ ok: true, value: warned });
  });

  it('fails an answer with a missing or mistyped field', async () => {
    const bad: unknown[] = [
      ...(['root', 'skills', 'agents'] as const).map(field => { const { [field]: _, ...rest } = installed; return rest; }),
      { ...installed, skills: 'steno-spec' }, { ...installed, agents: ['claude'] }, { ...installed, agents: { claude: 1 } },
      { ...installed, warnings: 'oops' },
    ];
    for (const json of bad) {
      expect(await setUp(fake({ json }).run, ROOT, [], nowhere), JSON.stringify(json))
        .toEqual({ ok: false, error: { protocolVersion: 1, code: 'failed', message: 'steno init gave an answer the host cannot read' } });
    }
  });

  it('refuses a folder inside another project, names it, and runs nothing', async () => {
    const f = fake({ json: installed });
    const outcome = await setUp(f.run, '/work/mono/packages/app', [], p => p === '/work/mono/.steno');
    expect(outcome).toEqual({
      ok: false,
      error: { protocolVersion: 1, code: 'failed', message: 'this folder is inside the steno project at /work/mono; open that project instead', file: '/work/mono' },
    });
    expect(f.calls).toEqual([]);
  });

  it('says steno could not start when run rejects', async () => {
    const run: RunCli = async () => { throw new Error('spawn node EACCES'); };
    expect(await setUp(run, ROOT, [], nowhere)).toMatchObject({ ok: false, error: { message: 'steno could not start: spawn node EACCES' } });
  });
});

describe('listAgents', () => {
  it('asks init for its agent list and keeps only the key and label', async () => {
    const f = fake({ json: { agents: [{ key: 'claude', label: 'Claude Code', extra: 1 }] } });
    expect(await listAgents(f.run, ROOT)).toEqual({ ok: true, value: [{ key: 'claude', label: 'Claude Code' }] });
    expect(f.args()).toEqual(['--root', ROOT, '--json', 'init', '--list-agents']);
  });

  it('fails a list with a missing field, or no list at all', async () => {
    for (const json of [{ agents: [{ key: 'claude' }] }, {}]) {
      expect(await listAgents(fake({ json }).run, ROOT))
        .toEqual({ ok: false, error: { protocolVersion: 1, code: 'failed', message: 'steno init gave an answer the host cannot read' } });
    }
  });
});
