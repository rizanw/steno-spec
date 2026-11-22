// Starts the language server and CLI a host ships, whether it has them as files or only as text inside its own bundle.
import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { CliExit } from '@steno/core/host';

/**
 * Where a host's programs come from. `files` is the folder that holds them, with the skills in `../skills` beside it,
 * as the CLI expects. `embedded` is their text, keyed by file name (skills by `/`-separated path), with a hash of all
 * of it; they are written under `dataDir` before the first start.
 */
export type ProgramSource =
  | { files: string }
  | { embedded: { hash: string; programs: Record<string, string>; skills: Record<string, string> }; dataDir: string };

type Embedded = Extract<ProgramSource, { embedded: unknown }>['embedded'];

/**
 * Make `dir` a folder only this process's user can reach. Another local account that creates the expected folder
 * first, or opens it to others, must not get its files run under this user, so a folder owned by anyone else is
 * refused and a loose mode is tightened. Windows keeps per-user folders under the profile and has no such modes.
 */
function privateDir(dir: string): void {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (process.platform === 'win32') return;
  const stat = lstatSync(dir);
  if (!stat.isDirectory() || stat.uid !== process.getuid?.()) throw new Error(`${dir} is not a folder owned by this user`);
  if (stat.mode & 0o077) chmodSync(dir, 0o700);
}

/** Whether every program and skill under `root` holds exactly the bundled text. */
function holdsBundle(root: string, embedded: Embedded): boolean {
  const same = (file: string, text: string) => { try { return readFileSync(file, 'utf8') === text; } catch { return false; } };
  return Object.entries(embedded.programs).every(([name, text]) => same(join(root, 'vendor', name), text))
    && Object.entries(embedded.skills).every(([name, text]) => same(join(root, 'skills', ...name.split('/')), text));
}

/**
 * The folder the programs run from. Embedded ones are written to `dataDir/HASH/vendor/`, inside a folder private to
 * this user: they are filled under another name and renamed into place, so a crash or a second host process never
 * leaves a half-written folder. Every call compares the files with the bundled text and writes them again on any
 * difference, so only the bytes this host carries are ever run. A different hash gets its own folder, so an update
 * never runs programs an older version left.
 */
export function programsDir(source: ProgramSource): string {
  if ('files' in source) return source.files;
  const { embedded, dataDir } = source;
  privateDir(dataDir);
  const dir = join(dataDir, embedded.hash);
  if (!holdsBundle(dir, embedded)) {
    rmSync(dir, { recursive: true, force: true });
    const staging = `${dir}.${process.pid}.tmp`;
    rmSync(staging, { recursive: true, force: true });
    const put = (file: string, text: string) => { mkdirSync(dirname(file), { recursive: true, mode: 0o700 }); writeFileSync(file, text, { mode: 0o600 }); };
    try {
      for (const [name, text] of Object.entries(embedded.programs)) put(join(staging, 'vendor', name), text);
      for (const [name, text] of Object.entries(embedded.skills)) put(join(staging, 'skills', ...name.split('/')), text);
      renameSync(staging, dir);
    } catch (err) {
      rmSync(staging, { recursive: true, force: true });
      if (!holdsBundle(dir, embedded)) throw err;    // another process won the race, which is fine
    }
  }
  return join(dir, 'vendor');
}

/**
 * Start one of the programs, never through a shell. Inside an Electron app `process.execPath` is Electron itself,
 * which runs a script as plain Node only with ELECTRON_RUN_AS_NODE set; a real Node ignores the variable.
 */
export function runProgram(source: ProgramSource, program: string, args: string[], options: SpawnOptions): ChildProcess {
  const { env, ...rest } = options;
  const script = join(programsDir(source), program);
  return spawn(process.execPath, [script, ...args], { ...rest, shell: false, env: { ...(env ?? process.env), ELECTRON_RUN_AS_NODE: '1' } });
}

/**
 * Run a program to its end and give its exit code and output; killed after `timeoutMs`. Rejects only when it cannot
 * start, so a refusal reaches the caller as output to read.
 */
export function runToEnd(source: ProgramSource, program: string, args: string[], options: { cwd?: string; timeoutMs?: number } = {}): Promise<CliExit> {
  return new Promise((resolve, reject) => {
    let child: ChildProcess;
    try { child = runProgram(source, program, args, { cwd: options.cwd, stdio: ['ignore', 'pipe', 'pipe'] }); } catch (err) { reject(err); return; }
    let stdout = '', stderr = '';
    child.stdout?.on('data', d => { stdout += d; });
    child.stderr?.on('data', d => { stderr += d; });
    const timer = setTimeout(() => child.kill(), options.timeoutMs ?? 10_000);
    child.on('error', err => { clearTimeout(timer); reject(err); });
    child.on('close', code => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
  });
}
