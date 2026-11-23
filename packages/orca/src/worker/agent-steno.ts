// Whether the `steno` the worktree's agents would run can run the skills the plugin installs. Orca starts its agents in
// terminals that inherit the app's environment, which the worker shares, so the worker's PATH stands in for theirs; the
// check itself is @steno/host's.
import type { Env } from '@steno/core/host';
import { checkAgentSteno as check, type AgentSteno, type CheckOptions } from '@steno/host';

// the bundled CLI's version, compiled in by build.mjs (and vitest.config.ts for the tests) from packages/cli
declare const __STENO_VERSION__: string;
export const VERSION: string = __STENO_VERSION__;

/** Until the check answers nothing is known to be wrong, so the panel shows no warning. */
export const UNCHECKED: AgentSteno = { found: false, matches: true, bundled: VERSION };

/** The PATH the agents run with. Windows spells it `Path` in some environments, and finds programs through `PATHEXT`. */
export function workerEnv(env: Record<string, string | undefined> = process.env, platform: string = process.platform): Env {
  return { path: env.PATH ?? env.Path ?? '', pathExt: env.PATHEXT, windows: platform === 'win32' };
}

/** Find `steno` on the worker's PATH and compare it with the bundled CLI. `run` is the host's check unless a test gives one. */
export const checkAgentSteno = (run: (options: CheckOptions) => Promise<AgentSteno> = check): Promise<AgentSteno> =>
  run({ env: workerEnv(), bundled: VERSION });
