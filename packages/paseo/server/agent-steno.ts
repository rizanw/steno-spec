// Whether the `steno` the workspace's agents would run can run the skills the plugin installs. Paseo's agents inherit
// the daemon's environment, so the daemon's PATH is theirs; the check itself is @steno/host's.
import { checkAgentSteno as check, type AgentSteno, type Env } from './vendor/host.mjs';
import { VERSION } from './vendor/programs';

export type { AgentSteno };

/** Until the check answers nothing is known to be wrong, so the panel shows no warning. */
export const UNCHECKED: AgentSteno = { found: false, matches: true, bundled: VERSION };

function daemonEnv(): Env {
  return { path: process.env.PATH ?? process.env.Path ?? '', pathExt: process.env.PATHEXT, windows: process.platform === 'win32' };
}

/** Find `steno` on the daemon's PATH and compare it with the bundled CLI. */
export const checkAgentSteno = (): Promise<AgentSteno> => check({ env: daemonEnv(), bundled: VERSION });
