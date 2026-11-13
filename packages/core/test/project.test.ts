import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadProject, persistDerived, overlaySource, loadSpec, loadSteering, diskSource, StenoError, type SpecEntry } from '../src/index.js';

const STATE = (name: string, extra = '') => `${extra}name: ${name}\nkind: feature\nmode: gated\nphase: design\ncreated: 2026-01-01\napprovals:\n  requirements: 2026-01-02\n`;
const REQS = '# Requirements\n\n## Requirements\n\n### Requirement 1: A\n\n#### Acceptance Criteria\n1. THE system SHALL a.\n';
const TASKS = '# Tasks\n\n- [ ] 1. Do it\n';

function project(files: Record<string, string | Buffer>, config?: string) {
  const root = mkdtempSync(join(tmpdir(), 'steno-proj-'));
  mkdirSync(join(root, '.steno', 'specs'), { recursive: true });
  if (config !== undefined) writeFileSync(join(root, '.steno', 'config.yaml'), config);
  for (const [rel, text] of Object.entries(files)) {
    const p = join(root, rel);
    mkdirSync(join(p, '..'), { recursive: true });
    writeFileSync(p, text);
  }
  return root;
}
const spec = (e: SpecEntry | undefined) => (e && 'spec' in e ? e : undefined);

describe('loadProject', () => {
  it('is not set up without .steno or with an Unreadable configuration, and does not throw', () => {
    const bare = mkdtempSync(join(tmpdir(), 'steno-proj-'));
    expect(loadProject(bare)).toMatchObject({ setUp: false, reason: expect.stringMatching(/no \.steno/), specs: [], steering: [] });
    expect(loadProject(project({}, '- a\n'))).toMatchObject({ setUp: false, reason: expect.stringMatching(/not a mapping/) });
    const ok = loadProject(project({}, 'foo: 1\n'));
    expect(ok.setUp).toBe(true);
    expect(ok.configWarnings).toEqual([{ key: 'foo', line: 1, kind: 'unknown-key' }]);
  });

  it('decides whether it is set up from disk even when the editor has the configuration open', () => {
    const root = project({}, '- a\n');
    const src = overlaySource(new Map([[join(root, '.steno', 'config.yaml'), 'ctxBudget: 5\n']]), () => true);
    expect(loadProject(root, src).setUp).toBe(false);
  });

  it('derives the state of a folder without spec.yaml and writes nothing', () => {
    const root = project({ '.steno/specs/kiro/requirements.md': REQS, '.steno/specs/kiro/tasks.md': TASKS });
    const e = spec(loadProject(root).specs[0]);
    expect(e).toMatchObject({ name: 'kiro', derived: true, spec: { state: { phase: 'execute', approvals: { requirements: expect.any(String), tasks: expect.any(String) } } } });
    expect(e!.spec.requirements?.requirements).toHaveLength(1);
    expect(existsSync(join(root, '.steno/specs/kiro/spec.yaml'))).toBe(false);
    expect(existsSync(join(root, '.steno/cache'))).toBe(false);
  });

  it('keeps Unusable specs as entries, unsupported over unreadable, spec.yaml first, without affecting others', () => {
    const bad = Buffer.from([0xff]);
    const root = project({
      '.steno/specs/a-good/spec.yaml': STATE('a-good'), '.steno/specs/a-good/requirements.md': REQS,
      '.steno/specs/b-new/spec.yaml': STATE('b-new', 'formatVersion: 2\n'), '.steno/specs/b-new/tasks.md': bad, '.steno/specs/b-new/design.md': bad,
      '.steno/specs/c-bad/spec.yaml': '- not a mapping\n', '.steno/specs/c-bad/requirements.md': REQS,
      '.steno/specs/d-doc/spec.yaml': STATE('d-doc'), '.steno/specs/d-doc/requirements.md': bad,
      '.steno/specs/not-a-spec/notes.txt': 'x',
    });
    const snap = loadProject(root);
    expect(snap.specs.map(e => e.name)).toEqual(['a-good', 'b-new', 'c-bad', 'd-doc']);
    expect(spec(snap.specs[0])?.spec.state.phase).toBe('design');
    const dir = (n: string) => join(root, '.steno/specs', n);
    expect(snap.specs[1]).toEqual({ name: 'b-new', flag: 'unsupported', files: [
      { file: join(dir('b-new'), 'spec.yaml'), reason: 'format version 2 is newer than this steno understands; update steno' },
      { file: join(dir('b-new'), 'design.md'), reason: 'design.md is not UTF-8 text' },
      { file: join(dir('b-new'), 'tasks.md'), reason: 'tasks.md is not UTF-8 text' },
    ] });
    expect(snap.specs[2]).toMatchObject({ name: 'c-bad', flag: 'unreadable', files: [{ file: join(dir('c-bad'), 'spec.yaml') }] });
    expect(snap.specs[3]).toEqual({ name: 'd-doc', flag: 'unreadable', files: [{ file: join(dir('d-doc'), 'requirements.md'), reason: 'requirements.md is not UTF-8 text' }] });
  });

  it('loads each steering file on its own', () => {
    const root = project({ '.steno/steering/a.md': '# A\n', '.steno/steering/b.md': Buffer.from([0xff]), '.steno/steering/c.md': '---\ninclusion: manual\n---\n# C\n' });
    const s = loadProject(root).steering;
    expect(s.map(e => e.file)).toEqual(['a.md', 'b.md', 'c.md'].map(f => join(root, '.steno/steering', f)));
    expect(s[0].steering).toMatchObject({ file: 'a.md', inclusion: 'always', body: '# A' });
    expect(s[1]).toEqual({ file: join(root, '.steno/steering/b.md'), unreadable: 'b.md is not UTF-8 text' });
    expect(s[2].steering?.inclusion).toBe('manual');
    expect(loadSteering(root).map(x => x.file)).toEqual(['a.md', 'c.md']);
  });

  it('reads unsaved spec documents from the overlay, and the state record from disk', () => {
    const root = project({ '.steno/specs/x/spec.yaml': STATE('x'), '.steno/specs/x/tasks.md': TASKS });
    const dir = join(root, '.steno/specs/x');
    const open = new Map([[join(dir, 'tasks.md'), '# Tasks\n\n- [x] 1. Do it\n'], [join(dir, 'spec.yaml'), STATE('x').replace('design', 'tasks')], [join(dir, 'design.md'), '# D\n']]);
    const src = overlaySource(open, p => p.endsWith('.md'));
    const e = spec(loadProject(root, src).specs[0])!;
    expect(e.spec.tasks?.tasks[0].done).toBe(true);
    expect(e.spec.state.phase).toBe('design');
    expect(Object.keys(e.spec.files)).toEqual(['design.md', 'tasks.md']);
  });

  it('reuses parsed documents whose text did not change', () => {
    const root = project({ '.steno/specs/x/spec.yaml': STATE('x'), '.steno/specs/x/requirements.md': REQS });
    const a = spec(loadProject(root).specs[0])!, b = spec(loadProject(root).specs[0])!;
    expect(b.spec.requirements).toBe(a.spec.requirements);
    writeFileSync(join(root, '.steno/specs/x/requirements.md'), REQS + '2. THE system SHALL b.\n');
    expect(spec(loadProject(root).specs[0])!.spec.requirements).not.toBe(a.spec.requirements);
  });
});

