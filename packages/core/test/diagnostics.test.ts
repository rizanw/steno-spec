import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadProject, overlaySource, specDiagnostics, steeringDiagnostics, readDiagnostics, configDiagnostics, projectDiagnostics,
  lintSteeringFiles,
} from '../src/index.js';

const STATE = (name: string, kind = 'feature', phase = 'design') => `name: ${name}\nkind: ${kind}\nmode: gated\nphase: ${phase}\ncreated: 2026-01-01\napprovals:\n  requirements: 2026-01-02\n`;
const REQS = '# Requirements\n\n## Requirements\n\n### Requirement 1: A\n\n**User Story:** As a u, I want a, so that b.\n\n#### Acceptance Criteria\n1. THE system SHALL a.\n';
const BAD_REQS = '# Requirements\n\n## Requirements\n\n### Requirement 1: A\n\n**User Story:** As a u, I want a, so that b.\n\n#### Acceptance Criteria\n1. THE system does a.\n';

function project(files: Record<string, string | Buffer>, config?: string) {
  const root = mkdtempSync(join(tmpdir(), 'steno-diag-'));
  mkdirSync(join(root, '.steno', 'specs'), { recursive: true });
  if (config !== undefined) writeFileSync(join(root, '.steno', 'config.yaml'), config);
  for (const [rel, text] of Object.entries(files)) {
    const p = join(root, rel);
    mkdirSync(join(p, '..'), { recursive: true });
    writeFileSync(p, text);
  }
  return root;
}

describe('specDiagnostics', () => {
  it('maps lint findings to root-relative files, severities, rules and lines', () => {
    const snap = loadProject(project({ '.steno/specs/a/spec.yaml': STATE('a'), '.steno/specs/a/requirements.md': BAD_REQS }));
    const d = specDiagnostics(snap, 'a');
    expect(d).toContainEqual({ file: '.steno/specs/a/requirements.md', line: 10, severity: 'error', rule: 'ears/shall', message: 'acceptance criterion needs a SHALL clause', spec: 'a' });
    expect(d.find(x => x.rule === 'ears/pattern')).toBeUndefined();
  });

  it('runs one stage with `only`, and puts a finding on a missing file on line 1 of spec.yaml', () => {
    const snap = loadProject(project({ '.steno/specs/a/spec.yaml': STATE('a'), '.steno/specs/a/requirements.md': REQS }));
    expect(specDiagnostics(snap, 'a', 'design')).toEqual([
      { file: '.steno/specs/a/spec.yaml', line: 1, severity: 'error', rule: 'spec/missing', message: 'design.md does not exist', spec: 'a' },
    ]);
    expect(specDiagnostics(snap, 'a', 'requirements')).toEqual([]);
  });

  it('uses the spec.yaml path for a derived spec that has no record', () => {
    const snap = loadProject(project({ '.steno/specs/k/design.md': '# D\n\n## X {#D-x}\nbody\n' }));
    const d = specDiagnostics(snap, 'k', 'requirements');
    expect(d).toEqual([expect.objectContaining({ file: '.steno/specs/k/spec.yaml', line: 1, rule: 'spec/missing' })]);
  });

  it('gives a finding without a line on an existing file line 1, and reports bugfix findings on bugfix.md', () => {
    const root = project({ '.steno/specs/b/spec.yaml': STATE('b', 'bugfix'), '.steno/specs/b/bugfix.md': '# Bug\n\nnothing here\n' });
    const d = specDiagnostics(loadProject(root), 'b');
    expect(d).toContainEqual(expect.objectContaining({ file: '.steno/specs/b/bugfix.md', line: 1, rule: 'req/empty', severity: 'error' }));
  });

  it('lints the unsaved text of the editor snapshot', () => {
    const root = project({ '.steno/specs/a/spec.yaml': STATE('a'), '.steno/specs/a/requirements.md': REQS });
    const open = new Map([[join(root, '.steno/specs/a/requirements.md'), BAD_REQS]]);
    const snap = loadProject(root, overlaySource(open, () => true));
    expect(specDiagnostics(snap, 'a').map(x => x.rule)).toContain('ears/shall');
  });

  it('relints a spec whenever its text or state changes between loads, and reuses nothing stale', () => {
    const root = project({ '.steno/specs/a/spec.yaml': STATE('a'), '.steno/specs/a/requirements.md': REQS });
    const req = join(root, '.steno/specs/a/requirements.md');
    const rules = (snap: ReturnType<typeof loadProject>) => specDiagnostics(snap, 'a').map(x => x.rule);
    const clean = rules(loadProject(root));
    expect(clean).not.toContain('ears/shall');
    // the editor's unsaved text, then the saved text again, then a saved change, then a state change
    expect(rules(loadProject(root, overlaySource(new Map([[req, BAD_REQS]]), () => true)))).toContain('ears/shall');
    expect(rules(loadProject(root))).toEqual(clean);
    writeFileSync(req, BAD_REQS);
    expect(rules(loadProject(root))).toContain('ears/shall');
    writeFileSync(join(root, '.steno/specs/a/spec.yaml'), STATE('a', 'feature', 'brief'));
    writeFileSync(req, REQS);
    expect(rules(loadProject(root))).toEqual(clean);
    // a caller that changes a finding does not change the next answer
    const snap = loadProject(root);
    specDiagnostics(snap, 'a').forEach(d => { d.rule = 'x'; });
    expect(rules(snap)).toEqual(clean);
  });

  it('returns nothing for an Unusable or unknown spec', () => {
    const snap = loadProject(project({ '.steno/specs/u/spec.yaml': 'name: u\nformatVersion: 9\n', '.steno/specs/u/requirements.md': BAD_REQS }));
    expect(specDiagnostics(snap, 'u')).toEqual([]);
    expect(specDiagnostics(snap, 'nope')).toEqual([]);
  });
});

