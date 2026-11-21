// Which actions a spec or task row offers in each phase, and whether a folder's tree lets a task run.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { canApprove, runnable, specActions, taskActions } from '../../src/host/actions.js';
import type { OutlineItem, SpecTree, TreeSpec } from '../../src/contract.js';

const PHASES = ['brief', 'requirements', 'design', 'tasks', 'execute', 'done'] as const;

const anySpec = fc.record({
  name: fc.constant('s'),
  mode: fc.option(fc.constantFrom('gated', 'quick'), { nil: undefined }),
  phase: fc.option(fc.constantFrom(...PHASES), { nil: undefined }),
  unsupported: fc.option(fc.constant(true as const), { nil: undefined }),
  unreadable: fc.option(fc.constant(true as const), { nil: undefined }),
}) as fc.Arbitrary<TreeSpec>;

function task(id: string, over: Partial<OutlineItem> = {}): OutlineItem {
  return { kind: 'task', id, title: `task ${id}`, line: 10, endLine: 10, children: [], ...over };
}

function spec(over: Partial<TreeSpec> = {}): TreeSpec {
  return { name: 'auth', title: 'Auth', kind: 'feature', mode: 'gated', phase: 'execute', ...over };
}

function tree(over: Partial<SpecTree> = {}): SpecTree {
  return { protocolVersion: 1, specs: [], steering: [], ...over };
}

describe('canApprove', () => {
  it('approve is offered on exactly the approvable specs', () => {
    fc.assert(fc.property(anySpec, s => {
      const expected = !s.unsupported && !s.unreadable && s.mode === 'gated'
        && ['brief', 'requirements', 'design', 'tasks'].includes(s.phase ?? '');
      expect(canApprove(s)).toBe(expected);
    }));
  });
});

describe('specActions', () => {
  it('offers each phase its actions in a gated spec', () => {
    const at = (phase: (typeof PHASES)[number]) => specActions(spec({ phase }));
    expect(at('brief')).toEqual(['approve', 'write']);
    expect(at('requirements')).toEqual(['approve', 'write', 'review']);
    expect(at('design')).toEqual(['approve', 'write', 'review']);
    expect(at('tasks')).toEqual(['approve', 'write', 'review']);
    expect(at('execute')).toEqual(['runNext']);
    expect(at('done')).toEqual(['review', 'reopenSpec']);
  });

  it('offers no approve in a quick spec, and nothing without a phase', () => {
    const at = (phase: (typeof PHASES)[number]) => specActions(spec({ mode: 'quick', phase }));
    expect(at('brief')).toEqual(['write']);
    expect(at('requirements')).toEqual(['write', 'review']);
    expect(at('design')).toEqual(['write', 'review']);
    expect(at('tasks')).toEqual(['write', 'review']);
    expect(at('execute')).toEqual(['runNext']);
    expect(at('done')).toEqual(['review', 'reopenSpec']);
    expect(specActions(spec({ phase: undefined }))).toEqual([]);
  });

  it('offers nothing on a spec the server could not support or read, in any phase', () => {
    for (const phase of PHASES) {
      expect(specActions(spec({ phase, unsupported: true }))).toEqual([]);
      expect(specActions(spec({ phase, unreadable: true }))).toEqual([]);
    }
  });

  it('holds approve exactly when canApprove says so', () => {
    fc.assert(fc.property(anySpec, s => { expect(specActions(s).includes('approve')).toBe(canApprove(s)); }));
  });
});

describe('taskActions', () => {
  it('reopens a done task in every phase', () => {
    for (const phase of PHASES) expect(taskActions(spec({ phase }), true)).toEqual(['reopen']);
  });

  it('runs an open task only in execute, and marks every open task done', () => {
    for (const phase of PHASES) expect(taskActions(spec({ phase }), false)).toEqual(phase === 'execute' ? ['done', 'run'] : ['done']);
  });

  it('does not run a task of a spec the server could not use', () => {
    expect(taskActions(spec({ unreadable: true }), false)).toEqual(['done']);
    expect(taskActions(spec({ unsupported: true }), false)).toEqual(['done']);
  });
});

describe('runnable', () => {
  it('follows the tree: an open task of a spec in execute, nothing it does not know', () => {
    const t = tree({ specs: [spec({ taskItems: [task('T1', { done: true }), task('T2', { children: [task('T2.1')] })] })] });
    expect(runnable(t, 'auth', 'T2.1')).toBe(true);
    expect(runnable(t, 'auth', 'T2')).toBe(true);
    expect(runnable(t, 'auth', 'T1')).toBe(false);
    expect(runnable(t, 'auth', 'T9')).toBe(false);
    expect(runnable(t, 'other', 'T2.1')).toBe(false);
    expect(runnable(undefined, 'auth', 'T2.1')).toBe(false);
    expect(runnable(tree({ specs: [spec({ phase: 'tasks', taskItems: [task('T1')] })] }), 'auth', 'T1')).toBe(false);
    const parent = [task('T1', { children: [task('T1.1')] })];
    expect(runnable(tree({ specs: [spec({ phase: 'tasks', taskItems: parent })] }), 'auth', 'T1')).toBe(false);
    expect(runnable(tree({ specs: [spec({ unreadable: true, taskItems: parent })] }), 'auth', 'T1')).toBe(false);
  });
});
