import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import YAML from 'yaml';
import { readConfig, loadConfig, configPath, DEFAULT_CONFIG, StenoError, type Config, type FileSource } from '../src/index.js';

const ROOT = '/proj';
/** A source holding only the configuration text. */
const memSource = (text: string | undefined): FileSource => ({
  read: p => (p === configPath(ROOT) && text !== undefined ? { text, bom: false } : undefined),
  list: () => [],
});
const project = (text?: string | Buffer) => {
  const root = mkdtempSync(join(tmpdir(), 'steno-cfg-'));
  mkdirSync(join(root, '.steno'));
  if (text !== undefined) writeFileSync(configPath(root), text);
  return root;
};

describe('readConfig', () => {
  it('gives the defaults with no warning when the file is missing, empty or only comments', () => {
    for (const t of [undefined, '', '# nothing\n']) expect(readConfig(ROOT, memSource(t))).toEqual({ config: DEFAULT_CONFIG, warnings: [] });
  });

  it('warns about unknown keys and replaced values, at their line', () => {
    const r = readConfig(ROOT, memSource('specsDir: specs\nfoo: 1\nctxBudget: -3\nreviewer: other\n'));
    expect(r.config).toEqual({ ...DEFAULT_CONFIG, specsDir: 'specs' });
    expect(r.warnings).toEqual([
      { key: 'foo', line: 2, kind: 'unknown-key' },
      { key: 'ctxBudget', line: 3, kind: 'invalid-value', default: 1500 },
      { key: 'reviewer', line: 4, kind: 'invalid-value', default: 'default' },
    ]);
    expect(r.unreadable).toBeUndefined();
  });

  it('is Unreadable for invalid YAML, a non-mapping, folders outside the root, and undecodable bytes', () => {
    expect(readConfig(ROOT, memSource('a: [1\n')).unreadable).toMatch(/not valid YAML/);
    expect(readConfig(ROOT, memSource('- a\n- b\n')).unreadable).toMatch(/not a mapping/);
    expect(readConfig(ROOT, memSource('just text\n')).unreadable).toMatch(/not a mapping/);
    expect(readConfig(ROOT, memSource('specsDir: ../elsewhere\n')).unreadable).toMatch(/specsDir .* outside/);
    expect(readConfig(ROOT, memSource('steeringDir: /etc\n')).unreadable).toMatch(/steeringDir .* outside/);
    expect(readConfig(project(Buffer.from([0x61, 0xff]))).unreadable).toMatch(/not UTF-8/);
    const bad = readConfig(ROOT, memSource('a: [1\n'));
    expect(bad.config).toEqual(DEFAULT_CONFIG);
    expect(bad.warnings).toEqual([]);
  });
});

describe('loadConfig', () => {
  it('keeps returning the configuration', () => {
    expect(loadConfig(project('ctxBudget: 900\n')).ctxBudget).toBe(900);
  });

  it('throws not-set-up with the reason when the file is Unreadable', () => {
    const root = project('- not\n- a mapping\n');
    expect(() => loadConfig(root)).toThrow(StenoError);
    try { loadConfig(root); } catch (e) {
      expect((e as StenoError).code).toBe('not-set-up');
      expect((e as StenoError).reason).toMatch(/not a mapping/);
    }
  });
});

describe('bad configuration never changes a good setting', () => {
  const KEYS = Object.keys(DEFAULT_CONFIG) as (keyof Config)[];
  const folder = fc.stringMatching(/^[a-z][a-z0-9_-]{0,8}(\/[a-z][a-z0-9_-]{0,8}){0,2}$/);
  const valid = fc.record<Config>({
    specsDir: folder, steeringDir: folder,
    ctxBudget: fc.integer({ min: 1, max: 1e6 }), steeringBudget: fc.integer({ min: 1, max: 1e6 }),
    reviewer: fc.constantFrom('default', 'egm'),
    agents: fc.array(fc.stringMatching(/^[a-z]{1,8}$/), { maxLength: 4 }),
  });
  const invalidFor: Record<keyof Config, fc.Arbitrary<unknown>> = {
    specsDir: fc.oneof(fc.constant(''), fc.integer(), fc.boolean(), fc.constant(null), fc.array(fc.string())),
    steeringDir: fc.oneof(fc.constant('   '), fc.integer(), fc.boolean(), fc.constant(null)),
    ctxBudget: fc.oneof(fc.integer({ max: 0 }), fc.double({ min: 0.1, max: 100, noInteger: true }), fc.string(), fc.constant(null)),
    steeringBudget: fc.oneof(fc.integer({ max: 0 }), fc.string(), fc.boolean()),
    reviewer: fc.string().filter(s => s !== 'default' && s !== 'egm'),
    agents: fc.oneof(fc.string(), fc.integer(), fc.array(fc.integer(), { minLength: 1 })),
  };
  const unknownKeys = fc.uniqueArray(fc.stringMatching(/^[a-z][a-zA-Z0-9]{0,10}$/).filter(k => !(KEYS as string[]).includes(k)), { maxLength: 4 });
  const replaced = fc.subarray(KEYS).chain(keys =>
    fc.tuple(...keys.map(k => invalidFor[k].map(v => [k, v] as const))).map(pairs => new Map<keyof Config, unknown>(pairs)));

  it('holds', () => {
    fc.assert(fc.property(valid, unknownKeys, replaced, (cfg, extra, bad) => {
      const doc: Record<string, unknown> = { ...cfg };
      for (const [k, v] of bad) doc[k] = v;
      for (const k of extra) doc[k] = 1;
      const r = readConfig(ROOT, memSource(YAML.stringify(doc)));
      expect(r.unreadable).toBeUndefined();
      for (const k of KEYS) expect(r.config[k]).toEqual(bad.has(k) ? DEFAULT_CONFIG[k] : cfg[k]);
      expect(r.warnings.filter(w => w.kind === 'unknown-key').map(w => w.key).sort()).toEqual([...extra].sort());
      expect(r.warnings.filter(w => w.kind === 'invalid-value').map(w => w.key).sort()).toEqual([...bad.keys()].sort());
    }));
  });
});