describe('lintSteeringFiles and steeringDiagnostics', () => {
  it('counts lines from the top of the file, frontmatter included', () => {
    const text = '---\ninclusion: manual\n---\n# T\n\n- a <placeholder>\n';
    const [i] = lintSteeringFiles([{ file: 't.md', text }], 4000).filter(x => x.rule === 'steering/placeholder');
    expect(i.line).toBe(6);
  });

  it('gives the no-match warning only when match counts are given', () => {
    const text = '---\ninclusion: fileMatch\nfileMatchPattern: "nope/**"\n---\n# T\n';
    expect(lintSteeringFiles([{ file: 'c.md', text }], 4000).map(i => i.rule)).not.toContain('steering/no-match');
    expect(lintSteeringFiles([{ file: 'c.md', text }], 4000, new Map([['c.md', 0]])).map(i => i.rule)).toContain('steering/no-match');
  });

  it('puts steering findings on the file, and the budget finding on line 1 of the configuration path', () => {
    const root = project({ '.steno/steering/a.md': '# A\n\n- x <fill>\n', '.steno/steering/big.md': 'word '.repeat(3500), '.steno/steering/e.md': '' });
    const d = steeringDiagnostics(loadProject(root));
    expect(d).toContainEqual({ file: '.steno/steering/a.md', line: 3, severity: 'warning', rule: 'steering/placeholder', message: 'template placeholder still present' });
    expect(d).toContainEqual(expect.objectContaining({ file: '.steno/config.yaml', line: 1, rule: 'steering/budget', severity: 'error' }));
    expect(d).toContainEqual(expect.objectContaining({ file: '.steno/steering/e.md', line: 1, rule: 'steering/empty' }));
    expect(d.every(x => x.spec === undefined)).toBe(true);
  });
});

describe('readDiagnostics, configDiagnostics, projectDiagnostics', () => {
  it('gives one error per file of an Unusable spec, an Unreadable steering file and nothing lint for them', () => {
    const root = project({
      '.steno/specs/u/spec.yaml': 'name: u\nformatVersion: 9\n', '.steno/specs/u/requirements.md': BAD_REQS,
      '.steno/specs/r/spec.yaml': STATE('r'), '.steno/specs/r/design.md': Buffer.from([0xff, 0xfe, 0x00]),
      '.steno/steering/bad.md': Buffer.from([0xc3, 0x28]),
    });
    const snap = loadProject(root);
    const read = readDiagnostics(snap);
    expect(read).toContainEqual(expect.objectContaining({ file: '.steno/specs/u/spec.yaml', line: 1, rule: 'spec/unsupported', spec: 'u', severity: 'error' }));
    expect(read).toContainEqual(expect.objectContaining({ file: '.steno/specs/r/design.md', line: 1, rule: 'spec/unreadable', message: 'design.md is not UTF-8 text' }));
    expect(read).toContainEqual({ file: '.steno/steering/bad.md', line: 1, severity: 'error', rule: 'steering/unreadable', message: 'bad.md is not UTF-8 text' });
    const all = projectDiagnostics(snap);
    expect(all.filter(x => x.spec === 'u').map(x => x.rule)).toEqual(['spec/unsupported']);
  });

  it('turns configuration warnings into warnings at their line', () => {
    const snap = loadProject(project({}, 'foo: 1\nctxBudget: -3\n'));
    expect(configDiagnostics(snap)).toEqual([
      { file: '.steno/config.yaml', line: 1, severity: 'warning', rule: 'config/unknown-key', message: 'unknown key "foo" is ignored' },
      { file: '.steno/config.yaml', line: 2, severity: 'warning', rule: 'config/invalid-value', message: 'invalid value for "ctxBudget"; using the default 1500' },
    ]);
  });

  it('gives only config/unreadable for an Unreadable configuration, and nothing without .steno', () => {
    const snap = loadProject(project({ '.steno/specs/a/spec.yaml': STATE('a'), '.steno/specs/a/requirements.md': BAD_REQS }, '- a\n'));
    expect(projectDiagnostics(snap)).toEqual([
      { file: '.steno/config.yaml', line: 1, severity: 'error', rule: 'config/unreadable', message: '.steno/config.yaml is not a mapping' },
    ]);
    expect(projectDiagnostics(loadProject(mkdtempSync(join(tmpdir(), 'steno-diag-'))))).toEqual([]);
  });

  it('only ever names a spec document, a steering file, a spec.yaml or the configuration', () => {
    const root = project({
      '.steno/specs/a/spec.yaml': STATE('a'), '.steno/specs/a/requirements.md': BAD_REQS,
      '.steno/specs/k/tasks.md': '# T\n\n- [ ] 1. x\n', '.steno/steering/s.md': '# S\n<x>\n',
    }, 'zzz: 1\n');
    const files = new Set(projectDiagnostics(loadProject(root)).map(d => d.file));
    expect(files.size).toBeGreaterThan(2);
    for (const f of files) expect(f).toMatch(/^\.steno\/(config\.yaml|steering\/[^/]+\.md|specs\/[^/]+\/(spec\.yaml|brief\.md|requirements\.md|bugfix\.md|design\.md|tasks\.md))$/);
  });
});
