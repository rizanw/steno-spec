// Everything the panel and the worker say to each other. The panel never reads files or runs steno: it sends one
// of these requests and draws the snapshots the worker posts. Orca names each request, so the union below is also
// declared to Orca as its typed request map, which both sides then check against.
import type { StructuredError } from '@steno/core';
import type { PanelAction, PanelRow } from '@steno/core/host';
import type { AgentSteno, ServerState } from '@steno/host';

/** An agent already running in a terminal of the worktree, which a hand-off can be typed into. */
export interface RunningAgent { terminalId: string; agent: string; title: string | null }

/** The prompts the panel can show; the worker names one when an action needs an answer first. */
export type Form = 'newSpec' | 'setUp' | 'agentPick' | 'defaultAgent' | 'reopenConfirm';

/**
 * `steno.submit` carries a form's answers by field: `newSpec` kind, name, title, description, writer (`self` or
 * `agent`) and agent; `setUp` agents, comma-separated keys; `agentPick` the row's action and either the agent to
 * start or the `terminal` of a running agent to type into (with that agent's kind as `agent`); `defaultAgent` the
 * agent to hand off to from now on.
 */
export type Request =
  | { type: 'steno.panel' }
  | { type: 'steno.act'; key: string; action: PanelAction | 'restart' | 'chooseAgent' }
  | { type: 'steno.submit'; form: Form; key?: string; answers: Record<string, string> }
  | { type: 'steno.recheck' };

export type RequestType = Request['type'];
export const REQUEST_TYPES = ['steno.panel', 'steno.act', 'steno.submit', 'steno.recheck'] as const satisfies readonly RequestType[];

/**
 * What an action or a submitted form led to: it ran, it needs a form answered first (`choices` lists the agents for
 * `agentPick` and `setUp`, and `running` the agents an `agentPick` can type into), steno refused it, or there was
 * nothing to do and the text says why.
 */
export type ActResult =
  | { done: true }
  | { form: Form; key?: string; choices?: string[]; running?: RunningAgent[] }
  | { refusal: StructuredError }
  | { nothing: string };

/** Everything the panel draws for the active worktree, sent whole on every change. */
export interface Snapshot {
  specRows: PanelRow[]; steeringRows: PanelRow[]; server: ServerState; agentSteno: AgentSteno; refusal?: StructuredError;
  /** the agent this worktree hands work to without asking; none until the user picks one */
  defaultAgent?: string;
}

export type Post = { type: 'snapshot'; snapshot: Snapshot };

/** What each request answers with. */
export interface Responses { 'steno.panel': Snapshot; 'steno.act': ActResult; 'steno.submit': ActResult; 'steno.recheck': Snapshot }

export type RequestOf<T extends RequestType> = Extract<Request, { type: T }>;
/** A request's fields without its `type`, which travels as the Orca request name instead. */
export type InputOf<T extends RequestType> = Omit<RequestOf<T>, 'type'>;

type Declared = { [T in RequestType]: keyof InputOf<T> extends never ? { output: Responses[T] } : { input: InputOf<T>; output: Responses[T] } };

declare module 'orca' {
  interface PluginRequests extends Declared {}
  interface PluginPanelEvents { snapshot: Post }
}
