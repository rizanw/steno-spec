// Whether the `steno` a host's agents would run speaks the bundled server's protocol and is at least the bundled CLI's
// version. A host only warns about it: its own server is bundled and every action keeps working, but an agent handed a
// skill would run a `steno` that may not understand it. The protocol alone is not enough: an older CLI of the same
// protocol lacks commands that newer skills call.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { atLeast, cmdLine, findOnPath, isBatch, PROTOCOL_VERSION, unsafeBatch, type Env } from '@steno/core/host';

/** What the agents' `steno` said about itself, and `bundled`, the CLI version the host tells them to install. */
export interface AgentSteno { found: boolean; protocol?: number; version?: string; bundled: string; matches: boolean }

/** How long `steno --version` may take before it counts as not matching. */
export const VERSION_TIMEOUT_MS = 5_000;

/** One way to start `steno --version`: the program itself, or `cmd.exe` with the line it runs. */
export interface Launch { file: string; args: string[]; verbatim: boolean }

/** A started `--version`: its standard output once it ends, empty when it failed, and how to stop it. */
export interface Running { output: Promise<string>; kill(): void }

export interface CheckOptions {
  /** the PATH the agents run with, usually the host's own */
  env: Env;
  /** the bundled CLI's version: the lowest that matches */
  bundled: string;
  timeoutMs?: number;
  exists?: (path: string) => boolean;
  run?: (launch: Launch) => Running;
  /** the protocol to match; the bundled server's unless a test says otherwise */
  protocol?: number;
}

/** The protocol a `steno --version` line names, as in `0.1.2 (protocol 1)`. */
export function versionProtocol(text: string): number | undefined {
  const m = /\(protocol (\d+)\)/.exec(text);
  return m ? Number(m[1]) : undefined;
}

/** The version a `steno --version` line starts with, as in `0.1.2 (protocol 1)`. */
export function versionNumber(text: string): string | undefined {
  return /^\s*(\d+\.\d+\.\d+)/.exec(text)?.[1];
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

/** Find `steno` on the given PATH and say whether it is there, speaks the expected protocol and is recent enough. */
export async function checkAgentSteno(options: CheckOptions): Promise<AgentSteno> {
  const { env, bundled } = options;
  const expected = options.protocol ?? PROTOCOL_VERSION;
  const program = findOnPath('steno', env, options.exists ?? existsSync);
  if (!program) return { found: false, matches: false, bundled };
  const launch = versionLaunch(program, env.windows);
  if (!launch) return { found: true, matches: false, bundled };
  let running: Running;
  try { running = (options.run ?? runLaunch)(launch); } catch { return { found: true, matches: false, bundled }; }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<undefined>(resolve => { timer = setTimeout(() => { running.kill(); resolve(undefined); }, options.timeoutMs ?? VERSION_TIMEOUT_MS); });
  const output = await Promise.race([running.output.catch(() => ''), timedOut]);
  clearTimeout(timer);
  const protocol = output === undefined ? undefined : versionProtocol(output);
  const version = output === undefined ? undefined : versionNumber(output);
  const matches = protocol === expected && version !== undefined && atLeast(version, bundled);
  return { found: true, ...(protocol === undefined ? {} : { protocol }), ...(version === undefined ? {} : { version }), matches, bundled };
}
