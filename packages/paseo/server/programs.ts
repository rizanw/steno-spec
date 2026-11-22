// The bundled language server and CLI, embedded as text in server/vendor/programs.ts because Paseo evaluates the
// compiled server with no file path. @steno/host writes them to Paseo's data folder before the first start.
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { programsDir, runProgram as runFrom, runToEnd as runToEndFrom, type CliExit, type ProgramSource } from './vendor/host.mjs';
import { HASH, PROGRAMS, SKILLS } from './vendor/programs';

type Program = keyof typeof PROGRAMS;

/**
 * Where the programs are written: beside Paseo's other plugin data, in Paseo's default home when PASEO_HOME is unset.
 * Never the shared temp folder, where another local account could create the folder first.
 */
function dataDir(): string {
  return join(process.env.PASEO_HOME || join(homedir(), '.paseo'), 'plugin-data', 'steno');
}

/** The embedded programs, read from the environment each time so a changed PASEO_HOME is followed. */
export function bundled(): ProgramSource {
  return { embedded: { hash: HASH, programs: PROGRAMS, skills: SKILLS }, dataDir: dataDir() };
}

/** The folder the programs run from, written first if needed. */
export const unpack = (): string => programsDir(bundled());

export const runProgram = (program: Program, args: string[], options: SpawnOptions): ChildProcess => runFrom(bundled(), program, args, options);

export const runToEnd = (program: Program, args: string[], options: { cwd?: string } = {}): Promise<CliExit> => runToEndFrom(bundled(), program, args, options);
