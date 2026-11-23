// New Spec and Set Up through the bundled CLI, so a spec is created and a folder set up exactly as `steno new` and
// `steno init` would in a terminal. The panel's forms only collect answers; nothing is written until one is
// submitted, so a cancelled form leaves the worktree as it was.
import { existsSync } from 'node:fs';
import type { OrcaWorkerApi } from 'orca/worker';
import {
  documentPath, failed, listAgents, newSpec, parentProject, readRefusal, setUp,
  type CliExit, type CliOutcome, type Installed, type NewSpecRequest, type RunCli,
} from '@steno/core/host';
import { runToEnd, type ProgramSource } from '@steno/host';
import type { ActResult } from '../shared/messages.js';
import { launch } from './handoff.js';
import { openPath } from './open.js';
import type { Active } from './worktree.js';

type Orca = Pick<OrcaWorkerApi, 'host' | 'log'>;

/** The CLI copied beside the worker, run to its end in `cwd`. */
export const bundledCli = (source: ProgramSource): RunCli => (args, cwd) => runToEnd(source, 'steno-cli.mjs', args, { cwd });

/** The form's answers as core's request. The name is left for the CLI to check, so only the kind is read strictly. */
export function specRequest(answers: Record<string, string>): NewSpecRequest {
  const title = answers.title?.trim(), description = answers.description?.trim();
  return {
    kind: answers.kind === 'bugfix' ? 'bugfix' : 'feature', name: answers.name?.trim() ?? '',
    writer: answers.writer === 'agent' ? 'agent' : 'self',
    ...(title ? { title } : {}), ...(description ? { description } : {}),
  };
}

/** Whether the CLI ended by saying no on purpose: a structured answer on exit 1 or 2, as `readCliExit` reads one. */
function refusedOnPurpose(exit: CliExit | undefined): boolean {
  if (!exit || (exit.code !== 1 && exit.code !== 2)) return false;
  try { return readRefusal(JSON.parse(exit.stdout)) !== undefined; } catch { return false; }
}

/** `run`, remembering how its last run ended. */
function watched(run: RunCli): { run: RunCli; last: () => CliExit | undefined } {
  let exit: CliExit | undefined;
  return { run: async (args, cwd) => (exit = await run(args, cwd)), last: () => exit };
}

/**
 * What the panel hears when a CLI run gave no answer. A refusal goes back to the panel to draw. A run that crashed
 * or could not start is not steno saying no: its message goes to a notification and its full standard error to the
 * plugin log. steno reports a bad spec name with the same `failed` code a crash gets, so the two are told apart by
 * how the CLI ended, not by the code.
 */
async function noAnswer(orca: Orca, what: string, outcome: Extract<CliOutcome<unknown>, { ok: false }>, exit: CliExit | undefined): Promise<ActResult> {
  if (refusedOnPurpose(exit)) return { refusal: outcome.error };
  if (outcome.log) orca.log(`steno: ${outcome.error.message}\n${outcome.log}`);
  await orca.host.call('notifications.show', { title: `${what} failed`, body: outcome.error.message }).catch(() => undefined);
  return { done: true };
}

/**
 * Create the spec the answers describe in the active worktree and open its first document. When the answers chose a
 * coding agent to write it, that agent starts on it straight away, with no second pick.
 */
export async function createSpec(orca: Orca, active: Active, run: RunCli, answers: Record<string, string>,
  exists?: (path: string) => boolean): Promise<ActResult> {
  const cli = watched(run);
  const outcome = await newSpec(cli.run, active.folder, specRequest(answers));
  if (!outcome.ok) return noAnswer(orca, 'New Spec', outcome, cli.last());
  const { spec, phase, created = [] } = outcome.value;
  if (created[0]) await openPath(orca, active, documentPath(active.server.tree, spec, created[0]), exists);
  // the spec exists either way, so an agent that does not start is reported and the creation still stands
  if (answers.writer === 'agent' && answers.agent) await launch(orca, active.workspaceId, { kind: 'write', spec, phase }, answers.agent);
  return { done: true };
}

/**
 * The first step of Set Up: the agents to pick from, by key. A worktree inside another steno project is refused
 * before the list is asked for, since setting it up would start a second project inside the first.
 */
export async function setUpChoices(orca: Orca, active: Active, run: RunCli,
  exists: (path: string) => boolean = existsSync): Promise<ActResult> {
  const project = parentProject(active.folder, exists);
  if (project) return { refusal: { ...failed(`this worktree is inside the steno project at ${project}; open that project instead`), file: project } };
  const cli = watched(run);
  const outcome = await listAgents(cli.run, active.folder);
  if (!outcome.ok) return noAnswer(orca, 'Set Up', outcome, cli.last());
  return { form: 'setUp', choices: outcome.value.map(a => a.key) };
}

/** The notification that says what Set Up installed and where. */
export function installedMessage(installed: Installed): { title: string; body: string } {
  const agents = Object.entries(installed.agents).map(([agent, dir]) => `${agent} (${dir})`);
  const body = [`Skills: ${installed.skills.join(', ') || 'none'}.`, `Agents: ${agents.join(', ') || 'the shared skills folder only'}.`, ...(installed.warnings ?? [])];
  return { title: 'steno is set up', body: body.join(' ') };
}

/**
 * Set the active worktree up for the agents picked, sent as `agents`, a comma-separated list of keys; none means the
 * shared skills folder only. `setUp` checks for an enclosing project again in case one appeared since the pick.
 */
export async function setUpWorktree(orca: Orca, active: Active, run: RunCli, answers: Record<string, string>,
  exists: (path: string) => boolean = existsSync): Promise<ActResult> {
  const agents = (answers.agents ?? '').split(',').map(a => a.trim()).filter(Boolean);
  const cli = watched(run);
  const outcome = await setUp(cli.run, active.folder, agents, exists);
  if (!outcome.ok) return outcome.error.file && !cli.last() ? { refusal: outcome.error } : noAnswer(orca, 'Set Up', outcome, cli.last());
  await orca.host.call('notifications.show', installedMessage(outcome.value)).catch(() => undefined);
  return { done: true };
}