describe('persistDerived', () => {
  it('writes the derived record dated today and clears derived', () => {
    const root = project({ '.steno/specs/kiro/requirements.md': REQS });
    const snap = loadProject(root);
    persistDerived(snap, 'kiro');
    const today = new Date().toISOString().slice(0, 10);
    expect(snap.specs[0]).toMatchObject({ derived: false, spec: { state: { phase: 'design', approvals: { requirements: today } } } });
    expect(readFileSync(join(root, '.steno/specs/kiro/spec.yaml'), 'utf8')).toContain(`requirements: ${today}`);
    expect(spec(loadProject(root).specs[0])?.derived).toBe(false);
  });
});

describe('loadSpec with a FileSource', () => {
  it('keeps the disk behaviour and reads documents through the source', () => {
    const root = project({ '.steno/specs/x/spec.yaml': STATE('x'), '.steno/specs/x/tasks.md': TASKS, '.steno/specs/y/spec.yaml': STATE('y'), '.steno/specs/y/tasks.md': Buffer.from([0xff]) });
    const dir = join(root, '.steno/specs/x');
    expect(loadSpec(dir).tasks?.tasks[0].done).toBe(false);
    expect(loadSpec(dir, diskSource).tasks?.tasks).toHaveLength(1);
    expect(loadSpec(dir, overlaySource(new Map([[join(dir, 'tasks.md'), '# Tasks\n\n- [x] 1. Do it\n']]), () => true)).tasks?.tasks[0].done).toBe(true);
    expect(() => loadSpec(join(root, '.steno/specs/y'))).toThrow(StenoError);
  });
});
