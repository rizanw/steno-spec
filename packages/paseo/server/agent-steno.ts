// Whether the `steno` the workspace's agents would run speaks the bundled server's protocol. Paseo's agents inherit
// the daemon's environment, so the daemon's PATH is theirs. The panel only warns: its own server is bundled and every
// action keeps working, but an agent handed a skill would run a `steno` that may not understand it.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cmdLine, findOnPath, isBatch, PROTOCOL_VERSION, unsafeBatch, type Env } from './vendor/host.mjs';

export interface AgentSteno { found: boolean; protocol?: number; matches: boolean }

/** Until the check answers nothing is known to be wrong, so the panel shows no warning. */
export const UNCHECKED: AgentSteno = { found: false, matches: true };

/** How long `steno --version` may take before it counts as not matching. */
export const VERSION_TIMEOUT_MS = 5_000;

/** One way to start `steno --version`: the program itself, or `cmd.exe` with the line it runs. */
export interface Launch { file: string; args: string[]; verbatim: boolean }

/** A started `--version`: its standard output once it ends, empty when it failed, and how to stop it. */
export interface Running { output: Promise<string>; kill(): void }

export interface CheckOptions {
  env?: Env;
  exists?: (path: string) => boolean;
  run?: (launch: Launch) => Running;
  timeoutMs?: number;
  /** the protocol to match; the bundled server's unless a test says otherwise */
  protocol?: number;
}

/** The protocol a `steno --version` line names, as in `0.1.2 (protocol 1)`. */
export function versionProtocol(text: string): number | undefined {
  const m = /\(protocol (\d+)\)/.exec(text);
  return m ? Number(m[1]) : undefined;
}

/**
 * How to start `program --version`. Windows starts an npm `.cmd` shim only through `cmd.exe`, whose quoting a
 * `"` or `%` in the path would break out of; such a path gets no launch at all.
 */
export function versionLaunch(program: string, windows: boolean): Launch | undefined {
  if (unsafeBatch(program, windows)) return undefined;
  if (windows && isBatch(program)) return { file: 'cmd.exe', args: ['/d', '/s', '/c', `"${cmdLine(program, ['--version'])}"`], verbatim: true };
  return { file: program, args: ['--version'], verbatim: false };
}

function daemonEnv(): Env {
  const windows = process.platform === 'win32';
  return { path: process.env.PATH ?? process.env.Path ?? '', pathExt: process.env.PATHEXT, windows };
}

function runLaunch(launch: Launch): Running {
  const child = spawn(launch.file, launch.args, { shell: false, windowsVerbatimArguments: launch.verbatim, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
  const output = new Promise<string>(resolve => {
    let stdout = '';
    child.stdout?.on('data', d => { stdout += d; });
    child.on('error', () => resolve(''));
    child.on('close', code => resolve(code === 0 ? stdout : ''));
  });
  return { output, kill: () => { child.kill(); } };
}

/** Find `steno` on the daemon's PATH and say whether it is there and speaks the expected protocol. */
export async function checkAgentSteno(options: CheckOptions = {}): Promise<AgentSteno> {
  const env = options.env ?? daemonEnv();
  const expected = options.protocol ?? PROTOCOL_VERSION;
  const program = findOnPath('steno', env, options.exists ?? existsSync);
  if (!program) return { found: false, matches: false };
  const launch = versionLaunch(program, env.windows);
  if (!launch) return { found: true, matches: false };
  let running: Running;
  try { running = (options.run ?? runLaunch)(launch); } catch { return { found: true, matches: false }; }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<undefined>(resolve => { timer = setTimeout(() => { running.kill(); resolve(undefined); }, options.timeoutMs ?? VERSION_TIMEOUT_MS); });
  const output = await Promise.race([running.output.catch(() => ''), timedOut]);
  clearTimeout(timer);
  const protocol = output === undefined ? undefined : versionProtocol(output);
  return { found: true, ...(protocol === undefined ? {} : { protocol }), matches: protocol === expected };
}
