// The JSON contract: one source for every steno JSON shape and the protocol version.
// The shapes are plain data so they can be recorded (test/fixtures/contract.v<N>.json) and compared;
// the TypeScript types below are inferred from them, never written by hand.
import type { Phase } from './types.js';

export const PROTOCOL_VERSION = 1;

export const ERROR_CODES = ['not-set-up', 'invalid-request', 'not-found', 'unsupported',
  'unsaved-edits', 'lint-blocked', 'unreadable', 'failed'] as const;
export type ErrorCode = typeof ERROR_CODES[number];

// --- descriptor vocabulary ---------------------------------------------------------------
type Scalar = 'string' | 'number' | 'boolean' | 'true';
export type FieldType =
  | Scalar
  | { readonly enum: readonly string[] }
  | { readonly array: FieldType }
  | { readonly ref: string }
  | { readonly object: Fields }
  /** an object that may hold any subset of `keys`, each with the `value` type */
  | { readonly keys: readonly string[]; readonly value: FieldType }
  | { readonly nullable: FieldType };
export interface FieldSpec { readonly type: FieldType; readonly optional?: true }
export type Fields = { readonly [name: string]: FieldSpec };

const req = <const T extends FieldType>(type: T) => ({ type });
const opt = <const T extends FieldType>(type: T) => ({ type, optional: true as const });

const PHASE = { enum: ['brief', 'requirements', 'design', 'tasks', 'execute', 'done'] } as const;
const V = req('number'); // protocolVersion on every top-level object

export const CONTRACT = {
  protocolVersion: PROTOCOL_VERSION,
  errorCodes: ERROR_CODES,
  lensCommands: ['steno.task.run', 'steno.task.done'],
  shapes: {
    Handshake: {
      serverInfo: req({ object: { name: req({ enum: ['steno'] }), version: req('string') } }),
      capabilities: req({ object: { experimental: req({ object: { steno: req({ object: { protocolVersion: V } }) } }) } }),
    },
    SpecTree: {
      protocolVersion: V, notSetUp: opt('true'),
      specs: req({ array: { ref: 'TreeSpec' } }), steering: req({ array: { ref: 'TreeSteering' } }),
      specsDir: opt('string'), steeringDir: opt('string'),
    },
    TreeSpec: {
      name: req('string'),
      title: opt('string'), kind: opt({ enum: ['feature', 'bugfix'] }), mode: opt({ enum: ['gated', 'quick'] }), phase: opt(PHASE),
      approvals: opt({ keys: ['requirements', 'design', 'tasks'], value: { nullable: 'string' } }),
      tasks: opt({ ref: 'TaskCounts' }),
      next: opt({ nullable: { object: { id: req('string'), title: req('string') } } }),
      documents: opt({ array: 'string' }),
      taskItems: opt({ array: { ref: 'OutlineItem' } }), written: opt('true'),
      unsupported: opt('true'), unreadable: opt('true'),
      files: opt({ array: { object: { file: req('string'), reason: req('string') } } }),
    },
    TaskCounts: { total: req('number'), done: req('number'), optionalTotal: req('number'), optionalDone: req('number') },
    TreeSteering: {
      path: req('string'), inclusion: opt({ enum: ['always', 'fileMatch', 'manual'] }), pattern: opt('string'),
      unreadable: opt('true'), reason: opt('string'),
    },
    TaskPacket: {
      protocolVersion: V, spec: req('string'), task: req('string'), text: req('string'),
      tokens: req('number'), budget: req('number'), files: req({ array: 'string' }), trimmed: req({ array: 'string' }),
    },
    ChangeResult: {
      protocolVersion: V, spec: req('string'), phase: req(PHASE),
      task: opt('string'), done: opt('boolean'), approved: opt(PHASE), forced: opt('true'), created: opt({ array: 'string' }),
    },
    DiagnosticList: { protocolVersion: V, spec: opt('string'), diagnostics: req({ array: { ref: 'Diagnostic' } }) },
    Diagnostic: {
      file: req('string'), line: req('number'), severity: req({ enum: ['error', 'warning'] }),
      rule: req('string'), message: req('string'), spec: opt('string'),
    },
    Outline: { protocolVersion: V, spec: req('string'), document: req('string'), items: req({ array: { ref: 'OutlineItem' } }) },
    OutlineItem: {
      kind: req({ enum: ['requirement', 'criterion', 'section', 'task', 'heading'] }),
      id: opt('string'), title: req('string'), line: req('number'), endLine: req('number'),
      children: req({ array: { ref: 'OutlineItem' } }),
      done: opt('boolean'), optional: opt('boolean'),
    },
    StructuredError: {
      protocolVersion: V, code: req({ enum: ERROR_CODES }), message: req('string'),
      field: opt('string'), file: opt('string'), spec: opt('string'), reason: opt('string'),
      findings: opt({ array: { ref: 'Diagnostic' } }),
    },
  },
} as const;

