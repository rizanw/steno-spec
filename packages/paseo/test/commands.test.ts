import { describe, expect, it, vi } from 'vitest';
import type { Row } from '../shared/contracts';
import { PICKED_ITEMS, registerCommands, rowsOffering } from '../client/commands';

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
