// The text and order of the rows an editor shows for a folder's specs, documents, tasks and steering files.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  documentDone, documentRow, instructionRow, specOrder, specRow, steeringOrder, steeringRow, taskRows, unusable, type TaskRow,
} from '../../src/host/rows.js';
import type { OutlineItem, TreeSpec } from '../../src/contract.js';

function task(id: string, over: Partial<OutlineItem> = {}): OutlineItem {
  return { kind: 'task', id, title: `task ${id}`, line: 10, endLine: 10, children: [], ...over };
}

function spec(over: Partial<TreeSpec> = {}): TreeSpec {
  return {
    name: 'auth', title: 'Auth', kind: 'feature', mode: 'gated', phase: 'execute',
    tasks: { total: 4, done: 1, optionalTotal: 1, optionalDone: 0 },
    next: { id: 'T2', title: 'task T2' },
    documents: ['requirements.md', 'design.md', 'tasks.md'],
    taskItems: [task('T1', { done: true }), task('T2'), task('T3', { optional: true })],
    ...over,
  };
}

describe('unusable', () => {
  it('is true for a spec the server could not support or read, and false otherwise', () => {
    expect(unusable(spec())).toBe(false);
    expect(unusable({ name: 'old', unsupported: true } as TreeSpec)).toBe(true);
    expect(unusable({ name: 'old', unreadable: true } as TreeSpec)).toBe(true);
    expect(unusable(spec({ unsupported: false, unreadable: false }))).toBe(false);
  });
});

describe('documentDone', () => {
  it('counts a document done by its own stage', () => {
    const at = (over: Partial<TreeSpec>) => spec(over);
    expect(documentDone(at({ phase: 'brief' }), 'brief.md')).toBe(false);
    expect(documentDone(at({ phase: 'requirements' }), 'brief.md')).toBe(true);
    expect(documentDone(at({ approvals: { requirements: '2026-11-01' } }), 'bugfix.md')).toBe(true);
    expect(documentDone(at({ phase: 'requirements', approvals: {} }), 'requirements.md')).toBe(false);
    // a quick spec records no approvals: moving past a phase is what makes its document done
    expect(documentDone(at({ mode: 'quick', phase: 'done', approvals: {} }), 'design.md')).toBe(true);
    expect(documentDone(at({ mode: 'quick', phase: 'design', approvals: {} }), 'requirements.md')).toBe(true);
    expect(documentDone(at({ mode: 'quick', phase: 'design', approvals: {} }), 'design.md')).toBe(false);
    // a derived spec's approval has no date, and still counts
    expect(documentDone(at({ approvals: { tasks: null } }), 'tasks.md')).toBe(true);
    expect(documentDone(at({ phase: 'design', approvals: { tasks: null } }), 'design.md')).toBe(false);
    expect(documentDone(at({}), 'notes.md')).toBe(false);
  });
});

describe('specOrder', () => {
  it('puts done specs last, keeping the server order within each group', () => {
    // the server order: dated newest first, then the undated ones, an unreadable one among them
    const specs = [
      spec({ name: 'new-done', phase: 'done' }),
      spec({ name: 'new-open', phase: 'design' }),
      spec({ name: 'old-done', phase: 'done' }),
      spec({ name: 'old-open', phase: 'execute' }),
      spec({ name: 'undated-done', phase: 'done' }),
      { name: 'broken', unreadable: true, files: [] } as TreeSpec,
      spec({ name: 'undated-open', phase: 'requirements' }),
    ];
    expect(specOrder(specs).map(s => s.name)).toEqual([
      'new-open', 'old-open', 'broken', 'undated-open', 'new-done', 'old-done', 'undated-done',
    ]);
  });

  it('keeps every spec exactly once, the done ones forming the tail', () => {
    const phases = fc.constantFrom('brief', 'requirements', 'design', 'tasks', 'execute', 'done', undefined);
    fc.assert(fc.property(fc.array(phases), list => {
      const specs = list.map((phase, i) => ({ name: `s${i}`, phase }) as TreeSpec);
      const out = specOrder(specs);
      expect([...out].sort((a, b) => Number(a.name.slice(1)) - Number(b.name.slice(1)))).toEqual(specs);
      const firstDone = out.findIndex(s => s.phase === 'done');
      if (firstDone >= 0) expect(out.slice(firstDone).every(s => s.phase === 'done')).toBe(true);
    }));
  });
});

