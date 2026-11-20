import { existsSync, mkdirSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkAgentSteno, versionLaunch, type Launch } from '../server/agent-steno';
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

describe("the agents' steno", () => {
  afterEach(() => { vi.useRealTimers(); });

  const BIN = join('/', 'bin');
  const env = { path: BIN, windows: false };
  const exists = (p: string) => p === join(BIN, 'steno');
  const answers = (output: string) => (_: Launch) => ({ output: Promise.resolve(output), kill: () => {} });

  it('is missing when PATH has no steno', async () => {
    expect(await checkAgentSteno({ env, exists: () => false, run: answers('') })).toEqual({ found: false, matches: false });
  });

  it('matches when it names the same protocol, and not when it names another or none', async () => {
    expect(await checkAgentSteno({ env, exists, protocol: 1, run: answers('0.1.2 (protocol 1)\n') })).toEqual({ found: true, protocol: 1, matches: true });
    expect(await checkAgentSteno({ env, exists, protocol: 1, run: answers('0.9.0 (protocol 2)\n') })).toEqual({ found: true, protocol: 2, matches: false });
    expect(await checkAgentSteno({ env, exists, protocol: 1, run: answers('0.0.9\n') })).toEqual({ found: true, matches: false });
    expect(await checkAgentSteno({ env, exists, protocol: 1, run: answers('') })).toEqual({ found: true, matches: false });
  });

  it('counts a steno that hangs as a mismatch after 5 s and stops it', async () => {
    vi.useFakeTimers();
    const kill = vi.fn();
    const checked = checkAgentSteno({ env, exists, protocol: 1, run: () => ({ output: new Promise<string>(() => {}), kill }) });
    let result: unknown;
    void checked.then(r => { result = r; });
    await vi.advanceTimersByTimeAsync(4_999);
    expect(result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(result).toEqual({ found: true, matches: false });
    expect(kill).toHaveBeenCalled();
  });

  it('runs an npm shim on Windows through cmd.exe, and refuses a path cmd.exe would misread', async () => {
    const shim = 'C:\\Users\\me\\npm\\steno.cmd';
    expect(versionLaunch(shim, true)).toEqual({ file: 'cmd.exe', args: ['/d', '/s', '/c', `""${shim}" --version"`], verbatim: true });
    expect(versionLaunch('C:\\100%\\steno.cmd', true)).toBeUndefined();
    const run = vi.fn(answers('0.1.2 (protocol 1)'));
    const winEnv = { path: 'C:\\100%', pathExt: '.CMD', windows: true };
    expect(await checkAgentSteno({ env: winEnv, exists: () => true, protocol: 1, run })).toEqual({ found: true, matches: false });
    expect(run).not.toHaveBeenCalled();
  });
});
