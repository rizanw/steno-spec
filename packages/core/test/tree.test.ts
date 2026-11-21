import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildTree, taskCounts, loadProject, parseTasks, outlineOf, PROTOCOL_VERSION } from '../src/index.js';
import { tasksTemplate } from '../src/templates.js';

const STATE = 'name: a\ntitle: Alpha\nkind: feature\nmode: gated\nphase: execute\ncreated: 2026-01-01\napprovals:\n  requirements: 2026-01-02\n  design: 2026-01-03\n';
const TASKS = '# T\n\n- [ ] 1. Group\n  - [x] 1.1 One\n  - [ ] 1.2 Two\n- [x]* 2. Opt\n- [ ]* 3. Opt2\n';

function project(files: Record<string, string | Buffer>) {
  const root = mkdtempSync(join(tmpdir(), 'steno-tree-'));
  mkdirSync(join(root, '.steno', 'specs'), { recursive: true });
  for (const [rel, text] of Object.entries(files)) {
    const p = join(root, rel);
    mkdirSync(join(p, '..'), { recursive: true });
    writeFileSync(p, text);
  }
  return root;
}

describe('buildTree', () => {
  it('lists usable, derived and Unusable specs and every steering file', () => {
    const root = project({
      '.steno/specs/a/spec.yaml': STATE, '.steno/specs/a/requirements.md': '# R\n', '.steno/specs/a/tasks.md': TASKS,
      '.steno/specs/k/design.md': '# D\n',
      '.steno/specs/u/spec.yaml': 'name: u\nformatVersion: 9\n',
      '.steno/steering/ok.md': '---\ninclusion: manual\n---\n# Ok\n', '.steno/steering/web.md': '---\ninclusion: fileMatch\nfileMatchPattern: "src/web/**"\n---\n# Web\n', '.steno/steering/bad.md': Buffer.from([0xc3, 0x28]),
    });
    const tree = buildTree(loadProject(root));
    expect(tree.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(tree.notSetUp).toBeUndefined();
    const [a, k, u] = tree.specs;
    expect(a).toEqual({
      name: 'a', title: 'Alpha', kind: 'feature', mode: 'gated', phase: 'execute',
      approvals: { requirements: '2026-01-02', design: '2026-01-03' },
      tasks: { total: 2, done: 1, optionalTotal: 2, optionalDone: 1 }, next: { id: 'T1.2', title: 'Two' },
      documents: ['requirements.md', 'tasks.md'], taskItems: outlineOf('tasks', TASKS),
    });
    expect(a.taskItems![0].children[0]).toMatchObject({ id: 'T1.1', done: true, optional: false });
    expect(k).toMatchObject({ name: 'k', title: 'k', approvals: { design: null }, next: null, documents: ['design.md'], taskItems: [] });
    expect(u).not.toHaveProperty('taskItems');
    expect(tree).toMatchObject({ specsDir: '.steno/specs', steeringDir: '.steno/steering' });
    expect(Object.keys(k.approvals!)).toEqual(['design']);
    expect(u).toEqual({ name: 'u', unsupported: true, files: [{ file: '.steno/specs/u/spec.yaml', reason: expect.any(String) }] });
    expect(tree.steering).toEqual([
      { path: '.steno/steering/bad.md', unreadable: true, reason: 'bad.md is not UTF-8 text' },
      { path: '.steno/steering/ok.md', inclusion: 'manual' },
      // a fileMatch file carries its pattern, so a Client can say which files it is for
      { path: '.steno/steering/web.md', inclusion: 'fileMatch', pattern: 'src/web/**' },
    ]);
  });

  it('gives an empty tasks.md an empty list and names configured folders relative to the root', () => {
    const root = project({
      '.steno/config.yaml': 'specsDir: docs/specs\nsteeringDir: ./docs/steering/\n',
      'docs/specs/e/spec.yaml': STATE.replace('name: a', 'name: e'), 'docs/specs/e/tasks.md': '',
    });
    const tree = buildTree(loadProject(root));
    expect(tree.specs[0]).toMatchObject({ name: 'e', taskItems: [] });
    expect(tree).toMatchObject({ specsDir: 'docs/specs', steeringDir: 'docs/steering' });
  });

  it('lists specs newest created first, the same day by name, and specs with no date of their own last by name', () => {
    const dated = (name: string, created: string) => STATE.replace('name: a', `name: ${name}`).replace('created: 2026-01-01', created);
    const root = project({
      '.steno/specs/old/spec.yaml': dated('old', 'created: 2026-01-01'),
      '.steno/specs/new-b/spec.yaml': dated('new-b', 'created: 2026-03-01'),
      '.steno/specs/new-a/spec.yaml': dated('new-a', 'created: 2026-03-01'),
      '.steno/specs/mid/spec.yaml': dated('mid', 'created: 2026-02-01'),
      '.steno/specs/no-date/spec.yaml': dated('no-date', ''),
      '.steno/specs/derived/design.md': '# D\n',
      '.steno/specs/broken/spec.yaml': 'name: broken\nformatVersion: 9\n',
    });
    expect(buildTree(loadProject(root)).specs.map(s => s.name))
      .toEqual(['new-a', 'new-b', 'mid', 'old', 'broken', 'derived', 'no-date']);
  });

  it('says the current phase\'s document is written once it has items and no placeholder or empty section left', () => {
    const at = (phase: string) => STATE.replace('phase: execute', `phase: ${phase}`);
    const root = project({
      '.steno/specs/fresh/spec.yaml': at('tasks').replace('name: a', 'name: fresh'), '.steno/specs/fresh/tasks.md': tasksTemplate('Fresh'),
      '.steno/specs/filled/spec.yaml': at('tasks').replace('name: a', 'name: filled'), '.steno/specs/filled/tasks.md': TASKS,
      '.steno/specs/half/spec.yaml': at('brief').replace('name: a', 'name: half'), '.steno/specs/half/brief.md': '# B\n\n## Problem\nSlow.\n\n## Decision\n',
      '.steno/specs/bare/spec.yaml': at('design').replace('name: a', 'name: bare'), '.steno/specs/bare/design.md': '# D\n',
      '.steno/specs/none/spec.yaml': at('design').replace('name: a', 'name: none'),
      // the tasks are written, but execute writes no document, so there is nothing to call written
      '.steno/specs/running/spec.yaml': at('execute').replace('name: a', 'name: running'), '.steno/specs/running/tasks.md': TASKS,
    });
    const specs = new Map(buildTree(loadProject(root)).specs.map(s => [s.name, s]));
    expect(specs.get('filled')!.written).toBe(true);
    for (const name of ['fresh', 'half', 'bare', 'none', 'running']) expect(specs.get(name), name).not.toHaveProperty('written');
  });

  it('marks a snapshot that is not set up', () => {
    const tree = buildTree(loadProject(mkdtempSync(join(tmpdir(), 'steno-tree-'))));
    expect(tree).toEqual({ protocolVersion: PROTOCOL_VERSION, notSetUp: true, specs: [], steering: [] });
  });
});

describe('task counts add up', () => {
  it('total + optionalTotal is the number of leaf tasks, and done counts never exceed their totals', () => {
    const num = fc.array(fc.integer({ min: 1, max: 3 }), { minLength: 1, maxLength: 3 }).map(a => a.join('.'));
    const line = fc.tuple(num, fc.boolean(), fc.boolean()).map(([n, d, o]) => `- [${d ? 'x' : ' '}]${o ? '*' : ''} ${n}. T`);
    fc.assert(fc.property(fc.array(line, { maxLength: 20 }), lines => {
      const doc = parseTasks(['# T', ...lines].join('\n'));
      const c = taskCounts(doc);
      expect(c.total + c.optionalTotal).toBe(doc.tasks.filter(t => t.children.length === 0).length);
      expect(c.done).toBeLessThanOrEqual(c.total);
      expect(c.optionalDone).toBeLessThanOrEqual(c.optionalTotal);
    }));
    expect(taskCounts()).toEqual({ total: 0, done: 0, optionalTotal: 0, optionalDone: 0 });
  });
});
