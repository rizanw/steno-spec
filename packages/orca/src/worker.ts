// The plugin's worker: Orca starts it on the panel's first request and passes it the host API. Every request goes
// through `dispatch`, so a request type with no handler fails to compile instead of failing in Orca.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Disposable, OrcaWorkerApi, PanelRequestContext } from 'orca/worker';
import { createPool, type AgentSteno, type ServerPool } from '@steno/host';
import { REQUEST_TYPES, type InputOf, type RequestOf, type RequestType, type Responses, type Snapshot } from './shared/messages.js';
import { buildSnapshot, streamSnapshots } from './worker/snapshot.js';
import { trackWorktree, type Active, type Orca } from './worker/worktree.js';

export type Handlers = { [T in RequestType]: (request: RequestOf<T>, context?: PanelRequestContext) => Promise<Responses[T]> };

export function dispatch<T extends RequestType>(handlers: Handlers, request: RequestOf<T>, context?: PanelRequestContext): Promise<Responses[T]> {
  return (handlers[request.type] as Handlers[T])(request, context);
}

// Until the agents' `steno` is checked, nothing warns about it.
const UNCHECKED: AgentSteno = { found: false, matches: true, bundled: '' };
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
 * The handlers for the focused worktree: its servers come from `pool`, and every change to it is posted to the open
 * panels whole. Requests that have no real handler yet keep their stub answer.
 */
export function liveHandlers(orca: Orca & Pick<OrcaWorkerApi, 'panels' | 'log'>, pool: ServerPool): { handlers: Handlers } & Disposable {
  let active: Active | undefined;
  let stream: AbortController | undefined;
  const agentSteno = () => UNCHECKED;
  const post = (snapshot: Snapshot) => orca.panels.post('snapshot', plain({ type: 'snapshot', snapshot }));
  const tracker = trackWorktree(orca, pool, next => {
    stream?.abort();
    stream = undefined;
    active = next;
    // a panel left drawing the previous worktree would offer actions on files that are no longer focused
    if (!next) { post(EMPTY); return; }
    stream = new AbortController();
    streamSnapshots(next, post, stream.signal, { agentSteno, log: line => orca.log(line) });
  });
  const current = async () => (active ? buildSnapshot(active, agentSteno()) : EMPTY);
  const stub = stubHandlers();
  return {
    handlers: {
      ...stub,
      'steno.panel': current,
      'steno.recheck': current,
      'steno.act': async request => {
        if (request.action !== 'restart') return stub['steno.act'](request);
        if (!active) return { nothing: 'No worktree is focused.' };
        // the restarted server reports its new state through `onChange`, which the stream posts
        pool.restart(active.folder);
        return { done: true };
      },
    },
    dispose() { stream?.abort(); tracker.dispose(); },
  };
}

let running: Disposable | undefined;

export default function activate(orca: OrcaWorkerApi): void {
  // build.mjs copies the bundled language server and CLI to vendor/ beside this file
  const pool = createPool({ source: { files: join(dirname(fileURLToPath(import.meta.url)), 'vendor') }, log: line => orca.log(line) });
  const live = liveHandlers(orca, pool);
  answer(orca, live.handlers);
  running = { dispose() { live.dispose(); pool.dispose(); } };
}

export function deactivate(): void {
  running?.dispose();
  running = undefined;
}
