// Finding the `steno` a host's agents would run and comparing it with the one the host bundles.
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkAgentSteno, versionLaunch, type Launch } from '../src/agent-steno.js';

describe("the agents' steno", () => {
  afterEach(() => { vi.useRealTimers(); });

  // posix paths on every host: `env` says not Windows, so `findOnPath` joins with `/` even on a Windows runner
  const env = { path: '/bin', windows: false };
  const exists = (p: string) => p === '/bin/steno';
  const answers = (output: string) => (_: Launch) => ({ output: Promise.resolve(output), kill: () => {} });
  const bundled = '0.1.3';
  const check = (output: string) => checkAgentSteno({ env, exists, protocol: 1, bundled, run: answers(output) });

  it('is missing when PATH has no steno', async () => {
    expect(await checkAgentSteno({ env, exists: () => false, bundled, run: answers('') })).toEqual({ found: false, matches: false, bundled });
  });

  it('matches when it names the same protocol, and not when it names another or none', async () => {
    expect(await check('0.1.3 (protocol 1)\n')).toEqual({ found: true, protocol: 1, version: '0.1.3', matches: true, bundled });
    expect(await check('0.9.0 (protocol 2)\n')).toEqual({ found: true, protocol: 2, version: '0.9.0', matches: false, bundled });
    expect(await check('0.0.9\n')).toEqual({ found: true, version: '0.0.9', matches: false, bundled });
    expect(await check('not a version')).toEqual({ found: true, matches: false, bundled });
  });

  it('does not match an older version of the same protocol, so skills never call a command it lacks', async () => {
    expect(await check('0.1.1 (protocol 1)\n')).toMatchObject({ protocol: 1, version: '0.1.1', matches: false });
    expect(await check('0.1.10 (protocol 1)\n')).toMatchObject({ version: '0.1.10', matches: true });
    expect(await check('0.2.0 (protocol 1)\n')).toMatchObject({ matches: true });
  });

  it('does not match a steno that fails or cannot be started', async () => {
    // a failed run gives empty output; a launcher that throws or rejects counts the same
    expect(await check('')).toEqual({ found: true, matches: false, bundled });
    expect(await checkAgentSteno({ env, exists, protocol: 1, bundled, run: () => { throw new Error('EACCES'); } })).toEqual({ found: true, matches: false, bundled });
    expect(await checkAgentSteno({ env, exists, protocol: 1, bundled, run: () => ({ output: Promise.reject(new Error('x')), kill: () => {} }) }))
      .toEqual({ found: true, matches: false, bundled });
  });

  it('counts a steno that hangs as a mismatch after 5 s and stops it', async () => {
    vi.useFakeTimers();
    const kill = vi.fn();
    const checked = checkAgentSteno({ env, exists, protocol: 1, bundled, run: () => ({ output: new Promise<string>(() => {}), kill }) });
    let result: unknown;
    void checked.then(r => { result = r; });
    await vi.advanceTimersByTimeAsync(4_999);
    expect(result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(result).toMatchObject({ found: true, matches: false });
    expect(kill).toHaveBeenCalled();
  });

  it('runs an npm shim on Windows through cmd.exe, and refuses a path cmd.exe would misread', async () => {
    const shim = 'C:\\Users\\me\\npm\\steno.cmd';
    expect(versionLaunch(shim, true)).toEqual({ file: 'cmd.exe', args: ['/d', '/s', '/c', `""${shim}" --version"`], verbatim: true });
    expect(versionLaunch('/bin/steno', false)).toEqual({ file: '/bin/steno', args: ['--version'], verbatim: false });
    expect(versionLaunch('C:\\100%\\steno.cmd', true)).toBeUndefined();
    const run = vi.fn(answers('0.1.2 (protocol 1)'));
    const winEnv = { path: 'C:\\100%', pathExt: '.CMD', windows: true };
    expect(await checkAgentSteno({ env: winEnv, exists: () => true, protocol: 1, bundled, run })).toMatchObject({ found: true, matches: false });
    expect(run).not.toHaveBeenCalled();
  });

  // a real program on a real PATH; Windows would need a .cmd shim, which the launch test above covers
  it.skipIf(process.platform === 'win32')('runs the steno it finds on the PATH it is given', async () => {
    const bin = mkdtempSync(join(tmpdir(), 'steno-host-path-'));
    const fake = join(bin, 'steno');
    writeFileSync(fake, `#!${process.execPath}\nprocess.stdout.write(process.argv[2] === '--version' ? '0.2.0 (protocol 1)\\n' : 'wrong');\n`);
    chmodSync(fake, 0o755);
    expect(await checkAgentSteno({ env: { path: bin, windows: false }, protocol: 1, bundled })).toEqual({ found: true, protocol: 1, version: '0.2.0', matches: true, bundled });
  });
});
