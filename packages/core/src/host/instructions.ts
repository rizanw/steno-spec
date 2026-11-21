// Finds a folder's agent instruction files, which the language server does not report. The host supplies the file
// access (VS Code's workspace file system, Node's fs in Paseo), so this stays free of any disk reader.
import { AGENT_INSTRUCTION_DIRS, AGENT_INSTRUCTION_FILES, ROOT_INSTRUCTIONS, steeringOrder } from './rows.js';

/**
 * File access within one folder. Paths use `/` and are relative to the folder. `files` gives the bare names of the
 * regular files in that one directory, without recursing.
 */
export interface FolderReader { exists(path: string): Promise<boolean>; files(dir: string): Promise<string[]> }

/** The instruction files present, as folder-relative paths: `root` at the top of the steering list, `agent` at its end. */
export interface InstructionFiles { root: string[]; agent: string[] }

/** A reader that throws counts as "not there": one unreadable folder must not hide the rest of the list. */
const safely = async <T>(read: () => Promise<T>, fallback: T): Promise<T> => { try { return await read(); } catch { return fallback; } };

/** Every instruction file in the folder, each group A to Z as the steering list shows it. */
export async function listInstructions(read: FolderReader): Promise<InstructionFiles> {
  const present = async (candidates: readonly string[]) =>
    (await Promise.all(candidates.map(async f => (await safely(() => read.exists(f), false)) ? f : undefined)))
      .filter((f): f is string => f !== undefined);
  const [root, agentFiles, ...inDirs] = await Promise.all([
    present(ROOT_INSTRUCTIONS), present(AGENT_INSTRUCTION_FILES),
    ...AGENT_INSTRUCTION_DIRS.map(async ({ dir, suffix }) =>
      (await safely(() => read.files(dir), [])).filter(name => name.endsWith(suffix)).map(name => `${dir}/${name}`)),
  ]);
  const paths = (rows: ReturnType<typeof steeringOrder>) => rows.map(r => r.path);
  return { root: paths(steeringOrder([], root, [])), agent: paths(steeringOrder([], [], [...agentFiles, ...inDirs.flat()])) };
}
