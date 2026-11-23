// The plugin's worker: Orca starts it on the panel's first request and passes it the host API. Every request goes
// through `dispatch`, so a request type with no handler fails to compile instead of failing in Orca.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Disposable, OrcaWorkerApi, PanelRequestContext } from 'orca/worker';
import type { RunCli } from '@steno/core/host';
import { createPool, type AgentSteno, type ServerPool } from '@steno/host';
import { REQUEST_TYPES, type ActResult, type InputOf, type RequestOf, type RequestType, type Responses, type Snapshot } from './shared/messages.js';
import { buildSnapshot, streamSnapshots } from './worker/snapshot.js';
import { applyChange, changeOf, CHANGES, type Change, type ChangeRequest } from './worker/changes.js';
import { bundledCli, createSpec, setUpChoices, setUpWorktree } from './worker/create.js';
import { launchable } from './worker/agents.js';
import { copyText, type Copy } from './worker/clipboard.js';
import { HANDOFF_ACTIONS, handoffFor, launch, nothingToHandOff, promptFor, runningAgents, sendTo, WAIT } from './worker/handoff.js';
import { openRow } from './worker/open.js';
import { checkAgentSteno, UNCHECKED } from './worker/agent-steno.js';
import { handoffRoute, saveAgent, savedAgent } from './worker/default-agent.js';
import { trackWorktree, type Active, type Orca } from './worker/worktree.js';

export type Handlers = { [T in RequestType]: (request: RequestOf<T>, context?: PanelRequestContext) => Promise<Responses[T]> };

export function dispatch<T extends RequestType>(handlers: Handlers, request: RequestOf<T>, context?: PanelRequestContext): Promise<Responses[T]> {
  return (handlers[request.type] as Handlers[T])(request, context);
}

const EMPTY: Snapshot = { specRows: [], steeringRows: [], server: 'starting', agentSteno: UNCHECKED };

/** Answers that keep the panel drawable until the real handlers land. */
export function stubHandlers(): Handlers {
  return {
    'steno.panel': async () => EMPTY,
    'steno.recheck': async () => EMPTY,
    'steno.act': async () => ({ nothing: 'steno is not ready yet.' }),
    'steno.submit': async () => ({ nothing: 'steno is not ready yet.' }),
  };
}

/**
 * A value as Orca accepts it across the panel bridge. Orca refuses a whole answer or post that holds an `undefined`,
 * where JSON would just leave the field out, and core's rows leave optional fields `undefined`: without this, every
 * steno project's panel fails to load while a folder that is not one still draws.
 */
export function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Registers one Orca handler per request type, each rebuilding the request from its name and input. */
export function answer(orca: Pick<OrcaWorkerApi, 'panels'>, handlers: Handlers): void {
  for (const type of REQUEST_TYPES) {
    orca.panels.handle(type, async (input: unknown, context: PanelRequestContext) =>
      plain(await dispatch(handlers, { ...(input as InputOf<typeof type> | undefined), type } as RequestOf<typeof type>, context)));
  }
}

/**
 * The handlers for the focused worktree: its servers come from `pool`, `run` starts the bundled CLI, and every change
 * to it is posted to the open panels whole. `check` finds the agents' `steno`, each time the worktree changes and on
 * the panel's Re-check. Requests that have no real handler yet keep their stub answer. A skill call that cannot be
 * typed into its agent is given to `copy`; without it nothing is copied, so tests leave the clipboard alone.
 */
