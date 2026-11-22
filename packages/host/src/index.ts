// What a host needs from Node to run steno for a folder: keep one language server per folder, start the bundled
// programs, check the agents' `steno` and watch the instruction files. Kept out of @steno/core/host, which the VS Code
// extension and browser clients import, because this pulls in child processes, the file system and JSON-RPC.
export * from './programs.js';
export * from './agent-steno.js';
export * from './watch.js';
export * from './pool.js';
