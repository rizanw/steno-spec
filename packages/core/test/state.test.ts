import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import YAML from 'yaml';
import { parseState, loadState, saveState, newState, FORMAT_VERSION, StenoError } from '../src/index.js';

const GOOD = 'name: x\ntitle: X\nkind: feature\nmode: gated\nphase: design\ncreated: 2026-01-02\napprovals:\n  requirements: 2026-01-03\n';

describe('parseState', () => {
  it('uses format version 1, and treats a record without one as version 1', () => {
    expect(FORMAT_VERSION).toBe(1);
    expect(parseState(GOOD)).toEqual({ state: { name: 'x', title: 'X', kind: 'feature', mode: 'gated', phase: 'design', created: '2026-01-02', approvals: { requirements: '2026-01-03' } } });
    expect(parseState(`formatVersion: 1\n${GOOD}`)).toMatchObject({ state: { name: 'x', formatVersion: 1 } });
  });

  it('defaults approvals and tolerates the old seen key and unknown keys', () => {
    const r = parseState('name: x\nkind: bugfix\nmode: quick\nphase: execute\nseen: { a: b }\nextra: 1\n');
    expect(r).toEqual({ state: { name: 'x', kind: 'bugfix', mode: 'quick', phase: 'execute', created: '', approvals: {} } });
  });

  it('names the recorded value: newer versions need an update, anything else is invalid', () => {
    expect(parseState(`formatVersion: 3\n${GOOD}`)).toEqual({ flag: 'unsupported', reason: 'format version 3 is newer than this steno understands; update steno' });
    expect(parseState(`formatVersion: 0\n${GOOD}`)).toEqual({ flag: 'unsupported', reason: 'format version 0 is not valid' });
    expect(parseState(`formatVersion: 1.5\n${GOOD}`)).toEqual({ flag: 'unsupported', reason: 'format version 1.5 is not valid' });
    expect(parseState(`formatVersion: two\n${GOOD}`)).toEqual({ flag: 'unsupported', reason: 'format version "two" is not valid' });
    expect(parseState(`formatVersion:\n${GOOD}`)).toEqual({ flag: 'unsupported', reason: 'format version null is not valid' });
  });

  it('is unreadable for bad YAML, a non-mapping, or a missing or bad required key', () => {
    expect(parseState('a: [1\n')).toMatchObject({ flag: 'unreadable', reason: expect.stringMatching(/not valid YAML/) });
    expect(parseState('- a\n')).toMatchObject({ flag: 'unreadable', reason: expect.stringMatching(/not a mapping/) });
    expect(parseState(GOOD.replace('name: x\n', ''))).toMatchObject({ flag: 'unreadable', reason: expect.stringMatching(/missing the required key name/) });
    expect(parseState(GOOD.replace('kind: feature', 'kind: chore'))).toMatchObject({ flag: 'unreadable', reason: expect.stringMatching(/kind "chore"/) });
    expect(parseState(GOOD.replace('mode: gated\n', ''))).toMatchObject({ flag: 'unreadable', reason: expect.stringMatching(/required key mode/) });
    expect(parseState(GOOD.replace('phase: design', 'phase: 3'))).toMatchObject({ flag: 'unreadable', reason: expect.stringMatching(/phase 3/) });
  });
});

describe('loadState', () => {
  const dir = (text: string) => { const d = mkdtempSync(join(tmpdir(), 'steno-state-')); writeFileSync(join(d, 'spec.yaml'), text); return d; };

  it('keeps reading what saveState writes', () => {
    const d = mkdtempSync(join(tmpdir(), 'steno-state-'));
    const s = newState('a', { title: 'A' });
    saveState(d, s);
    expect(loadState(d)).toEqual(s);
  });

  it('throws the matching StenoError', () => {
    for (const [text, code] of [[`formatVersion: 9\n${GOOD}`, 'unsupported'], ['- a\n', 'unreadable']] as const) {
      const d = dir(text);
      expect(() => loadState(d)).toThrow(StenoError);
      try { loadState(d); } catch (e) { expect((e as StenoError).code).toBe(code); expect((e as StenoError).file).toBe(join(d, 'spec.yaml')); }
    }
  });
});

describe('format version is judged first', () => {
  it('holds', () => {
    const version = fc.anything().filter(v => v !== 1 && v !== undefined);
    const others = fc.dictionary(fc.constantFrom('name', 'title', 'kind', 'mode', 'phase', 'created', 'approvals', 'seen', 'other'), fc.jsonValue());
    fc.assert(fc.property(version, others, (v, rest) => {
      const text = YAML.stringify({ ...rest, formatVersion: v });
      // YAML cannot carry every JS value; judge by what the record actually holds.
      const held = (YAML.parse(text) as Record<string, unknown>).formatVersion;
      fc.pre(held !== 1);
      expect(parseState(text)).toMatchObject({ flag: 'unsupported' });
    }));
  });
});
