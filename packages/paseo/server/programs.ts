import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { HASH, PROGRAMS, SKILLS } from './vendor/programs';

export type Program = keyof typeof PROGRAMS;

/** Where unpacked programs live: beside Paseo's other plugin data, or the OS temp folder when Paseo sets no home. */
export function defaultBase(): string {
  const home = process.env.PASEO_HOME;
  return home ? join(home, 'plugin-data', 'steno') : join(tmpdir(), 'steno-paseo');
}

/**
 * Write the embedded programs and skills to `base/HASH/` unless that folder exists, and return it. The folder is
 * filled under another name and renamed into place, so a crash or a second plugin process never leaves a half-written
 * one that a later start would trust. The CLI looks for `../skills` beside its own folder, hence `vendor/` and `skills/`.
 */
export function unpack(base = defaultBase()): string {
  const dir = join(base, HASH);
  if (existsSync(dir)) return dir;
  const staging = `${dir}.${process.pid}.tmp`;
  rmSync(staging, { recursive: true, force: true });
  const put = (file: string, text: string) => { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, text); };
  for (const [name, text] of Object.entries(PROGRAMS)) put(join(staging, 'vendor', name), text);
  for (const [name, text] of Object.entries(SKILLS)) put(join(staging, 'skills', ...name.split('/')), text);
  try {
    renameSync(staging, dir);
  } catch (err) {
    rmSync(staging, { recursive: true, force: true });
    if (!existsSync(dir)) throw err;    // another process won the race, which is fine
  }
  return dir;
}

/**
 * Start a bundled program. Inside Paseo `process.execPath` is its Electron helper, which runs a script as plain Node
 * only with ELECTRON_RUN_AS_NODE set; a real Node ignores the variable.
 */
export function runProgram(program: Program, args: string[], options: SpawnOptions & { base?: string } = {}): ChildProcess {
  const { base, env, ...rest } = options;
  const script = join(unpack(base), 'vendor', program);
  return spawn(process.execPath, [script, ...args], { ...rest, shell: false, env: { ...(env ?? process.env), ELECTRON_RUN_AS_NODE: '1' } });
}

/** Run a bundled program to its end and return its exit code and output. Killed after `timeoutMs`. */
export function runToEnd(program: Program, args: string[], options: { cwd?: string; base?: string; timeoutMs?: number } = {}):
  Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = runProgram(program, args, { cwd: options.cwd, base: options.base, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout?.on('data', d => { stdout += d; });
    child.stderr?.on('data', d => { stderr += d; });
    const timer = setTimeout(() => child.kill(), options.timeoutMs ?? 10_000);
    child.on('error', err => { clearTimeout(timer); reject(err); });
    child.on('close', code => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
  });
}
