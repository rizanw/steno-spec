// New Spec, Set Up and the agent list through the bundled CLI, so a spec is created and checked exactly as
// `steno new` and `steno init` would in a terminal. The host supplies `run`, which starts the process its own way.
import type { StructuredError } from '../contract.js';
import { PHASES, type Phase } from '../types.js';
import { parentProject } from './process.js';
import { failed, readCliExit, type CliExit, type CliOutcome } from './refusal.js';

/** Runs the bundled CLI with these arguments in `cwd`. Rejects only when the process could not be started. */
export type RunCli = (args: string[], cwd: string) => Promise<CliExit>;

/** Who writes the first document: the coding agent, the agent after a brainstorm, or the user. */
export interface NewSpecRequest { kind: 'feature' | 'bugfix'; name: string; title?: string; description?: string; writer: 'agent' | 'brainstorm' | 'self' }
/** What `steno new --json` reports: the new spec, its phase and the files it wrote. */
export interface Created { spec: string; phase: Phase; created?: string[] }
/** What `steno init --json` reports. */
export interface Installed { root: string; skills: string[]; agents: Record<string, string>; warnings?: string[] }
/** One agent `init` can set skills up for, as `init --list-agents --json` names it. */
export interface CliAgent { key: string; label: string }

const isStrings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string');
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The arguments of `steno new`, after the global flags. Each value is joined to its flag and the name comes after
 * `--`, so a name, title or description that starts with a dash is never read as another flag.
 */
export function newSpecArgs(req: NewSpecRequest): string[] {
  const about = req.description?.trim();
  return [
    'new',
    ...(req.kind === 'bugfix' ? ['--bugfix'] : []),
    // a bugfix has no brief, so brainstorming one starts at its bugfix document
    ...(req.writer === 'brainstorm' && req.kind === 'feature' ? ['--brief'] : []),
    ...(req.title ? [`--title=${req.title}`] : []),
    ...(about ? [`--description=${about}`] : []),
    '--', req.name,
  ];
}

/**
 * Run `steno --root ROOT --json ARGS` and check its answer with `read`. The global flags come first, so nothing
 * after them can move the root or turn `--json` off. An answer `read` cannot use is a failure: these answers are
 * not all part of the versioned contract, so a host checks every field it relies on.
 */
async function runJson<T>(run: RunCli, root: string, args: string[], read: (value: unknown) => T | undefined, command: string): Promise<CliOutcome<T>> {
  let exit: CliExit;
  try { exit = await run(['--root', root, '--json', ...args], root); } catch (err) {
    return { ok: false, error: failed(`steno could not start: ${err instanceof Error ? err.message : String(err)}`) };
  }
  const outcome = readCliExit<unknown>(exit);
  if (!outcome.ok) return outcome;
  const value = read(outcome.value);
  return value === undefined ? { ok: false, error: failed(`${command} gave an answer the host cannot read`) } : { ok: true, value };
}

function created(value: unknown): Created | undefined {
  if (!isRecord(value) || typeof value.spec !== 'string' || !PHASES.includes(value.phase as Phase)) return undefined;
  if (value.created !== undefined && !isStrings(value.created)) return undefined;
  return { spec: value.spec, phase: value.phase as Phase, ...(value.created ? { created: value.created } : {}) };
}

function installed(value: unknown): Installed | undefined {
  if (!isRecord(value) || typeof value.root !== 'string' || !isStrings(value.skills)) return undefined;
  if (!isRecord(value.agents) || !Object.values(value.agents).every(dir => typeof dir === 'string')) return undefined;
  if (value.warnings !== undefined && !isStrings(value.warnings)) return undefined;
  return value as unknown as Installed;
}

function agentList(value: unknown): CliAgent[] | undefined {
  const agents = isRecord(value) ? value.agents : undefined;
  if (!Array.isArray(agents) || !agents.every(a => isRecord(a) && typeof a.key === 'string' && typeof a.label === 'string')) return undefined;
  return agents.map(({ key, label }: CliAgent) => ({ key, label }));
}

/** Create a spec in `root`. The CLI checks the name; a refusal comes back unchanged and nothing was written. */
export function newSpec(run: RunCli, root: string, req: NewSpecRequest): Promise<CliOutcome<Created>> {
  return runJson(run, root, newSpecArgs(req), created, 'steno new');
}

/**
 * Set `root` up for these agents, none meaning the shared skills folder only. A folder inside another steno project
 * is refused without running the CLI: the explicit `--root` would otherwise make `init` set it up as given.
 */
export async function setUp(run: RunCli, root: string, agents: string[], exists: (p: string) => boolean): Promise<CliOutcome<Installed>> {
  const project = parentProject(root, exists);
  if (project) {
    const error: StructuredError = { ...failed(`this folder is inside the steno project at ${project}; open that project instead`), file: project };
    return { ok: false, error };
  }
  return runJson(run, root, ['init', `--agent=${agents.join(',')}`], installed, 'steno init');
}

/** The agents `steno init` can install skills for, as the CLI lists them. */
export function listAgents(run: RunCli, root: string): Promise<CliOutcome<CliAgent[]>> {
  return runJson(run, root, ['init', '--list-agents'], agentList, 'steno init');
}
