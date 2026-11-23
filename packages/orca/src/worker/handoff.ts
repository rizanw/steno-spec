// Handing a row's work to a coding agent: the agent the user picked gets the same short skill call the VS Code
// extension and the Paseo plugin send, such as `/steno-run T3.1 my-spec`, typed into its terminal in the focused
// worktree, whether Orca starts it now or it is already running there. Only when it cannot be typed there is it
// copied to the clipboard, as the Paseo plugin does, so a hand-off that worked leaves the user's clipboard alone.
import type { OrcaWorkerApi } from 'orca/worker';
import { callForm, render, skillCall, type Handoff, type PanelAction, type PanelRow } from '@steno/core/host';
import type { RunningAgent } from '../shared/messages.js';
import { orcaAgent, stenoAgent } from './agents.js';
import { PASTE_KEY, type Copy } from './clipboard.js';
import { orNotify } from './errors.js';

// `api` says which host calls take which parameters; a caller holding only part of the worker API may leave it out
type Orca = Pick<OrcaWorkerApi, 'host'> & { api?: OrcaWorkerApi['api'] };

export const HANDOFF_ACTIONS: readonly string[] = ['run', 'runNext', 'write', 'review', 'steer'] satisfies PanelAction[];

/** The hand-off a row's action asks for, or none when the row does not offer it or lacks what it needs. */
export function handoffFor(row: PanelRow | undefined, action: string): Handoff | undefined {
  if (!row?.actions.includes(action as PanelAction)) return undefined;
  if (action === 'steer') return { kind: 'steer' };
  const target = row.target;
  if (!target) return undefined;
  if (action === 'run') return target.task ? { kind: 'run', spec: target.spec, task: target.task } : undefined;
  if (action === 'runNext') return { kind: 'run', spec: target.spec };
  if (action === 'write' || action === 'review') return target.phase ? { kind: action, spec: target.spec, phase: target.phase } : undefined;
  return undefined;
}

/** The message `agent` is started with, worded as that agent takes a skill call; none when there is no skill to call. */
export function promptFor(handoff: Handoff, agent: string): string | undefined {
  const call = skillCall(handoff);
  return call && render(call, callForm(agent));
}

/** Say that there is nothing to hand off, where the user will see it whatever the panel is doing. */
export async function nothingToHandOff(orca: Orca): Promise<{ nothing: string }> {
  const nothing = 'This stage or task has nothing to hand off to an agent.';
  await orca.host.call('notifications.show', { title: 'Nothing to hand off', body: nothing }).catch(() => undefined);
  return { nothing };
}

/** How long a launched agent gets to start before its skill call goes to a notification, and how often to look. */
export interface Wait { timeoutMs: number; everyMs: number }
export const WAIT: Wait = { timeoutMs: 30_000, everyMs: 500 };


type Listed = { terminalId: string | null; title: string | null; agent: string | null };

/**
 * Orca's agents in the workspace. `agents.list` takes a workspace from host API 1.10; an older Orca lists the
 * focused workspace, which is the one the panel shows, so the id is left out there rather than refused.
 */
async function listed(orca: Orca, workspaceId: string): Promise<Listed[]> {
  const api = orca.api;
  const named = api !== undefined && (api.major > 1 || api.minor >= 10);
  const { agents } = await orca.host.call('agents.list', named ? { workspaceId } : undefined);
  return agents;
}

/** The agents running in a terminal of the workspace that steno can word a skill call for; none when Orca will not say. */
export async function runningAgents(orca: Orca, workspaceId: string): Promise<RunningAgent[]> {
  const agents = await listed(orca, workspaceId).catch((): Listed[] => []);
  return agents.flatMap(({ terminalId, title, agent }) => {
    const key = agent === null ? undefined : stenoAgent(agent);
    return terminalId && key ? [{ terminalId, agent: key, title }] : [];
  });
}

/**
 * The skill call could not be typed: copy it when the caller can, and say in a notification why and how to paste it.
 * The notice carries the call either way, since a copy that fails leaves it the one place the call is.
 */
async function pasteIt(orca: Orca, agent: string, prompt: string, why: string, copy?: Copy): Promise<{ nothing: string }> {
  const copied = copy ? await copy(prompt).catch(() => false) : false;
  const title = copied ? `Copied: press ${PASTE_KEY} in ${agent}` : `Paste this into ${agent}`;
  await orca.host.call('notifications.show', { title, body: prompt }).catch(() => undefined);
  return { nothing: why };
}