export function liveHandlers(
  orca: Orca & Pick<OrcaWorkerApi, 'panels' | 'log'>, pool: ServerPool, run: RunCli, check: () => Promise<AgentSteno> = () => checkAgentSteno(),
  copy?: Copy,
): { handlers: Handlers } & Disposable {
  let active: Active | undefined;
  let stream: AbortController | undefined;
  let refresh = () => {};
  // the last change steno refused, drawn in every snapshot until another change runs or the worktree changes
  let failure: unknown;
  let found = UNCHECKED;
  const agentSteno = () => found;
  // Only the latest check's answer is kept: a slow one started before a Re-check must not bring an old warning back.
  let checks = 0;
  const recheck = async () => {
    const mine = ++checks;
    const result = await check().catch(() => UNCHECKED);
    if (mine !== checks) return;
    found = result;
    refresh();
  };
  // the active worktree's saved agent, read when the worktree changes and kept current by every save
  let defaultAgent: string | undefined;
  const withAgent = (snapshot: Snapshot): Snapshot => (defaultAgent ? { ...snapshot, defaultAgent } : snapshot);
  const loadAgent = async (folder: string) => {
    const agent = await savedAgent(orca, folder);
    if (active?.folder !== folder) return;
    defaultAgent = agent;
    refresh();
  };
  const post = (snapshot: Snapshot) => orca.panels.post('snapshot', plain({ type: 'snapshot', snapshot: withAgent(snapshot) }));
  const tracker = trackWorktree(orca, pool, next => {
    stream?.abort();
    stream = undefined;
    refresh = () => {};
    failure = undefined;
    defaultAgent = undefined;
    active = next;
    // a panel left drawing the previous worktree would offer actions on files that are no longer focused
    if (!next) { post(EMPTY); return; }
    stream = new AbortController();
    ({ refresh } = streamSnapshots(next, post, stream.signal, { agentSteno, failure: () => failure, log: line => orca.log(line) }));
    // a steno installed since the last worktree, or a PATH changed with it, shows on the next focus
    void recheck();
    void loadAgent(next.folder);
  });
  const current = async () => (active ? withAgent(await buildSnapshot(active, agentSteno(), failure)) : EMPTY);
  const rowAt = async (at: Active, key: string | undefined) => {
    const { specRows, steeringRows } = await buildSnapshot(at, agentSteno());
    return [...specRows, ...steeringRows].find(r => r.key === key);
  };
  const change = async (at: Active, req: ChangeRequest | undefined): Promise<ActResult> => {
    if (!req) return { nothing: 'That row does not offer this action any more.' };
    const result = await applyChange(orca, at.server, req);
    failure = 'refusal' in result ? result.refusal : undefined;
    refresh();
    return result;
  };
  const stub = stubHandlers();
  return {
    handlers: {
      ...stub,
      'steno.panel': current,
      'steno.recheck': async () => { await recheck(); return current(); },
      'steno.act': async request => {
        const { action } = request;
        if (action !== 'restart' && action !== 'open' && action !== 'newSpec' && action !== 'setUp' && action !== 'chooseAgent'
          && !CHANGES.includes(action) && !HANDOFF_ACTIONS.includes(action)) {
          return stub['steno.act'](request);
        }
        if (!active) return { nothing: 'No worktree is focused.' };
        // the CLI runs only once the form is submitted, so a cancelled form creates nothing
        if (action === 'newSpec') return { form: 'newSpec', choices: launchable() };
        if (action === 'setUp') return setUpChoices(orca, active, run);
        if (action === 'chooseAgent') return { form: 'defaultAgent', choices: launchable() };
        if (HANDOFF_ACTIONS.includes(action)) {
          const handoff = handoffFor(await rowAt(active, request.key), action);
          if (!handoff) return { nothing: 'That row does not offer this action any more.' };
          // said before the pick, so the user is not asked for an agent that would get nothing to do
          if (promptFor(handoff, 'plain') === undefined) return nothingToHandOff(orca);
          const saved = await savedAgent(orca, active.folder);
          const running = await runningAgents(orca, active.workspaceId);
          const route = handoffRoute(saved, running);
          if (route === 'pick') return { form: 'agentPick', key: request.key, choices: launchable(), running };
          if (route === 'runningPick') return { form: 'agentPick', key: request.key, choices: [saved!], running: running.filter(r => r.agent === saved) };
          const started = await launch(orca, active.workspaceId, handoff, saved!, WAIT, copy);
          return 'launched' in started ? { done: true } : started;
        }
        if (action === 'open') return openRow(orca, active, await rowAt(active, request.key));
        // reopening undoes a step taken on purpose, so it waits for the panel's Confirm
        if (action === 'reopen' || action === 'reopenSpec') {
          return changeOf(await rowAt(active, request.key), action) ? { form: 'reopenConfirm', key: request.key } : change(active, undefined);
        }
        if (action !== 'restart') return change(active, changeOf(await rowAt(active, request.key), action as Change));
        // the restarted server reports its new state through `onChange`, which the stream posts
        pool.restart(active.folder);
        return { done: true };
      },
      'steno.submit': async request => {
        if (!active) return { nothing: 'No worktree is focused.' };
        if (request.form === 'agentPick') {
          const { action = '', agent, terminal } = request.answers;
          const handoff = handoffFor(await rowAt(active, request.key), action);
          if (!handoff) return { nothing: 'That row does not offer this action any more.' };
          // the first pick in a worktree becomes its agent, as the VS Code extension saves the first one it is given
          if (agent && launchable().includes(agent) && await savedAgent(orca, active.folder) === undefined) {
            await saveAgent(orca, active.folder, agent).catch(() => undefined);
            defaultAgent = agent;
            refresh();
          }
          if (terminal) {
            const sent = await sendTo(orca, active.workspaceId, terminal, handoff, copy);
            return 'sent' in sent ? { done: true } : sent;
          }
          if (!agent) return { nothing: 'No agent was picked.' };
          const started = await launch(orca, active.workspaceId, handoff, agent, WAIT, copy);
          return 'launched' in started ? { done: true } : started;
        }
        if (request.form === 'defaultAgent') {
          const { agent = '' } = request.answers;
          if (!launchable().includes(agent)) return { nothing: `Orca cannot start ${agent || 'that agent'}.` };
          await saveAgent(orca, active.folder, agent);
          defaultAgent = agent;
          refresh();
          return { done: true };
        }
        if (request.form === 'newSpec' || request.form === 'setUp') {
          const result = request.form === 'newSpec'
            ? await createSpec(orca, active, run, request.answers, undefined, copy)
            : await setUpWorktree(orca, active, run, request.answers);
          refresh();
          return result;
        }
        const row = await rowAt(active, request.key);
        return change(active, changeOf(row, row?.kind === 'task' ? 'reopen' : 'reopenSpec'));
      },
    },
    dispose() { stream?.abort(); tracker.dispose(); },
  };
}

let running: Disposable | undefined;

export default function activate(orca: OrcaWorkerApi): void {
  // build.mjs copies the bundled language server and CLI to vendor/ beside this file
  const vendor = join(dirname(fileURLToPath(import.meta.url)), 'vendor');
  const pool = createPool({ source: { files: vendor }, log: line => orca.log(line) });
  const live = liveHandlers(orca, pool, bundledCli({ files: vendor }), undefined, copyText);
  answer(orca, live.handlers);
  running = { dispose() { live.dispose(); pool.dispose(); } };
}

export function deactivate(): void {
  running?.dispose();
  running = undefined;
}
