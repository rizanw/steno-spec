// The bundled language server and CLI, embedded as text in server/vendor/programs.ts because Paseo evaluates the
// compiled server with no file path. @steno/host writes them to Paseo's data folder before the first start.
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { programsDir, runProgram as runFrom, runToEnd as runToEndFrom, type CliExit, type ProgramSource } from './vendor/host.mjs';
import { HASH, PROGRAMS, SKILLS } from './vendor/programs';

type Program = keyof typeof PROGRAMS;

/** Where the programs are written: beside Paseo's other plugin data, or the OS temp folder when Paseo sets no home. */
function dataDir(): string {
  const home = process.env.PASEO_HOME;
  return home ? join(home, 'plugin-data', 'steno') : join(tmpdir(), 'steno-paseo');
}

/** The embedded programs, read from the environment each time so a changed PASEO_HOME is followed. */
export function bundled(): ProgramSource {
  return { embedded: { hash: HASH, programs: PROGRAMS, skills: SKILLS }, dataDir: dataDir() };
}

/** The folder the programs run from, written first if needed. */
export const unpack = (): string => programsDir(bundled());

export const runProgram = (program: Program, args: string[], options: SpawnOptions): ChildProcess => runFrom(bundled(), program, args, options);

export const runToEnd = (program: Program, args: string[], options: { cwd?: string } = {}): Promise<CliExit> => runToEndFrom(bundled(), program, args, options);