describe('specRow', () => {
  it('shows the title with the tasks left, and phase | progress | mode in the tooltip', () => {
    expect(specRow(spec())).toEqual({
      label: 'Auth', description: '3 tasks left', tooltip: 'auth\nexecute | 1 of 4 tasks | gated\nnext: T2 task T2', icon: 'execute',
    });
  });

  it('shows the phase while the spec is written, and nothing but a tick once it is done', () => {
    const none = { total: 0, done: 0, optionalTotal: 0, optionalDone: 0 };
    expect(specRow(spec({ phase: 'design', mode: 'quick', next: null, tasks: none }))).toEqual({
      label: 'Auth', description: 'design', tooltip: 'auth\ndesign | quick', icon: 'spec',
    });
    expect(specRow(spec({ phase: 'brief', next: null, tasks: none })).icon).toBe('spec');
    const done = specRow(spec({ phase: 'done', next: null, tasks: { total: 4, done: 4, optionalTotal: 0, optionalDone: 0 } }));
    expect(done).toEqual({ label: 'Auth', description: undefined, tooltip: 'auth\ndone | 4 of 4 tasks | gated', icon: 'done' });
  });

  it('counts the tasks left in words', () => {
    const counts = (total: number, done: number) => spec({ tasks: { total, done, optionalTotal: 0, optionalDone: 0 } });
    expect(specRow(counts(2, 1)).description).toBe('1 task left');
    expect(specRow(counts(2, 2)).description).toBe('all tasks done');
    expect(specRow(counts(1, 0)).tooltip).toBe('auth\nexecute | 0 of 1 task | gated\nnext: T2 task T2');
    expect(specRow(spec({ tasks: undefined })).description).toBe('all tasks done');
  });

  it('falls back to the folder name when the spec has no title', () => {
    expect(specRow(spec({ title: undefined })).label).toBe('auth');
  });

  it('names a spec it cannot use by its folder, with the reason', () => {
    const files = [{ file: '.steno/specs/old/spec.md', reason: 'unknown format' }];
    expect(specRow({ name: 'old', title: 'Old', unsupported: true, files } as TreeSpec))
      .toEqual({ label: 'old', description: 'unsupported', tooltip: 'unknown format', icon: 'warning' });
    expect(specRow({ name: 'old', unreadable: true, files: [] } as TreeSpec))
      .toEqual({ label: 'old', description: 'unreadable', tooltip: undefined, icon: 'warning' });
  });
});

describe('documentRow', () => {
  it('labels a document by its capitalised name, ticked once its stage is done', () => {
    const approved = spec({ phase: 'tasks', approvals: { requirements: '2026-11-01', design: null } });
    expect(documentRow(approved, 'requirements.md')).toEqual({ label: 'Requirements', tooltip: 'requirements.md · done', icon: 'finished' });
    expect(documentRow(approved, 'tasks.md')).toEqual({ label: 'Tasks', tooltip: 'tasks.md', icon: 'document' });
    expect(documentRow(approved, 'bugfix.md').label).toBe('Bugfix');
  });
});

describe('steeringRow', () => {
  it('names a steering file without its folder or .md, with when it reaches the agent', () => {
    expect(steeringRow({ path: '.steno/steering/tech.md', inclusion: 'always' }))
      .toEqual({ label: 'tech', description: 'always on', tooltip: '.steno/steering/tech.md\nGiven to the agent with every task', icon: 'steering' });
    expect(steeringRow({ path: '.steno/steering/api.md', inclusion: 'fileMatch', pattern: 'src/api/**, src/routes/**' })).toEqual({
      label: 'api', description: 'matching files', icon: 'steering',
      tooltip: '.steno/steering/api.md\nGiven to the agent for a task that touches matching files: src/api/**, src/routes/**',
    });
    expect(steeringRow({ path: '.steno/steering/db.md', inclusion: 'fileMatch' }).tooltip)
      .toBe('.steno/steering/db.md\nGiven to the agent for a task that touches matching files');
    expect(steeringRow({ path: '.steno/steering/style.md', inclusion: 'manual' })).toEqual({
      label: 'style', description: 'on request', icon: 'steering',
      tooltip: '.steno/steering/style.md\nNever given to the agent on its own; fetch it with `steno show steering/style.md`',
    });
  });

  it('marks a steering file it could not read', () => {
    expect(steeringRow({ path: '.steno/steering/x.md', unreadable: true, reason: 'EACCES' }))
      .toEqual({ label: 'x', description: 'unreadable', tooltip: '.steno/steering/x.md: EACCES', icon: 'warning' });
    expect(steeringRow({ path: '.steno/steering/x.md', unreadable: true }).tooltip).toBe('.steno/steering/x.md: could not be read');
  });
});

