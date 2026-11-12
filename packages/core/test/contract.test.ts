import { describe, it, expect, expectTypeOf } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONTRACT, ERROR_CODES, PROTOCOL_VERSION, StenoError, toStructuredError, contractBreaks,
  type ContractRecord, type OutlineItem, type TreeSpec, type StructuredError,
} from '../src/index.js';

const RECORD = join(import.meta.dirname, 'fixtures', `contract.v${PROTOCOL_VERSION}.json`);
const current = (): ContractRecord => JSON.parse(JSON.stringify(CONTRACT));
const recorded = (): ContractRecord => JSON.parse(readFileSync(RECORD, 'utf8'));

describe('StenoError', () => {
  it('becomes a Structured_Error with a contract code and only the fields it has', () => {
    const findings = [{ file: '.steno/specs/a/requirements.md', line: 3, severity: 'error' as const, rule: 'ears/vague', message: 'vague' }];
    const s = toStructuredError(new StenoError('lint-blocked', 'lint errors', { spec: 'a', findings }));
    expect(ERROR_CODES).toContain(s.code);
    expect(s).toEqual({ protocolVersion: PROTOCOL_VERSION, code: 'lint-blocked', message: 'lint errors', spec: 'a', findings });
    expect('field' in s).toBe(false);
  });
  it('reports any other thrown value as failed', () => {
    expect(toStructuredError(new Error('disk full'))).toEqual({ protocolVersion: PROTOCOL_VERSION, code: 'failed', message: 'disk full' });
    expect(toStructuredError('boom').code).toBe('failed');
  });
  it('is an Error with its code', () => {
    const e = new StenoError('not-found', 'no task T9', { field: 'task' });
    expect(e).toBeInstanceOf(Error);
    expect([e.code, e.field, e.message]).toEqual(['not-found', 'task', 'no task T9']);
  });
});

describe('inferred types', () => {
  it('follow the descriptor', () => {
    expectTypeOf<OutlineItem['children']>().toEqualTypeOf<OutlineItem[]>();
    expectTypeOf<TreeSpec['next']>().toEqualTypeOf<{ id: string; title: string } | null | undefined>();
    expectTypeOf<StructuredError['code']>().toEqualTypeOf<typeof ERROR_CODES[number]>();
  });
});

describe('contract record', () => {
  it('exists for the current protocol version (run `pnpm contract:record`)', () => {
    expect(existsSync(RECORD)).toBe(true);
  });
  it('break test: nothing a Client relies on changed within the version (R9.4, R9.5)', () => {
    expect(contractBreaks(recorded(), current())).toEqual([]);
  });
  it('equality test: the record matches CONTRACT exactly (run `pnpm contract:record`)', () => {
    expect(current()).toEqual(recorded());
  });
});

describe('contractBreaks', () => {
  const edit = (f: (c: any) => void) => { const c: any = current(); f(c); return contractBreaks(current(), c); };
  it('allows a new optional field and a new shape (R9.6)', () => {
    expect(edit(c => { c.shapes.TaskPacket.extra = { type: 'string', optional: true }; c.shapes.Extra = {}; })).toEqual([]);
  });
  it('catches a removed or renamed field', () => {
    expect(edit(c => { delete c.shapes.Diagnostic.rule; })).toEqual(['Diagnostic.rule: removed or renamed']);
  });
  it('catches a retyped field, also inside arrays and objects', () => {
    expect(edit(c => { c.shapes.Diagnostic.line.type = 'string'; })).toHaveLength(1);
    expect(edit(c => { c.shapes.TreeSpec.files.type.array.object.reason.type = 'number'; })).toEqual([expect.stringContaining('TreeSpec.files[].reason')]);
  });
  it('catches a change between optional and required', () => {
    expect(edit(c => { delete c.shapes.ChangeResult.task.optional; })).toEqual([expect.stringContaining('ChangeResult.task')]);
  });
  it('catches a changed value set, error codes included (R9.5)', () => {
    expect(edit(c => { c.shapes.Diagnostic.severity.type.enum.push('info'); })).toHaveLength(1);
    expect(edit(c => { c.errorCodes.push('timeout'); })).toEqual([expect.stringContaining('errorCodes')]);
  });
  it('ignores a raised protocol version', () => {
    expect(edit(c => { c.protocolVersion++; delete c.shapes.Diagnostic; })).toEqual([]);
  });
});
