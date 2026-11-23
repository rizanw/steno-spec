import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { FolderServer, ServerPool } from '@steno/host';
import { trackWorktree, type Active, type Orca } from '../src/worker/worktree.js';

type Context = { workspaceId?: string } | null;

/** A server whose holders the test can count and whose tree it can set. */
class FakeServer {
  holders = 0;
  tree?: { notSetUp?: true };
  readonly diagnostics = new Map();
  private listeners = new Set<() => void>();
  constructor(readonly folder: string) {}
  get state() { return 'running' as const; }
  onChange(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  hold() { this.holders++; let held = true; return () => { if (held) { held = false; this.holders--; } }; }
  request(): Promise<never> { return Promise.reject(new Error('not used')); }
  settled() { return Promise.resolve(); }
  setTree(tree: { notSetUp?: true }) { this.tree = tree; for (const l of [...this.listeners]) l(); }
}

function fakePool() {
  const servers = new Map<string, FakeServer>();
  const serverFor = (folder: string) => {
    let s = servers.get(folder);
    if (!s) { s = new FakeServer(folder); servers.set(folder, s); }
    return s as unknown as FolderServer;
  };
  const pool: ServerPool = { serverFor, restart: serverFor, dispose() {} };
  const held = () => [...servers.values()].filter(s => s.holders > 0).map(s => s.folder).sort();
  return { pool, server: (folder: string) => servers.get(folder)!, held };
}

/** An Orca whose `workspace.list` answers are released by the test, in any order. */
function fakeOrca(workspaces: Record<string, string>, initial: Context = null) {
  let handler: ((payload: { context: Context }) => unknown) | undefined;
  const pending: Array<() => void> = [];
  let manual = false;
  const call = (method: string) => {
    if (method === 'workspace.readContext') return Promise.resolve(initial);
    const answer = { workspaces: Object.entries(workspaces).map(([id, path]) => ({ id, path })), truncated: false };
    if (!manual) return Promise.resolve(answer);
    return new Promise(resolve => pending.push(() => resolve(answer)));
  };
  const orca = {
    events: { on: (_: string, h: typeof handler) => { handler = h; return { dispose() { handler = undefined; } }; } },
    host: { call, has: () => true },
  } as unknown as Orca;
  return {
    orca,
    focus: (workspaceId?: string) => handler?.({ context: workspaceId === undefined ? null : { workspaceId } }),
    holdAnswers() { manual = true; },
    answer: (index: number) => pending.splice(index, 1)[0]!(),
    pending: () => pending.length,
  };
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const exists = (dirs: string[]) => (path: string) => dirs.some(d => path === `${d}/.steno`);

describe('worktree tracker', () => {
  it('starts with the worktree Orca has focused', async () => {
    const { orca } = fakeOrca({ w1: '/repo/a' }, { workspaceId: 'w1' });
    const { pool, held } = fakePool();
    const seen: (Active | undefined)[] = [];
    trackWorktree(orca, pool, a => seen.push(a), () => false);
    await flush();
    expect(seen.map(a => a?.folder)).toEqual(['/repo/a']);
    expect(held()).toEqual(['/repo/a']);
  });

  it('holds the newly focused worktree and releases the previous one', async () => {
    const o = fakeOrca({ w1: '/repo/a', w2: '/repo/b' });
    const { pool, held } = fakePool();
    const seen: (Active | undefined)[] = [];
    trackWorktree(o.orca, pool, a => seen.push(a), () => false);
    o.focus('w1'); await flush();
    o.focus('w2'); await flush();
    expect(seen.map(a => a && [a.workspaceId, a.folder])).toEqual([['w1', '/repo/a'], ['w2', '/repo/b']]);
    expect(held()).toEqual(['/repo/b']);
  });

  it('holds nothing when no workspace is focused or Orca does not list it', async () => {
    const o = fakeOrca({ w1: '/repo/a' });
    const { pool, held } = fakePool();
    const seen: (Active | undefined)[] = [];
    trackWorktree(o.orca, pool, a => seen.push(a), () => false);
    o.focus('w1'); await flush();
    o.focus('gone'); await flush();
    expect(seen).toEqual([expect.anything(), undefined]);
    expect(held()).toEqual([]);
  });

  it('does not announce a change that keeps the same worktree', async () => {
    const o = fakeOrca({ w1: '/repo/a' });
    const { pool } = fakePool();
    const seen: (Active | undefined)[] = [];
    trackWorktree(o.orca, pool, a => seen.push(a), () => false);
    o.focus('w1'); await flush();
    o.focus('w1'); await flush();
    expect(seen).toHaveLength(1);
  });

  it('holds the enclosing project only while the worktree is not set up', async () => {
    const o = fakeOrca({ w1: '/repo/sub' });
    const { pool, server, held } = fakePool();
    const seen: (Active | undefined)[] = [];
    trackWorktree(o.orca, pool, a => seen.push(a), exists(['/repo']));
    o.focus('w1'); await flush();
    expect(held()).toEqual(['/repo/sub']);
    server('/repo/sub').setTree({ notSetUp: true });
    expect(held()).toEqual(['/repo', '/repo/sub']);
    expect(seen.at(-1)?.enclosing?.folder).toBe('/repo');
    server('/repo/sub').setTree({});
    expect(held()).toEqual(['/repo/sub']);
    expect(seen.at(-1)?.enclosing).toBeUndefined();
  });

  it('lets a slow lookup lose to a later change', async () => {
    const o = fakeOrca({ w1: '/repo/a', w2: '/repo/b' });
    const { pool, held } = fakePool();
    const seen: (Active | undefined)[] = [];
    trackWorktree(o.orca, pool, a => seen.push(a), () => false);
    await flush();
    o.holdAnswers();
    o.focus('w1'); o.focus('w2');
    o.answer(1); await flush();
    o.answer(0); await flush();
    expect(seen.map(a => a?.folder)).toEqual([undefined, '/repo/b']);
    expect(held()).toEqual(['/repo/b']);
  });

  it('releases everything on dispose', async () => {
    const o = fakeOrca({ w1: '/repo/sub' });
    const { pool, server, held } = fakePool();
    const tracker = trackWorktree(o.orca, pool, () => {}, exists(['/repo']));
    o.focus('w1'); await flush();
    server('/repo/sub').setTree({ notSetUp: true });
    tracker.dispose();
    expect(held()).toEqual([]);
  });

  // For any sequence of focus changes, tree updates and out-of-order answers, the servers held are the last
  // focused folder's, plus its enclosing project's only while it is not set up, and the last announcement names it.
  it('holds only the last focused worktree and, while it is not set up, its enclosing project', async () => {
    const workspaces = { w1: '/repo/a', w2: '/repo/b', w3: '/other/c', w4: '/repo' };
    const step = fc.oneof(
      fc.record({ kind: fc.constant('focus' as const), id: fc.constantFrom('w1', 'w2', 'w3', 'w4', 'none', 'gone') }),
      fc.record({ kind: fc.constant('tree' as const), folder: fc.constantFrom(...Object.values(workspaces)), notSetUp: fc.boolean() }),
      fc.record({ kind: fc.constant('answer' as const), pick: fc.nat() }),
    );
    await fc.assert(fc.asyncProperty(fc.array(step, { maxLength: 30 }), async steps => {
      const o = fakeOrca(workspaces);
      const { pool, server, held } = fakePool();
      let last: Active | undefined;
      trackWorktree(o.orca, pool, a => { last = a; }, exists(['/repo']));
      await flush();
      o.holdAnswers();
      let focused: string | undefined;
      for (const s of steps) {
        if (s.kind === 'focus') { focused = s.id; o.focus(s.id === 'none' ? undefined : s.id); }
        else if (s.kind === 'tree') { pool.serverFor(s.folder); server(s.folder).setTree(s.notSetUp ? { notSetUp: true } : {}); }
        else if (o.pending()) { o.answer(s.pick % o.pending()); await flush(); }
      }
      while (o.pending()) { o.answer(0); await flush(); }
      const folder = focused === undefined ? undefined : workspaces[focused as keyof typeof workspaces];
      const enclosing = folder && pool.serverFor(folder).tree?.notSetUp && folder.startsWith('/repo/') ? '/repo' : undefined;
      expect(held()).toEqual([folder, enclosing].filter((f): f is string => !!f).sort());
      expect(last?.folder).toBe(folder);
      expect(last?.enclosing?.folder).toBe(enclosing);
    }), { numRuns: 200 });
  });
});
