import { describe, expect, it, vi } from 'vitest';
import type { Row } from '../shared/contracts';
import { nothingToPick, PICKED_ITEMS, pickerFor, registerCommands, rowsOffering } from '../client/commands';

const row = (key: string, actions: Row['actions']): Row => ({ key, depth: 0, kind: 'task', label: key, actions });

describe('the rows a Command Center item picks from', () => {
  const rows = [row('spec:a', ['runNext', 'write']), row('task:a/T1', ['run', 'done']), row('task:a/T2', ['reopen']), row('task:a/T3', ['run', 'done'])];

  it('lists every row offering the action, in panel order', () => {
    expect(rowsOffering(rows, 'done').map(r => r.key)).toEqual(['task:a/T1', 'task:a/T3']);
    expect(rowsOffering(rows, 'reopen').map(r => r.key)).toEqual(['task:a/T2']);
  });

  it('lists nothing when no row offers the action', () => {
    expect(rowsOffering(rows, 'approve')).toEqual([]);
    expect(rowsOffering([], 'open')).toEqual([]);
  });
});

describe('the picker a Command Center item opens', () => {
  const at = (key: string, extra: Partial<Row>): Row => ({ key, depth: 0, kind: 'task', label: key, actions: [], ...extra });
  const rows: Row[] = [
    at('spec:a', { kind: 'spec', label: 'Log in', detail: '2 tasks left', target: { spec: 'a', phase: 'tasks' }, actions: ['runNext', 'write'] }),
    at('doc:a/requirements.md', { kind: 'document', label: 'Requirements', target: { spec: 'a', phase: 'requirements' }, path: 'r.md', actions: ['open'] }),
    at('doc:a/tasks.md', { kind: 'document', label: 'Tasks', target: { spec: 'a', phase: 'tasks' }, path: 't.md', problems: { errors: 1, warnings: 2 }, actions: ['approve', 'open'] }),
    at('task:a/T1', { label: 'Add the form', detail: 'next', target: { spec: 'a', task: 'T1' }, actions: ['run', 'done'] }),
    at('spec:b', { kind: 'spec', label: 'Search', target: { spec: 'b', phase: 'design' }, actions: ['write'] }),
    at('doc:b/design.md', { kind: 'document', label: 'Design', target: { spec: 'b', phase: 'design' }, path: 'd.md', actions: ['open'] }),
    at('steering:tech.md', { kind: 'steering', label: 'tech', detail: 'always on', path: 'tech.md', actions: ['open'] }),
  ];

  it('names each document once under its spec, without repeating the action on every line', () => {
    const picker = pickerFor('open', rows)!;
    expect(picker.title).toBe('Open a document');
    expect(picker.sections.map(s => [s.title, s.entries.map(e => e.label)])).toEqual([
      ['Log in', ['Requirements', 'Tasks']], ['Search', ['Design']], ['Steering', ['tech']],
    ]);
    expect(picker.sections.flatMap(s => s.entries).map(e => e.detail)).toEqual([undefined, '1 error · 2 warnings', undefined, 'always on']);
  });

  it('lists whole specs without a heading, naming the phase that Write works on', () => {
    const picker = pickerFor('write', rows)!;
    expect(picker.sections).toHaveLength(1);
    expect(picker.sections[0].title).toBeUndefined();
    expect(picker.sections[0].entries.map(e => [e.label, e.detail])).toEqual([['Log in', 'Write Tasks · 2 tasks left'], ['Search', 'Write Design']]);
  });

  it('shows a task by its title with its id beside it', () => {
    expect(pickerFor('done', rows)!.sections).toEqual([{ key: 'spec:a', title: 'Log in', entries: [{ row: rows[3], label: 'Add the form', detail: 'T1 · next' }] }]);
  });

  it('opens no picker when nothing offers the action, and says what is missing instead', () => {
    expect(pickerFor('reopen', rows)).toBeUndefined();
    expect(nothingToPick('reopen')).toBe('Nothing to reopen: no task is done yet.');
  });
});

describe('the Command Center items', () => {
  const ctx = () => ({ context: 'workspace', workspace: { ref: { id: 'w1' } }, rpc: vi.fn(async () => ({})), openPanel: vi.fn() });
  const registered = () => {
    const items: { id: string; title: string; onSelect(ctx: unknown): unknown }[] = [];
    const remove = vi.fn();
    const client = { addCommandCenterItem: vi.fn(item => { items.push(item); return remove; }) };
    const cleanup = registerCommands(client as never);
    return { items, remove, cleanup, byTitle: (title: string) => items.find(i => i.title === title)! };
  };

  it('offers every panel action, and removes them all on cleanup', () => {
    const { items, remove, cleanup } = registered();
    expect(items.map(i => i.title)).toEqual([
      'Open steno', 'New Spec', 'Set Up steno', 'Generate Steering', 'Restart steno Server', ...PICKED_ITEMS.map(p => p.title),
    ]);
    cleanup();
    expect(remove).toHaveBeenCalledTimes(items.length);
  });

  it('gives every item a kebab-case id, since Paseo refuses the whole client entry over one with a dot', () => {
    const ids = registered().items.map(i => i.id);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('leaves the intent before opening the panel, so a fresh panel finds it', async () => {
    const c = ctx();
    const order: string[] = [];
    c.rpc.mockImplementation(async () => { order.push('rpc'); return {}; });
    c.openPanel.mockImplementation(() => { order.push('open'); });
    await registered().byTitle('Approve…').onSelect(c);
    expect(c.rpc).toHaveBeenCalledWith(expect.objectContaining({ name: 'steno.intent' }), { workspaceId: 'w1', action: 'approve' });
    expect(c.openPanel).toHaveBeenCalledWith('steno', { location: 'explorer' });
    expect(order).toEqual(['rpc', 'open']);
  });

  it('restarts the server without opening the panel', async () => {
    const c = ctx();
    await registered().byTitle('Restart steno Server').onSelect(c);
    expect(c.rpc).toHaveBeenCalledWith(expect.objectContaining({ name: 'steno.restart' }), { workspaceId: 'w1' });
    expect(c.openPanel).not.toHaveBeenCalled();
  });
});