describe('instructionRow', () => {
  it('reads a root file by its name and a nested one by its path', () => {
    expect(instructionRow('AGENTS.md')).toEqual({ label: 'AGENTS', tooltip: 'AGENTS.md: instructions your coding agent reads', icon: 'instruction' });
    expect(instructionRow('.cursorrules').label).toBe('.cursorrules');
    expect(instructionRow('.github/copilot-instructions.md').label).toBe('.github/copilot-instructions.md');
  });
});

describe('taskRows', () => {
  it('marks done, open, optional and next, from the spec\'s own tasks by default', () => {
    const rows = taskRows(spec());
    expect(rows.map(r => r.icon)).toEqual(['finished', 'next', 'task']);
    expect(rows.map(r => r.description)).toEqual(['', 'next', 'optional']);
    expect(rows.map(r => r.label)).toEqual(['task T1', 'task T2', 'task T3']);
    expect(rows[1]).toMatchObject({ id: 'T2', line: 10, done: false, optional: false, leaf: true, next: true, children: [] });
    expect(taskRows(spec({ taskItems: undefined }))).toEqual([]);
  });

  it('nests subtasks as the outline does, and a parent is not a leaf', () => {
    const items = [task('T1', { children: [task('T1.1', { done: true }), task('T1.2', { optional: true })] })];
    const [parent] = taskRows(spec({ next: { id: 'T1.2', title: 'x' } }), items);
    expect(parent).toMatchObject({ id: 'T1', leaf: false, next: false, icon: 'task' });
    expect(parent.children.map(c => [c.id, c.icon, c.description])).toEqual([['T1.1', 'finished', ''], ['T1.2', 'next', 'optional · next']]);
  });

  it('marks only the first task in outline order whose id is next, and none without a next task', () => {
    const items = [task('T1', { children: [task('T2')] }), task('T2')];
    const flat = (rows: TaskRow[]): TaskRow[] => rows.flatMap(r => [r, ...flat(r.children)]);
    expect(flat(taskRows(spec(), items)).map(r => r.next)).toEqual([false, true, false]);
    expect(flat(taskRows(spec({ next: null }), items)).some(r => r.next)).toBe(false);
    expect(taskRows(spec(), [task('T2', { id: undefined })])[0]).toMatchObject({ id: '', next: false });
  });
});

describe('steeringOrder', () => {
  it('groups root instruction files, then steering, then other agents\' files, each A to Z ignoring case', () => {
    const steering = [
      { path: '.steno/steering/tech.md', inclusion: 'always' as const },
      { path: '.steno/steering/API.md', inclusion: 'manual' as const },
      { path: '.steno/steering/product.md', inclusion: 'always' as const },
    ];
    const order = steeringOrder(steering, ['GEMINI.md', 'CLAUDE.md', 'AGENTS.md'],
      ['.github/copilot-instructions.md', '.cursorrules', '.cursor/rules/testing.mdc', '.cursor/rules/Api.mdc']);
    expect(order).toEqual([
      { kind: 'instruction', path: 'AGENTS.md' }, { kind: 'instruction', path: 'CLAUDE.md' }, { kind: 'instruction', path: 'GEMINI.md' },
      { kind: 'steering', path: '.steno/steering/API.md' }, { kind: 'steering', path: '.steno/steering/product.md' },
      { kind: 'steering', path: '.steno/steering/tech.md' },
      { kind: 'instruction', path: '.cursor/rules/Api.mdc' }, { kind: 'instruction', path: '.cursor/rules/testing.mdc' },
      { kind: 'instruction', path: '.cursorrules' }, { kind: 'instruction', path: '.github/copilot-instructions.md' },
    ]);
  });

  it('orders steering files of the same name by path, and names that differ only in case in a fixed order', () => {
    const order = steeringOrder([{ path: 'b/tech.md' }, { path: 'a/tech.md' }, { path: 'a/Tech.md' }], [], []);
    expect(order.map(r => r.path)).toEqual(['a/Tech.md', 'a/tech.md', 'b/tech.md']);
  });

  it('is empty with no steering and no instruction file', () => {
    expect(steeringOrder([], [], [])).toEqual([]);
  });
});