// --- inferred types ------------------------------------------------------------------------
type Shapes = typeof CONTRACT.shapes;
export type ShapeName = keyof Shapes;
type Simplify<T> = { [K in keyof T]: T[K] } & {};
type TypeOf<T> =
  T extends 'string' ? string : T extends 'number' ? number : T extends 'boolean' ? boolean : T extends 'true' ? true :
  T extends { enum: readonly (infer E)[] } ? E :
  T extends { array: infer E } ? TypeOf<E>[] :
  T extends { ref: infer N extends ShapeName } ? Shape<Shapes[N]> :
  T extends { object: infer F } ? Shape<F> :
  T extends { keys: readonly (infer K extends string)[]; value: infer E } ? { [P in K]?: TypeOf<E> } :
  T extends { nullable: infer E } ? TypeOf<E> | null : never;
type OptKeys<F> = { [K in keyof F]: F[K] extends { optional: true } ? K : never }[keyof F];
export type Shape<F> = Simplify<
  { -readonly [K in Exclude<keyof F, OptKeys<F>>]: F[K] extends { type: infer T } ? TypeOf<T> : never } &
  { -readonly [K in OptKeys<F>]?: F[K] extends { type: infer T } ? TypeOf<T> : never }>;

export type Handshake = Shape<Shapes['Handshake']>;
export type SpecTree = Shape<Shapes['SpecTree']>;
export type TreeSpec = Shape<Shapes['TreeSpec']>;
export type TaskCounts = Shape<Shapes['TaskCounts']>;
export type TreeSteering = Shape<Shapes['TreeSteering']>;
export type TaskPacket = Shape<Shapes['TaskPacket']>;
export type ChangeResult = Shape<Shapes['ChangeResult']>;
export type DiagnosticList = Shape<Shapes['DiagnosticList']>;
export type Diagnostic = Shape<Shapes['Diagnostic']>;
export type Outline = Shape<Shapes['Outline']>;
export type OutlineItem = Shape<Shapes['OutlineItem']>;
export type StructuredError = Shape<Shapes['StructuredError']>;

// The contract's phase list must stay the same set as `Phase` in types.ts.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const phasesMatch: Same<typeof PHASE.enum[number], Phase> = true;
void phasesMatch;

// --- the one error type ----------------------------------------------------------------------
export interface StenoErrorInfo { field?: string; file?: string; spec?: string; reason?: string; findings?: Diagnostic[] }

export class StenoError extends Error {
  readonly code: ErrorCode;
  readonly field?: string; readonly file?: string; readonly spec?: string; readonly reason?: string;
  readonly findings?: Diagnostic[];
  constructor(code: ErrorCode, message: string, info: StenoErrorInfo = {}) {
    super(message);
    this.name = 'StenoError';
    this.code = code;
    for (const k of ['field', 'file', 'spec', 'reason', 'findings'] as const) if (info[k] !== undefined) (this as any)[k] = info[k];
  }
}

