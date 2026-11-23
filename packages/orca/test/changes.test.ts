import { describe, expect, it } from 'vitest';
import type { PanelRow } from '@steno/core/host';
import { applyChange, changeOf, successMessage } from '../src/worker/changes.js';

function fakeServer(answer: (method: string, params: unknown) => unknown) {
  const sent: { method: string; params: unknown }[] = [];
  const server = { request: async (method: string, params: unknown) => { sent.push({ method, params }); return answer(method, params); } };
  return { server: server as never, sent };
}

function fakeOrca() {
  const shown: { title: string }[] = [];
  return { orca: { host: { call: async (_: string, params: { title: string }) => { shown.push(params); return {}; } } } as never, shown };
}

const specRow: PanelRow = { key: 'spec:auth', depth: 1, kind: 'spec', label: 'auth', target: { spec: 'auth', phase: 'design' }, actions: ['approve', 'review'] };
const taskRow: PanelRow = { key: 'task:auth/T1', depth: 3, kind: 'task', label: 'T1', target: { spec: 'auth', task: 'T1' }, actions: ['done', 'run'] };

describe('changes', () => {
  it('approves the phase the row was drawn in and names the stage it moved to', async () => {
    const { server, sent } = fakeServer(() => ({ protocolVersion: 1, spec: 'auth', phase: 'tasks', approved: 'design' }));
    const { orca, shown } = fakeOrca();
    expect(await applyChange(orca, server, changeOf(specRow, 'approve')!)).toEqual({ done: true });
    expect(sent).toEqual([{ method: 'steno/approve', params: { spec: 'auth', phase: 'design' } }]);
    expect(shown[0]!.title).toBe('auth: design approved, now in tasks');
  });

  it('marks a task done with the spec and task only, so the server reads the saved file', async () => {
    const { server, sent } = fakeServer(() => ({ protocolVersion: 1, spec: 'auth', phase: 'execute', task: 'T1', done: true }));
    await applyChange(fakeOrca().orca, server, changeOf(taskRow, 'done')!);
    expect(sent).toEqual([{ method: 'steno/taskDone', params: { spec: 'auth', task: 'T1' } }]);
  });

  it('sends reopen and reopen-spec through their own requests', async () => {
    const { server, sent } = fakeServer(() => ({ protocolVersion: 1, spec: 'auth', phase: 'execute' }));
    await applyChange(fakeOrca().orca, server, { action: 'reopen', spec: 'auth', task: 'T1' });
    await applyChange(fakeOrca().orca, server, { action: 'reopenSpec', spec: 'auth' });
    expect(sent.map(s => s.method)).toEqual(['steno/taskReopen', 'steno/specReopen']);
    expect(successMessage({ action: 'reopenSpec', spec: 'auth' }, { protocolVersion: 1, spec: 'auth', phase: 'execute' } as never)).toContain('open again');
  });

  it('returns steno refusing a change with its blocking problems, and shows no success', async () => {
    const data = { protocolVersion: 1, code: 'lint-failed', message: 'design.md has errors', problems: [{ file: 'design.md', line: 4 }] };
    const { server } = fakeServer(() => { throw Object.assign(new Error('refused'), { data }); });
    const { orca, shown } = fakeOrca();
    expect(await applyChange(orca, server, changeOf(specRow, 'approve')!)).toEqual({ refusal: data });
    expect(shown).toEqual([]);
  });

  it('turns any other failure into a failed refusal with its message', async () => {
    const { server } = fakeServer(() => { throw new Error('server stopped'); });
    const result = await applyChange(fakeOrca().orca, server, changeOf(taskRow, 'done')!);
    expect(result).toMatchObject({ refusal: { code: 'failed', message: 'server stopped' } });
  });

  it('asks for nothing when the row does not offer the action', () => {
    expect(changeOf(taskRow, 'approve')).toBeUndefined();
    expect(changeOf(specRow, 'done')).toBeUndefined();
    expect(changeOf(undefined, 'done')).toBeUndefined();
  });
});
