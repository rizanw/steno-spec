// One steno language server per workspace directory, from @steno/host's pool: the panel's snapshot, status bar and
// Restart read each server's `state`, last `tree` and diagnostics from it. Paseo's only part is where the server
// comes from: the bundled programs, written to the plugin's data folder.
import { createPool as createHostPool, type PoolOptions, type ServerPool } from './vendor/host.mjs';
import { bundled } from './programs';

export type { FolderServer, ServerPool } from './vendor/host.mjs';

/** The pool, starting the bundled server unless `options.start` says otherwise. */
export const createPool = (options: PoolOptions = {}): ServerPool => createHostPool({ source: bundled(), ...options });