/** The structured error for any thrown value; anything that is not a StenoError is `failed`. */
export function toStructuredError(err: unknown): StructuredError {
  if (!(err instanceof StenoError)) return { protocolVersion: PROTOCOL_VERSION, code: 'failed', message: err instanceof Error ? err.message : String(err) };
  const out: StructuredError = { protocolVersion: PROTOCOL_VERSION, code: err.code, message: err.message };
  if (err.field !== undefined) out.field = err.field;
  if (err.file !== undefined) out.file = err.file;
  if (err.spec !== undefined) out.spec = err.spec;
  if (err.reason !== undefined) out.reason = err.reason;
  if (err.findings !== undefined) out.findings = err.findings;
  return out;
}

// --- compatibility check against a recorded contract ------------------------------------------
export interface ContractRecord { protocolVersion: number; errorCodes: readonly string[]; lensCommands: readonly string[]; shapes: Record<string, Fields> }

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join('\0') === [...b].sort().join('\0');

function typeBreaks(path: string, was: FieldType, now: FieldType, out: string[]): void {
  const kind = (t: FieldType) => typeof t === 'string' ? t : 'keys' in t ? 'keys' : Object.keys(t)[0];
  if (kind(was) !== kind(now)) { out.push(`${path}: type changed from ${JSON.stringify(was)} to ${JSON.stringify(now)}`); return; }
  if (typeof was === 'string' || typeof now === 'string') return;
  if ('enum' in was && 'enum' in now) { if (!sameSet(was.enum, now.enum)) out.push(`${path}: values changed from [${was.enum}] to [${now.enum}]`); return; }
  if ('ref' in was && 'ref' in now) { if (was.ref !== now.ref) out.push(`${path}: type changed from ${was.ref} to ${now.ref}`); return; }
  if ('object' in was && 'object' in now) { fieldBreaks(path, was.object, now.object, out); return; }
  if ('keys' in was && 'keys' in now) {
    if (!sameSet(was.keys, now.keys)) out.push(`${path}: keys changed from [${was.keys}] to [${now.keys}]`);
    typeBreaks(`${path}{}`, was.value, now.value, out); return;
  }
  if ('array' in was && 'array' in now) { typeBreaks(`${path}[]`, was.array, now.array, out); return; }
  if ('nullable' in was && 'nullable' in now) typeBreaks(path, was.nullable, now.nullable, out);
}

function fieldBreaks(path: string, was: Fields, now: Fields, out: string[]): void {
  for (const [name, w] of Object.entries(was)) {
    const n = now[name], at = `${path}.${name}`;
    if (!n) { out.push(`${at}: removed or renamed`); continue; }
    if (!!w.optional !== !!n.optional) out.push(`${at}: changed from ${w.optional ? 'optional' : 'required'} to ${n.optional ? 'optional' : 'required'}`);
    typeBreaks(at, w.type, n.type, out);
  }
}

/** Ways `now` breaks a Client written against `was`. Empty when the versions differ or nothing breaks;
 *  new fields and new shapes are allowed. */
export function contractBreaks(was: ContractRecord, now: ContractRecord): string[] {
  if (was.protocolVersion !== now.protocolVersion) return [];
  const out: string[] = [];
  if (!sameSet(was.errorCodes, now.errorCodes)) out.push(`errorCodes: changed from [${was.errorCodes}] to [${now.errorCodes}]`);
  if (!sameSet(was.lensCommands, now.lensCommands)) out.push(`lensCommands: changed from [${was.lensCommands}] to [${now.lensCommands}]`);
  for (const [name, fields] of Object.entries(was.shapes)) {
    if (!now.shapes[name]) out.push(`${name}: removed or renamed`);
    else fieldBreaks(name, fields, now.shapes[name], out);
  }
  return out;
}
