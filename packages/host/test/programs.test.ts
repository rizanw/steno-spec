// Starting the programs a host ships, from files on disk or from text embedded in the host's bundle.
import { describe, expect, it } from 'vitest';
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { programsDir, runToEnd, type ProgramSource } from '../src/programs.js';

const temp = () => mkdtempSync(join(tmpdir(), 'steno-host-'));

// Prints what it was started with, so a test can see its arguments and environment.
const ECHO = 'process.stdout.write(JSON.stringify({ args: process.argv.slice(2), electron: process.env.ELECTRON_RUN_AS_NODE ?? null }));';
const embedded = (dataDir: string, hash = 'abc123'): ProgramSource =>
  ({ embedded: { hash, programs: { 'echo.mjs': ECHO }, skills: { 'steno-run/SKILL.md': '# run' } }, dataDir });

describe('the bundled programs', () => {
  it('runs programs a host has as files from where they are', async () => {
    const dir = temp();
    writeFileSync(join(dir, 'echo.mjs'), ECHO);
    expect(programsDir({ files: dir })).toBe(dir);
    const { code, stdout } = await runToEnd({ files: dir }, 'echo.mjs', ['a']);
    expect(code).toBe(0);
    expect(JSON.parse(stdout).args).toEqual(['a']);
  });

  it('writes embedded programs under the hash, with the skills beside them', () => {
    const data = temp();
    const dir = programsDir(embedded(data));
    expect(dir).toBe(join(data, 'abc123', 'vendor'));
    expect(readFileSync(join(dir, 'echo.mjs'), 'utf8')).toBe(ECHO);
    expect(readFileSync(join(data, 'abc123', 'skills', 'steno-run', 'SKILL.md'), 'utf8')).toBe('# run');
  });

  it('reuses a written folder instead of writing it again, and gives another hash its own', () => {
    const data = temp();
    const dir = programsDir(embedded(data));
    const written = statSync(join(dir, 'echo.mjs')).mtimeMs;
    expect(programsDir(embedded(data))).toBe(dir);
    expect(statSync(join(dir, 'echo.mjs')).mtimeMs).toBe(written);
    expect(readdirSync(data)).toEqual(['abc123']);
    programsDir(embedded(data, 'def456'));
    expect(readdirSync(data).sort()).toEqual(['abc123', 'def456']);
  });

  it('leaves no folder a later start would reuse when writing fails part way', () => {
    const data = temp();
    // a skill nested under a name already written as a file cannot be written
    const broken: ProgramSource = { embedded: { hash: 'bad', programs: { 'echo.mjs': ECHO }, skills: { x: 'file', 'x/y.md': 'nested' } }, dataDir: data };
    expect(() => programsDir(broken)).toThrow();
    expect(readdirSync(data)).toEqual([]);
  });

  it('reuses a folder another process finished first', () => {
    const data = temp();
    mkdirSync(join(data, 'abc123', 'vendor'), { recursive: true });
    mkdirSync(join(data, 'abc123', 'skills', 'steno-run'), { recursive: true });
    writeFileSync(join(data, 'abc123', 'vendor', 'echo.mjs'), ECHO);
    writeFileSync(join(data, 'abc123', 'skills', 'steno-run', 'SKILL.md'), '# run');
    const written = statSync(join(data, 'abc123', 'vendor', 'echo.mjs')).mtimeMs;
    expect(programsDir(embedded(data))).toBe(join(data, 'abc123', 'vendor'));
    expect(statSync(join(data, 'abc123', 'vendor', 'echo.mjs')).mtimeMs).toBe(written);
  });

  it('runs only the bundled text, writing again a folder whose files were changed or left out', async () => {
    const data = temp();
    mkdirSync(join(data, 'abc123', 'vendor'), { recursive: true });
    writeFileSync(join(data, 'abc123', 'vendor', 'echo.mjs'), 'process.stdout.write("planted")');
    const { stdout } = await runToEnd(embedded(data), 'echo.mjs', ['a']);
    expect(JSON.parse(stdout).args).toEqual(['a']);
    expect(readFileSync(join(data, 'abc123', 'skills', 'steno-run', 'SKILL.md'), 'utf8')).toBe('# run');
  });

  it.skipIf(process.platform === 'win32')('keeps the data folder private to this user', () => {
    const data = temp();
    chmodSync(data, 0o777);
    programsDir(embedded(data));
    expect(statSync(data).mode & 0o777).toBe(0o700);
    const fresh = join(temp(), 'nested', 'steno');
    programsDir(embedded(fresh));
    expect(statSync(fresh).mode & 0o077).toBe(0);
  });

  it('starts every program as plain Node, with its arguments passed as they are and no shell', async () => {
    const odd = ['$HOME', 'a b', '&& echo hi', '"quoted"'];
    const { code, stdout } = await runToEnd(embedded(temp()), 'echo.mjs', odd);
    expect(code).toBe(0);
    expect(JSON.parse(stdout)).toEqual({ args: odd, electron: '1' });
  });

  it('gives a failed run as its exit code and output', async () => {
    const dir = temp();
    writeFileSync(join(dir, 'fail.mjs'), 'process.stderr.write("no"); process.exit(3);');
    expect(await runToEnd({ files: dir }, 'fail.mjs', [])).toEqual({ code: 3, stdout: '', stderr: 'no' });
  });
});