/**
 * Type `prompt` into the terminal without pressing Enter, as the other hosts leave it: the user reads the call, can
 * set the agent's model or effort first, and sends it themselves. Resolves to whether Orca took the text.
 */
async function typeInto(orca: Orca, terminalId: string, prompt: string): Promise<boolean> {
  try {
    const { accepted } = await orca.host.call('terminal.sendText', { terminalId, text: prompt, enter: false });
    return accepted;
  } catch { return false; }
}

/** Wait until Orca lists an agent in `terminalId`, up to the wait's limit. */
async function started(orca: Orca, workspaceId: string, terminalId: string, wait: Wait): Promise<boolean> {
  const end = Date.now() + wait.timeoutMs;
  for (;;) {
    const agents = await listed(orca, workspaceId).catch((): Listed[] => []);
    if (agents.some(a => a.terminalId === terminalId)) return true;
    if (Date.now() >= end) return false;
    await new Promise(resolve => setTimeout(resolve, wait.everyMs));
  }
}

/**
 * Start `agent`, a steno agent key, in the workspace, show its terminal and type the hand-off's skill call once
 * Orca sees the agent running there. Nothing starts when the hand-off has no skill to call or Orca cannot start
 * that agent; an agent Orca refuses to start is reported in a notification with Orca's reason.
 *
 * The call is not given to `agent.launch` as its prompt: Orca checks for a running agent the moment the terminal
 * opens, finds none yet, and drops the prompt with only a line in the plugin log. Answers once the terminal is
 * open; the wait goes on in `delivered`, since Orca gives a panel request 30 seconds, no more than the wait.
 * A call left to paste is also given to `copy`; without it nothing is copied.
 */
export async function launch(orca: Orca, workspaceId: string, handoff: Handoff, agent: string, wait: Wait = WAIT, copy?: Copy):
  Promise<{ launched: true; delivered: Promise<boolean> } | { nothing: string }> {
  const prompt = promptFor(handoff, agent);
  if (prompt === undefined) return nothingToHandOff(orca);
  const id = orcaAgent(agent);
  if (id === undefined) return { nothing: `Orca cannot start ${agent}.` };
  let terminalId: string | undefined;
  const opened = await orNotify(orca, `Starting ${agent}`, async () => {
    ({ terminalId } = await orca.host.call('agent.launch', { workspaceId, agent: id }));
  });
  if (!opened || !terminalId) return { nothing: `${agent} did not start.` };
  // A background tab gives no sign that anything started. A tab Orca will not bring forward still holds the agent.
  await orca.host.call('terminal.focus', { terminalId }).catch(() => undefined);
  const terminal = terminalId;
  const delivered = (async () => {
    if (!await started(orca, workspaceId, terminal, wait)) {
      await pasteIt(orca, agent, prompt, `${agent} did not start within ${wait.timeoutMs / 1000} seconds.`, copy);
      return false;
    }
    if (await typeInto(orca, terminal, prompt)) return true;
    await pasteIt(orca, agent, prompt, `Orca would not type into ${agent}'s terminal.`, copy);
    return false;
  })().catch(async (err: unknown) => {
    // nobody awaits this in the worker, so a rejection left unheard would end the worker
    await pasteIt(orca, agent, prompt, `The call did not reach ${agent}: ${err instanceof Error ? err.message : String(err)}`, copy);
    return false;
  });
  return { launched: true, delivered };
}

/**
 * Type the hand-off's skill call into an agent already running in `terminalId`, worded for that agent, and show its
 * terminal. The agent is looked up again because it may have exited since the user picked it; then, or when Orca
 * will not type into the terminal, the call goes to a notification to paste and to `copy`.
 */
export async function sendTo(orca: Orca, workspaceId: string, terminalId: string, handoff: Handoff, copy?: Copy): Promise<{ sent: true } | { nothing: string }> {
  if (skillCall(handoff) === undefined) return nothingToHandOff(orca);
  const running = (await runningAgents(orca, workspaceId)).find(a => a.terminalId === terminalId);
  if (!running) {
    // with no agent to word it for, the call is worded as the other hosts word it for a plain chat
    return pasteIt(orca, 'your agent', promptFor(handoff, 'plain') ?? '', 'That agent is no longer running.', copy);
  }
  const prompt = promptFor(handoff, running.agent) as string;
  if (!await typeInto(orca, terminalId, prompt)) return pasteIt(orca, running.agent, prompt, `Orca would not type into ${running.agent}'s terminal.`, copy);
  await orca.host.call('terminal.focus', { terminalId }).catch(() => undefined);
  return { sent: true };
}
