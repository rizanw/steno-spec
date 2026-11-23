// Where a hand-off puts its skill call, and the steps that put it there. The call always lands unsent, so the user
// reads it before the agent runs it. No React here: `client/agents.tsx` and `client/drafts.tsx` supply the live
// agents, drafts and composers, and the rules are tested directly.
import type { Action, Handoff, Phase, Row } from '../shared/contracts';

/** An agent of the panel's workspace, as the hand-off needs it. */
export interface AgentInfo { id: string; provider: string; lastActivityAt: string }

export type Target =
  | { kind: 'focused'; agentId: string; provider: string }
  | { kind: 'draft'; provider: string | null }
  | { kind: 'recent'; agentId: string; provider: string }
  | { kind: 'clipboard' };

/**
 * The agent the user has open, when it belongs to this workspace; else the New Agent screen, when exactly one is
 * open; else the workspace's most recently active agent, when Paseo can open it; else the clipboard. A New Agent
 * screen does not say which workspace it is in, so with several open none is safe to pick.
 */
export function chooseTarget(focusedAgentId: string | null, agents: readonly AgentInfo[], canOpen: boolean, draftProviders: readonly (string | null)[] = []): Target {
  const focused = focusedAgentId === null ? undefined : agents.find(a => a.id === focusedAgentId);
  if (focused) return { kind: 'focused', agentId: focused.id, provider: focused.provider };
  if (draftProviders.length === 1) return { kind: 'draft', provider: draftProviders[0] };
  if (!canOpen || agents.length === 0) return { kind: 'clipboard' };
  const recent = agents.reduce((a, b) => (Date.parse(b.lastActivityAt) > Date.parse(a.lastActivityAt) ? b : a));
  return { kind: 'recent', agentId: recent.id, provider: recent.provider };
}

/** The hand-off a row's action asks for, or none when the action is not a hand-off or the row lacks its target. */
export function handoffFor(row: Row | undefined, action: Action): Handoff | undefined {
  if (action === 'steer') return { kind: 'steer' };
  const target = row?.target;
  if (!target) return undefined;
  if (action === 'run') return target.task ? { kind: 'run', spec: target.spec, task: target.task } : undefined;
  if (action === 'runNext') return { kind: 'run', spec: target.spec };
  if (action === 'write' || action === 'review') return target.phase ? { kind: action, spec: target.spec, phase: target.phase } : undefined;
  return undefined;
}

const HANDOFF_ACTIONS: readonly Action[] = ['run', 'runNext', 'write', 'review', 'steer'];

/** The part of Paseo's composer a hand-off uses. */
export interface ComposerLike { insertText(text: string): void; focus(): Promise<void> }

export type CallText = { ok: true; text: string; plain: string } | { ok: false; message: string };

export interface HandoffDeps {
  /** The skill call worded for `provider`, from the server. */
  call(provider?: string): Promise<CallText>;
  /** The focused composer when it is this agent's, else nothing. Read again on every poll. */
  focusedComposer(agentId: string): ComposerLike | undefined;
  openAgent(agentId: string): void;
  /** The one open New Agent screen's composer, read when the call is placed. */
  draftComposer(): ComposerLike | undefined;
  sleep(ms: number): Promise<void>;
  copy(text: string): Promise<void>;
  notify(message: string, variant: 'info' | 'error'): void;
  /** How to paste here, such as "press ⌘V"; it ends each toast that leaves the call on the clipboard. */
  paste: string;
}

/** How long an opened agent has to take focus before the call goes to the clipboard instead. */
export const READY_TIMEOUT_MS = 2000;
const POLL_MS = 100;

/** Whether the call landed in a message box, went to the clipboard, or went nowhere. */
export type HandoffResult = 'inserted' | 'copied' | 'refused' | 'failed';

export async function performHandoff(target: Target, deps: HandoffDeps): Promise<HandoffResult> {
  const provider = target.kind === 'clipboard' ? undefined : target.provider ?? undefined;
  const call = await deps.call(provider);
  if (!call.ok) { deps.notify(call.message, 'error'); return 'refused'; }
  // Each toast says what happened, then what to do. The call itself is left out: it is on the clipboard, and a toast
  // holds little. Only when copying fails does the toast carry the call, since it is then the one place it is.
  const toClipboard = async (why: string, then: string): Promise<HandoffResult> => {
    try {
      await deps.copy(call.plain);
      deps.notify(`${why} It's copied: ${then}.`, 'info');
      return 'copied';
    } catch {
      deps.notify(`${why} Copying failed too, so type this into an agent: ${call.plain}`, 'error');
      return 'failed';
    }
  };
  if (target.kind === 'clipboard') return toClipboard('No agent is open.', `open one and ${deps.paste}`);
  let composer = target.kind === 'draft' ? deps.draftComposer() : deps.focusedComposer(target.agentId);
  if (!composer && target.kind === 'recent') {
    deps.openAgent(target.agentId);
    for (let waited = 0; !composer && waited < READY_TIMEOUT_MS; waited += POLL_MS) {
      await deps.sleep(POLL_MS);
      composer = deps.focusedComposer(target.agentId);
    }
  }
  if (!composer) return toClipboard('The agent took too long to open.', `${deps.paste} in its message box`);
  try {
    composer.insertText(call.text);
  } catch {
    return toClipboard("The agent's message box didn't take it.", `${deps.paste} there`);
  }
  // the text is already in place; a composer that will not take focus only means the user clicks it
  composer.focus().catch(() => {});
  return 'inserted';
}

export type Writer = 'agent' | 'brainstorm' | 'me';

/**
 * The hand-off after New Spec created a spec: its first stage goes to an agent unless the user writes it, and
 * `phase` is the one the CLI reports, so a brief reaches the brainstorm skill and a bugfix its own document.
 */
export function creationHandoff(writer: Writer, spec: string | undefined, phase: Phase | undefined): Handoff | undefined {
  if (writer === 'me' || !spec || !phase) return undefined;
  return { kind: 'write', spec, phase };
}
