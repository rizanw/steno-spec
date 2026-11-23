import { describe, expect, it } from 'vitest';
import { handoffRoute, saveAgent, savedAgent } from '../src/worker/default-agent.js';

/** An Orca whose private store starts as `stored`; `refuse` makes every store call reject. */
function fakeStore(stored: Record<string, unknown> = {}, refuse = false) {
  const store = new Map(Object.entries(stored));
  const orca = {
    host: {
      call: async (method: string, params: { key: string; value?: unknown }) => {
        if (refuse) throw new Error('not permitted');
        if (method === 'storage.get') return { value: store.get(params.key) ?? null };
        if (method === 'storage.set') { store.set(params.key, params.value); return { ok: true }; }
        throw new Error(`unexpected ${method}`);
      },
    },
  };
  return { orca: orca as never, store };
}

describe('default agent', () => {
  it('saves one agent per worktree and reads it back', async () => {
    const { orca, store } = fakeStore();
    expect(await savedAgent(orca, '/w/a')).toBeUndefined();
    await saveAgent(orca, '/w/a', 'claude');
    await saveAgent(orca, '/w/b', 'codex');
    expect(await savedAgent(orca, '/w/a')).toBe('claude');
    expect(await savedAgent(orca, '/w/b')).toBe('codex');
    expect(store.get('defaultAgents')).toEqual({ '/w/a': 'claude', '/w/b': 'codex' });
  });

  it('changes a worktree\'s agent without touching the others', async () => {
    const { orca, store } = fakeStore({ defaultAgents: { '/w/a': 'claude', '/w/b': 'codex' } });
    await saveAgent(orca, '/w/a', 'gemini');
    expect(store.get('defaultAgents')).toEqual({ '/w/a': 'gemini', '/w/b': 'codex' });
  });

  it('reads an agent Orca can no longer start, a broken store or a store it will not read as none', async () => {
    expect(await savedAgent(fakeStore({ defaultAgents: { '/w/a': 'no-such-agent' } }).orca, '/w/a')).toBeUndefined();
    expect(await savedAgent(fakeStore({ defaultAgents: ['claude'] }).orca, '/w/a')).toBeUndefined();
    expect(await savedAgent(fakeStore({}, true).orca, '/w/a')).toBeUndefined();
  });

  it('asks with the full pick until an agent is saved, then starts it, or offers the running ones of its kind', () => {
    const claude = { terminalId: 't1', agent: 'claude', title: null };
    const codex = { terminalId: 't2', agent: 'codex', title: null };
    expect(handoffRoute(undefined, [claude])).toBe('pick');
    expect(handoffRoute('claude', [])).toBe('launch');
    expect(handoffRoute('claude', [codex])).toBe('launch');
    expect(handoffRoute('claude', [codex, claude])).toBe('runningPick');
  });
});
