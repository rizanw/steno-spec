// Every RPC and subscription between the plugin's client and server, as Zod contracts both sides import. Paseo
// validates each call and event against them, so a shape changed here changes on both sides at once. The client
// bundle cannot reach core, so the enums core owns are written out here and checked against core's types below.
import { defineRpc, defineSubscription } from '@getpaseo/plugin';
import { z } from 'zod';
import type { Diagnostic as CoreDiagnostic, Handoff as CoreHandoff, HostAction, RowIcon as CoreRowIcon, StructuredError as CoreStructuredError, ChangeResult as CoreChangeResult } from '../server/vendor/host.mjs';

const workspaceId = z.string().min(1);

export const Phase = z.enum(['brief', 'requirements', 'design', 'tasks', 'execute', 'done']);
export type Phase = z.infer<typeof Phase>;

export const RowIcon = z.enum(['spec', 'execute', 'done', 'warning', 'document', 'finished', 'next', 'task', 'steering', 'instruction']);
export type RowIcon = z.infer<typeof RowIcon>;

/** Core's row actions, then the plugin's own: generate steering, open a file, create a spec, set the folder up. */
export const HOST_ACTIONS = ['approve', 'done', 'reopen', 'run', 'runNext', 'write', 'review'] as const;
export const Action = z.enum([...HOST_ACTIONS, 'steer', 'open', 'newSpec', 'setUp']);
export type Action = z.infer<typeof Action>;

/**
 * One visible line of the panel. `parent` is the key of the row it folds under; `target` is what its actions
 * apply to, so the client never parses `key`. `path` is relative to the workspace with `/` separators.
 */
export const Row = z.object({
  key: z.string(), parent: z.string().optional(), depth: z.number().int().min(0),
  kind: z.enum(['header', 'spec', 'document', 'task', 'steering', 'instruction', 'notice']),
  label: z.string(), detail: z.string().optional(), tooltip: z.string().optional(), icon: RowIcon.optional(),
  target: z.object({ spec: z.string(), task: z.string().optional(), phase: Phase.optional() }).optional(),
  path: z.string().optional(),
  problems: z.object({ errors: z.number().int().min(0), warnings: z.number().int().min(0) }).optional(),
  actions: z.array(Action), primary: Action.optional(),
}).refine(row => row.primary === undefined || row.actions.includes(row.primary), { message: 'primary must be one of the row\'s actions', path: ['primary'] });
export type Row = z.infer<typeof Row>;

export const Diagnostic = z.object({
  file: z.string(), line: z.number(), severity: z.enum(['error', 'warning']), rule: z.string(), message: z.string(), spec: z.string().optional(),
});
export type Diagnostic = z.infer<typeof Diagnostic>;

export const StructuredError = z.object({
  protocolVersion: z.number(),
  code: z.enum(['not-set-up', 'invalid-request', 'not-found', 'unsupported', 'unsaved-edits', 'lint-blocked', 'unreadable', 'failed']),
  message: z.string(), field: z.string().optional(), file: z.string().optional(), spec: z.string().optional(),
  reason: z.string().optional(), findings: z.array(Diagnostic).optional(),
});
export type StructuredError = z.infer<typeof StructuredError>;

export const ChangeResult = z.object({
  protocolVersion: z.number(), spec: z.string(), phase: Phase, task: z.string().optional(), done: z.boolean().optional(),
  approved: Phase.optional(), forced: z.literal(true).optional(), created: z.array(z.string()).optional(),
});
export type ChangeResult = z.infer<typeof ChangeResult>;

export const ServerState = z.enum(['starting', 'running', 'stopped']);
export type ServerState = z.infer<typeof ServerState>;

/** Everything the panel draws, pushed whole on every change. `intent` rides in one push only. */
export const PanelSnapshot = z.object({
  specRows: z.array(Row), steeringRows: z.array(Row),
  diagnostics: z.record(z.string(), z.array(Diagnostic)),
  server: ServerState,
  agentSteno: z.object({ found: z.boolean(), protocol: z.number().optional(), matches: z.boolean() }),
  intent: Action.optional(),
});
export type PanelSnapshot = z.infer<typeof PanelSnapshot>;

export const Handoff = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('run'), spec: z.string(), task: z.string().optional() }),
  z.object({ kind: z.literal('write'), spec: z.string(), phase: Phase }),
  z.object({ kind: z.literal('review'), spec: z.string(), phase: Phase }),
  z.object({ kind: z.literal('steer') }),
]);
export type Handoff = z.infer<typeof Handoff>;

/** A refusal is a value, not a thrown error, so the client can show its findings. */
export const ChangeOutcome = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), result: ChangeResult }),
  z.object({ ok: z.literal(false), error: StructuredError }),
]);
export type ChangeOutcome = z.infer<typeof ChangeOutcome>;

/** What a run of the bundled CLI gave: for `new`, the spec and the phase it starts in; for `init`, neither. */
export const CliOutcome = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), spec: z.string().optional(), phase: Phase.optional() }),
  z.object({ ok: z.literal(false), error: StructuredError }),
]);
export type CliOutcome = z.infer<typeof CliOutcome>;

const nothing = z.object({});

export const panel = defineSubscription({ name: 'steno.panel', input: z.object({ workspaceId }), event: PanelSnapshot });

export const readFile = defineRpc({ name: 'steno.read', input: z.object({ workspaceId, path: z.string().min(1) }), output: z.object({ text: z.string() }) });

export const change = defineRpc({
  name: 'steno.change',
  input: z.object({ workspaceId, kind: z.enum(['approve', 'done', 'reopen']), spec: z.string(), phase: Phase.optional(), task: z.string().optional() }),
  output: ChangeOutcome,
});

export const call = defineRpc({
  name: 'steno.call',
  input: z.object({ workspaceId, handoff: Handoff, provider: z.string().optional() }),
  output: z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), text: z.string(), plain: z.string() }),
    z.object({ ok: z.literal(false), message: z.string() }),
  ]),
});

export const newSpec = defineRpc({
  name: 'steno.new-spec',
  input: z.object({
    workspaceId, kind: z.enum(['feature', 'bugfix']), name: z.string(), title: z.string().optional(),
    writer: z.enum(['agent', 'brainstorm', 'me']), description: z.string().optional(),
  }),
  output: CliOutcome,
});

export const listAgents = defineRpc({
  name: 'steno.list-agents', input: z.object({ workspaceId }),
  output: z.object({ agents: z.array(z.object({ key: z.string(), label: z.string() })) }),
});

export const setUp = defineRpc({ name: 'steno.set-up', input: z.object({ workspaceId, agents: z.array(z.string()) }), output: CliOutcome });

export const intent = defineRpc({ name: 'steno.intent', input: z.object({ workspaceId, action: Action }), output: nothing });

export const restart = defineRpc({ name: 'steno.restart', input: z.object({ workspaceId }), output: nothing });

// Compile-time only: each copy above must stay the same set as core's, or typechecking fails here.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const agree: [
  Same<(typeof HOST_ACTIONS)[number], HostAction>, Same<RowIcon, CoreRowIcon>, Same<Diagnostic, CoreDiagnostic>,
  Same<StructuredError, CoreStructuredError>, Same<ChangeResult, CoreChangeResult>, Same<Handoff, CoreHandoff>,
] = [true, true, true, true, true, true];
void agree;
