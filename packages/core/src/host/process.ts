// The rules a host follows around steno's programs: when to stop restarting a crashing server, how to find a
// program on PATH, which Windows batch paths are unsafe to start, and whether a folder sits inside another steno
// project. The file system comes in as an `exists` callback, so a host can fake it and nothing here reads disk.
import { posix, win32 } from 'node:path';

// How often a server may crash before the host gives up on it: five unexpected exits inside any three-minute
// period. One window per folder, so a noisy folder never silences a healthy one.
export const WINDOW_MS = 180_000;
export const MAX_EXITS = 5;

export class RestartWindow {
  /** the exits still inside the window, oldest first */
  private exits: number[] = [];

  /**
   * Record an unexpected exit at `now` and say what to do about it. `'stop'` once this exit is the
   * fifth within the 180 s ending at it; `'restart'` otherwise.
   */
  record(now: number): 'restart' | 'stop' {
    // an exit older than the window no longer counts against the server
    this.exits = this.exits.filter(t => now - t < WINDOW_MS);
    this.exits.push(now);
    return this.exits.length >= MAX_EXITS ? 'stop' : 'restart';
  }

  /** Forget every exit: the user asked for a restart, so the server starts with a clean record. */
  reset(): void {
    this.exits = [];
  }
}

/** The bits of the environment we need to find a program: PATH, PATHEXT and whether we're on Windows. */
export interface Env { path: string; pathExt?: string; windows: boolean }

const DEFAULT_PATHEXT = '.COM;.EXE;.BAT;.CMD';

/**
 * Finds `program` on PATH the way a shell would, without running anything, and returns its full path.
 * On Windows we only try the PATHEXT endings (`.exe`, `.cmd`, ...) and never the bare name, because npm puts an
 * extensionless shell script next to every `.cmd` shim and Windows can't start that script directly.
 */
export function findOnPath(program: string, env: Env, exists: (p: string) => boolean): string | undefined {
  const path = env.windows ? win32 : posix;
  const names = env.windows
    ? (env.pathExt || DEFAULT_PATHEXT).split(';').filter(Boolean).map(ext => program + ext.toLowerCase())   // Windows file names ignore case
    : [program];
  for (const dir of env.path.split(env.windows ? ';' : ':')) {
    if (!dir) continue;
    for (const name of names) {
      const file = path.join(dir, name);
      if (exists(file)) return file;
    }
  }
  return undefined;
}

/** A Windows batch file, which only `cmd.exe` can start. */
export function isBatch(program: string): boolean {
  return /\.(cmd|bat)$/i.test(program);
}

/** A `.cmd` or `.bat` path that `cmd.exe` would misread inside our quoted command line. */
export function unsafeBatch(program: string, windows: boolean): boolean {
  return windows && isBatch(program) && /["%]/.test(program);
}

/**
 * The command line `cmd.exe /d /s /c "<line>"` runs to start a batch file: the program quoted, then each
 * argument, quoted when it holds a space. Check `unsafeBatch` first: a quote or percent sign in the program's
 * path would break out of this quoting.
 */
export function cmdLine(program: string, args: string[]): string {
  return [`"${program}"`, ...args.map(a => (a.includes(' ') ? `"${a}"` : a))].join(' ');
}

/** Windows paths use the win32 rules, everything else posix, whatever the host is. */
function pathRules(path: string): typeof posix {
  return /^[A-Za-z]:[\\/]/.test(path) || path.startsWith('\\\\') ? win32 : posix;
}

/**
 * The nearest folder above `folder` that holds a `.steno` folder, or `undefined` when none does. The walk
 * starts at the folder's parent, so the folder itself never counts, and stops at the file system root.
 */
export function parentProject(folder: string, exists: (p: string) => boolean): string | undefined {
  const path = pathRules(folder);
  let at = path.dirname(folder);
  let below = folder;
  // `dirname` of a root is the root itself, which ends the walk
  while (at !== below) {
    if (exists(path.join(at, '.steno'))) return at;
    below = at;
    at = path.dirname(at);
  }
  return undefined;
}
