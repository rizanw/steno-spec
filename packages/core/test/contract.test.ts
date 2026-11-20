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
  it('becomes a structured error with a contract code and only the fields it has', () => {
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
  it('break test: nothing a Client relies on changed within the version', () => {
    expect(contractBreaks(recorded(), current())).toEqual([]);
  });
  it('equality test: the record matches CONTRACT exactly (run `pnpm contract:record`)', () => {
    expect(current()).toEqual(recorded());
  });
});

describe('contractBreaks', () => {
  const edit = (f: (c: any) => void) => { const c: any = current(); f(c); return contractBreaks(current(), c); };
  it('allows a new optional field and a new shape', () => {
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
  it('catches a changed value set, error codes included', () => {
    expect(edit(c => { c.shapes.Diagnostic.severity.type.enum.push('info'); })).toHaveLength(1);
    expect(edit(c => { c.errorCodes.push('timeout'); })).toEqual([expect.stringContaining('errorCodes')]);
  });
  it('ignores a raised protocol version', () => {
    expect(edit(c => { c.protocolVersion++; delete c.shapes.Diagnostic; })).toEqual([]);
  });
});

describe('the contract document', () => {
  const DOC = join(import.meta.dirname, '..', '..', '..', 'docs', 'json-contract.md');
  const doc = readFileSync(DOC, 'utf8');
  /** The text of the `### <name>` section, up to the next heading of level 2 or 3. */
  const section = (name: string) => doc.split(/^#{2,3} /m).find(s => s.startsWith(`${name}\n`));

  it('states the protocol version at the top', () => {
    expect(doc.split('\n').slice(0, 5).join('\n')).toContain(`**Protocol version: ${PROTOCOL_VERSION}**`);
  });
  it('has a section for every shape, naming each of its fields', () => {
    for (const [name, fields] of Object.entries(CONTRACT.shapes)) {
      const text = section(name);
      expect(text, `no "### ${name}" section`).toBeDefined();
      const spans = [...text!.matchAll(/`([^`]+)`/g)].map(m => m[1]);
      for (const field of Object.keys(fields)) {
        expect(spans.some(s => new RegExp(`(^|[.])${field}\\b`).test(s)), `${name}.${field}`).toBe(true);
      }
    }
  });
  it('names every error code and lens command', () => {
    for (const code of CONTRACT.errorCodes) expect(section('Error codes')).toContain(`| \`${code}\` |`);
    for (const command of CONTRACT.lensCommands) expect(section('Task lenses')).toContain(`\`${command}\``);
  });
});
