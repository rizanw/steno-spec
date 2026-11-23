import { describe, expect, it } from 'vitest';
import { REQUEST_TYPES, type Request } from '../src/shared/messages.js';
import { answer, dispatch, liveHandlers, stubHandlers, type Handlers } from '../src/worker.js';
import type { FolderServer, ServerPool } from '@steno/host';
import type { Post } from '../src/shared/messages.js';

/** Records what each Orca handler was given, and answers with the request it rebuilt. */
function recording(): { handlers: Handlers; seen: Request[] } {
  const seen: Request[] = [];
  const echo = async (request: Request) => { seen.push(request); return { nothing: request.type } as never; };
  return { seen, handlers: { 'steno.panel': echo, 'steno.act': echo, 'steno.submit': echo, 'steno.recheck': echo } };
}

function fakeOrca() {
  const registered = new Map<string, (input: unknown, context: unknown) => unknown>();
  const orca = { panels: { handle: (name: string, handler: (input: unknown, context: unknown) => unknown) => { registered.set(name, handler); return { dispose() {} }; }, post() {} } };
  return { orca: orca as never, registered };
}

describe('worker', () => {
  it('sends each request to the handler for its type', async () => {
    const { handlers, seen } = recording();
    await dispatch(handlers, { type: 'steno.act', key: 'task:a/T1', action: 'done' });
    await dispatch(handlers, { type: 'steno.recheck' });
    expect(seen.map(r => r.type)).toEqual(['steno.act', 'steno.recheck']);
  });

  it('answers every request type the panel can send', () => {
    const { orca, registered } = fakeOrca();
    answer(orca, stubHandlers());
    expect([...registered.keys()].sort()).toEqual([...REQUEST_TYPES].sort());
  });

  it('rebuilds the request from the Orca request name and its input', async () => {
    const { orca, registered } = fakeOrca();
    const { handlers, seen } = recording();
    answer(orca, handlers);
    await registered.get('steno.submit')!({ form: 'agentPick', key: 'task:a/T1', answers: { agent: 'claude' } }, {});
    await registered.get('steno.panel')!(undefined, {});
    expect(seen).toEqual([
      { type: 'steno.submit', form: 'agentPick', key: 'task:a/T1', answers: { agent: 'claude' } },
      { type: 'steno.panel' },
    ]);
  });

  it('keeps the request name when the input carries a type of its own', async () => {
    const { orca, registered } = fakeOrca();
    const { handlers, seen } = recording();
    answer(orca, handlers);
    await registered.get('steno.recheck')!({ type: 'steno.act' }, {});
    expect(seen).toEqual([{ type: 'steno.recheck' }]);
  });

  it('leaves fields that are undefined out of every answer, since Orca refuses an answer that holds one', async () => {
    const { orca, registered } = fakeOrca();
    const row = { key: 'spec:a', depth: 1, kind: 'spec', label: 'a', detail: undefined, primary: undefined, actions: [] };
    answer(orca, { ...stubHandlers(), 'steno.panel': async () => ({ specRows: [row], steeringRows: [], server: 'running', agentSteno: { found: false, matches: true, bundled: '' } }) as never });
    const answered = await registered.get('steno.panel')!(undefined, {}) as { specRows: object[] };
    expect(answered.specRows[0]).toEqual({ key: 'spec:a', depth: 1, kind: 'spec', label: 'a', actions: [] });
    expect(JSON.stringify(answered)).not.toContain('undefined');
    expect(Object.keys(answered.specRows[0])).not.toContain('detail');
  });

  it('keeps the panel drawable before the real handlers exist', async () => {
    const snapshot = await dispatch(stubHandlers(), { type: 'steno.panel' });
    expect(snapshot).toMatchObject({ specRows: [], steeringRows: [] });
  });
});

/** A pool of servers that answer with a set-up tree and no specs, recording restarts. */
function fakePool() {
  const restarted: string[] = [];
  const servers = new Map<string, FolderServer>();
  const serverFor = (folder: string) => {
    if (!servers.has(folder)) {
      servers.set(folder, {
        folder, state: 'running', diagnostics: new Map(), tree: { protocolVersion: 1, specs: [], steering: [] } as never,
        onChange: () => () => {}, hold: () => () => {}, request: () => Promise.reject(new Error('not used')), settled: () => Promise.resolve(),
      });
    }
    return servers.get(folder)!;
  };
  const pool: ServerPool = { serverFor, restart: folder => { restarted.push(folder); return serverFor(folder); }, dispose() {} };
  return { pool, restarted };
}

/** An Orca with one focused worktree, whose events the test can fire and whose posts it can read. */
function liveOrca(focused: string | null) {
  let changed: ((payload: { context: { workspaceId?: string } | null }) => unknown) | undefined;
  const posts: Post[] = [];
  const orca = {
    events: { on: (_: string, h: typeof changed) => { changed = h; return { dispose() {} }; } },
    host: {
      has: () => true,
      call: async (method: string) => method === 'workspace.readContext'
        ? (focused ? { workspaceId: focused } : null)
        : { workspaces: [{ id: 'w1', path: '/nowhere/a' }, { id: 'w2', path: '/nowhere/b' }], truncated: false },
    },
    panels: { handle() { return { dispose() {} }; }, post: (_: string, payload: Post) => { posts.push(payload); } },
    log() {},
  };
  return { orca: orca as never, posts, focus: (id: string) => changed?.({ context: { workspaceId: id } }) };
}

const settle = () => new Promise(resolve => setTimeout(resolve, 20));

describe('the live worker', () => {
  it('posts the focused worktree and answers the panel with its snapshot', async () => {
    const { orca, posts } = liveOrca('w1');
    const live = liveHandlers(orca, fakePool().pool);
    await settle();
    expect(posts.at(-1)?.snapshot.specRows[0]).toMatchObject({ key: 'specs' });
    // core leaves optional row fields undefined; Orca refuses a post that holds one
    for (const post of posts) for (const row of [...post.snapshot.specRows, ...post.snapshot.steeringRows]) expect(Object.values(row)).not.toContain(undefined);
    expect(await dispatch(live.handlers, { type: 'steno.panel' })).toMatchObject({ server: 'running', specRows: [{ key: 'specs' }, { key: 'notice:no-specs' }] });
    live.dispose();
  });

  it('answers with an empty panel while no worktree is focused', async () => {
    const { orca } = liveOrca(null);
    const live = liveHandlers(orca, fakePool().pool);
    await settle();
    expect(await dispatch(live.handlers, { type: 'steno.panel' })).toMatchObject({ specRows: [], steeringRows: [] });
    expect(await dispatch(live.handlers, { type: 'steno.act', key: 'server', action: 'restart' })).toHaveProperty('nothing');
    live.dispose();
  });

  it('restarts the focused worktree\'s server', async () => {
    const { orca, focus } = liveOrca('w1');
    const { pool, restarted } = fakePool();
    const live = liveHandlers(orca, pool);
    await settle();
    focus('w2');
    await settle();
    expect(await dispatch(live.handlers, { type: 'steno.act', key: 'server', action: 'restart' })).toEqual({ done: true });
    expect(restarted).toEqual(['/nowhere/b']);
    live.dispose();
  });
});
