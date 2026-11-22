import { existsSync, mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { listAgents, newSpec, setUp, type RunCli } from '../server/cli';

const temp = () => mkdtempSync(join(tmpdir(), 'steno-paseo-create-'));

/** A folder set up with no agents, so specs can be created in it. */
async function project(): Promise<string> {
  const dir = temp();
  expect(await setUp(dir, [])).toEqual({ ok: true });
  return dir;
}
const specs = (dir: string) => readdirSync(join(dir, '.steno', 'specs'));

describe('creating a spec with the bundled CLI', () => {
  it('creates a feature, and a brainstormed one starting at its brief', async () => {
    const dir = await project();
    expect(await newSpec(dir, { kind: 'feature', name: 'login', title: 'Log in', writer: 'agent', description: 'users sign in' }))
      .toEqual({ ok: true, spec: 'login', phase: 'requirements' });
    expect(await newSpec(dir, { kind: 'feature', name: 'search', writer: 'brainstorm' })).toEqual({ ok: true, spec: 'search', phase: 'brief' });
    expect(existsSync(join(dir, '.steno', 'specs', 'search', 'brief.md'))).toBe(true);
    const bug = await newSpec(dir, { kind: 'bugfix', name: 'crash', writer: 'brainstorm' });
    expect(bug.ok).toBe(true);
    expect(existsSync(join(dir, '.steno', 'specs', 'crash', 'bugfix.md'))).toBe(true);
  }, 30_000);

  it('refuses a bad or taken name, saying why and creating nothing', async () => {
    const dir = await project();
    await newSpec(dir, { kind: 'feature', name: 'login', writer: 'me' });
    for (const name of ['Bad_Name', '--force', 'login']) {
      const outcome = await newSpec(dir, { kind: 'feature', name, writer: 'me' });
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) expect(outcome.error.message).toMatch(name === 'login' ? /exists/ : /kebab-case/);
    }
    expect(specs(dir)).toEqual(['login']);
  }, 30_000);

  it('keeps a title that starts with a dash as the title', async () => {
    const dir = await project();
    expect(await newSpec(dir, { kind: 'feature', name: 'dash', title: '--bugfix', writer: 'me' })).toMatchObject({ ok: true, phase: 'requirements' });
  }, 30_000);
});

describe('a CLI run that goes wrong', () => {
  const refusal = { protocolVersion: 1, code: 'exists', message: 'spec login exists' };
  const exit = (code: number | null, stdout: string, stderr = ''): RunCli => async () => ({ code, stdout, stderr });

  it('passes a refusal on exit 1 through unchanged', async () => {
    const log = vi.fn();
    expect(await newSpec(temp(), { kind: 'feature', name: 'login', writer: 'me' }, exit(1, JSON.stringify(refusal)), log))
      .toEqual({ ok: false, error: refusal });
    expect(log).not.toHaveBeenCalled();
  });

  it('reads a refusal on exit 3 as a failure naming the exit code', async () => {
    const outcome = await newSpec(temp(), { kind: 'feature', name: 'login', writer: 'me' }, exit(3, JSON.stringify(refusal)), vi.fn());
    expect(outcome).toMatchObject({ ok: false, error: { code: 'failed', message: 'steno exited with code 3' } });
  });

  it('shows a crash as its first line and writes all of standard error to the plugin log', async () => {
    const stderr = 'TypeError: boom\n    at main (cli.mjs:1:1)\n    at run (cli.mjs:2:2)\n';
    const log = vi.fn();
    const outcome = await setUp(temp(), [], exit(70, '', stderr), () => false, log);
    expect(outcome).toEqual({ ok: false, error: expect.objectContaining({ code: 'failed', message: 'steno exited with code 70: TypeError: boom' }) });
    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0][0]).toContain('at run (cli.mjs:2:2)');
  });

  it("throws the message when the agent list fails, and logs the CLI's standard error", async () => {
    const log = vi.fn();
    await expect(listAgents(temp(), exit(70, '', 'Error: no agents\n  at x'), log)).rejects.toThrow('steno exited with code 70: Error: no agents');
    expect(log.mock.calls[0][0]).toContain('at x');
  });

  it('answers a new spec with its name and phase only', async () => {
    const run = vi.fn<RunCli>(async () => ({ code: 0, stdout: JSON.stringify({ spec: 'login', phase: 'requirements', created: ['a.md'] }), stderr: '' }));
    expect(await newSpec(temp(), { kind: 'feature', name: 'login', writer: 'me' }, run)).toEqual({ ok: true, spec: 'login', phase: 'requirements' });
  });
});

describe('setting a folder up', () => {
  it('lists the agents the CLI can set up', async () => {
    const { agents } = await listAgents(temp());
    expect(agents.map(a => a.key)).toEqual(expect.arrayContaining(['claude', 'codex']));
    expect(agents.every(a => a.label.length > 0)).toBe(true);
  }, 30_000);

  it('installs skills for the chosen agents', async () => {
    const dir = temp();
    expect(await setUp(dir, ['claude'])).toEqual({ ok: true });
    expect(existsSync(join(dir, '.claude', 'skills'))).toBe(true);
  }, 30_000);

  it('refuses a folder inside another project, names it, and runs nothing', async () => {
    const outer = temp();
    mkdirSync(join(outer, '.steno'));
    const inner = join(outer, 'packages', 'app');
    mkdirSync(inner, { recursive: true });
    const run = vi.fn<RunCli>();
    const outcome = await setUp(inner, [], run);
    expect(outcome).toMatchObject({ ok: false, error: { message: expect.stringContaining(outer) } });
    expect(run).not.toHaveBeenCalled();
    expect(existsSync(join(inner, '.steno'))).toBe(false);
  });
});
