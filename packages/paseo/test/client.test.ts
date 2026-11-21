import { describe, expect, it, vi } from 'vitest';
import type { ChangeOutcome, Row } from '../shared/contracts';
import { changeFor, performChange, refusalProblems, reopenWording, successMessage, type ChangeRequest } from '../client/changes';
import { actionLabel, needsMore, rowButtons, toggled, visibleRows } from '../client/model';

const row = (key: string, parent?: string, extra: Partial<Row> = {}): Row =>
  ({ key, parent, depth: 0, kind: 'task', label: key, actions: [], ...extra });

describe('which rows show', () => {
  const rows = [row('specs'), row('spec:a', 'specs'), row('doc:a/tasks.md', 'spec:a'), row('task:a/T1', 'doc:a/tasks.md'), row('steering')];

  it('shows a row only when every ancestor is expanded', () => {
    expect(visibleRows(rows, ['specs']).map(r => r.key)).toEqual(['specs', 'spec:a', 'steering']);
    expect(visibleRows(rows, ['specs', 'doc:a/tasks.md']).map(r => r.key)).toEqual(['specs', 'spec:a', 'steering']);
    expect(visibleRows(rows, ['specs', 'spec:a', 'doc:a/tasks.md']).map(r => r.key)).toHaveLength(5);
  });

  it('toggles a key in and out', () => {
    expect(toggled(['specs'], 'spec:a')).toEqual(['specs', 'spec:a']);
    expect(toggled(['specs', 'spec:a'], 'specs')).toEqual(['spec:a']);
  });
});

describe('what an action is called', () => {
  it('names the phase a spec writes or reviews in', () => {
    const spec = (phase?: 'tasks' | 'brief' | 'done') => row('spec:a', undefined, { kind: 'spec', target: { spec: 'a', ...(phase ? { phase } : {}) } });
    expect(actionLabel('write', spec('tasks'))).toBe('Write Tasks');
    expect(actionLabel('review', spec('tasks'))).toBe('Review Tasks');
    expect(actionLabel('write', spec('brief'))).toBe('Write Brief');
    expect(actionLabel('review', spec('done'))).toBe('Review Drift');
    expect(actionLabel('write', spec())).toBe('Write This Phase');
    expect(actionLabel('approve', spec('tasks'))).toBe('Approve');
  });

  it('calls Write a revision once the phase\'s document is written', () => {
    const written = row('spec:a', undefined, { kind: 'spec', target: { spec: 'a', phase: 'tasks', written: true } });
    expect(actionLabel('write', written)).toBe('Revise Tasks');
    expect(actionLabel('review', written)).toBe('Review Tasks');
  });
});

describe('the buttons on a row', () => {
  const row = (actions: Row['actions'], primary?: Row['primary']): Row => ({ key: 'k', depth: 1, kind: 'document', label: 'L', actions, ...(primary ? { primary } : {}) });

  it('shows no more button when every action already has a button', () => {
    const tasksDoc = row(['approve', 'open'], 'approve');
    expect(rowButtons(tasksDoc, true)).toEqual(['open', 'approve']);
    expect(needsMore(tasksDoc, true)).toBe(false);
  });

  it('shows no more button when tapping the row does the only other action', () => {
    expect(rowButtons(row(['approve', 'open'], 'approve'), false)).toEqual(['approve']);
    expect(needsMore(row(['approve', 'open'], 'approve'), false)).toBe(false);
    expect(needsMore(row(['open'], 'open'), false)).toBe(false);
    expect(needsMore(row(['done'], 'done'), false)).toBe(false);
  });

  it('shows the more button when an action has no button', () => {
    expect(needsMore(row(['write', 'review'], 'review'), true)).toBe(true);
    expect(needsMore(row(['approve', 'review'], 'approve'), true)).toBe(true);
    expect(needsMore(row(['done', 'run'], 'run'), false)).toBe(true);
  });
});

describe('a change from the panel', () => {
  const ok: ChangeOutcome = { ok: true, result: { protocolVersion: 1, spec: 'a', phase: 'execute', task: 'T1', done: false } };
  const reopen: ChangeRequest = { kind: 'reopen', spec: 'a', task: 'T1' };

  it('sends no change when the user declines a reopen', async () => {
    const send = vi.fn(async () => ok);
    expect(await performChange(reopen, async () => false, send)).toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });

  it('sends a reopen once confirmed, and a done or approve without asking', async () => {
    const send = vi.fn(async () => ok);
    const confirm = vi.fn(async () => true);
    expect(await performChange(reopen, confirm, send)).toBe(ok);
    await performChange({ kind: 'done', spec: 'a', task: 'T1' }, confirm, send);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('asks before reopening a finished spec, and says how to go on once it is open', async () => {
    const spec = row('spec:a', undefined, { kind: 'spec', target: { spec: 'a', phase: 'done' } });
    const request = changeFor(spec, 'reopenSpec')!;
    expect(request).toEqual({ kind: 'reopenSpec', spec: 'a' });
    const send = vi.fn(async () => ok);
    expect(await performChange(request, async () => false, send)).toBeUndefined();
    expect(send).not.toHaveBeenCalled();
    expect(reopenWording(request).title).toBe('Reopen a?');
    expect(successMessage(request, { protocolVersion: 1, spec: 'a', phase: 'execute' })).toBe('a is open again. Add tasks to tasks.md, then run them.');
  });

  it('builds the request from the row it was started on', () => {
    const task = row('task:a/T1', undefined, { target: { spec: 'a', task: 'T1' } });
    const doc = row('doc:a/design.md', undefined, { target: { spec: 'a', phase: 'design' } });
    expect(changeFor(task, 'done')).toEqual({ kind: 'done', spec: 'a', task: 'T1' });
    expect(changeFor(doc, 'approve')).toEqual({ kind: 'approve', spec: 'a', phase: 'design' });
    expect(changeFor(doc, 'done')).toBeUndefined();
    expect(changeFor(task, 'run')).toBeUndefined();
  });

  it('says what changed, and lists each lint problem of a refusal', () => {
    expect(successMessage({ kind: 'approve', spec: 'a', phase: 'design' }, { protocolVersion: 1, spec: 'a', phase: 'tasks', approved: 'design' }))
      .toBe('Design approved. a moves on to tasks.');
    expect(successMessage({ kind: 'approve', spec: 'a', phase: 'execute' }, { protocolVersion: 1, spec: 'a', phase: 'done', approved: 'execute' }))
      .toBe('Execution approved. a is finished.');
    expect(successMessage({ kind: 'done', spec: 'a', task: 'T1' }, { protocolVersion: 1, spec: 'a', phase: 'execute', task: 'T1', done: true }))
      .toBe('T1 of a is done.');
    expect(refusalProblems({
      protocolVersion: 1, code: 'lint-blocked', message: 'fix it',
      findings: [{ file: '.steno/specs/a/tasks.md', line: 20, severity: 'error', rule: 'tasks/unknown-req', message: 'references unknown R9.9' }],
    })).toEqual(['.steno/specs/a/tasks.md:20  error  references unknown R9.9']);
  });
});
