import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { buildTree, loadProject } from '@steno/core';
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
function fakePool(server: Partial<FolderServer> = {}) {
  const restarted: string[] = [];
  const servers = new Map<string, FolderServer>();
  const serverFor = (folder: string) => {
    if (!servers.has(folder)) {
      servers.set(folder, {
        folder, state: 'running', diagnostics: new Map(), tree: { protocolVersion: 1, specs: [], steering: [] } as never,
        onChange: () => () => {}, hold: () => () => {}, request: () => Promise.reject(new Error('not used')), settled: () => Promise.resolve(), ...server,
      });
    }
    return servers.get(folder)!;
  };
  const pool: ServerPool = { serverFor, restart: folder => { restarted.push(folder); return serverFor(folder); }, dispose() {} };
  return { pool, restarted };
}

/** Orca's agent list: the agents already running, then a launched agent in the terminal Orca gave it. */
const launched = (calls: { method: string }[], running: object[] = []) =>
  [...running, ...(calls.some(c => c.method === 'agent.launch') ? [{ terminalId: 't1', title: null, agent: 'claude', state: 'waiting', stateStartedAt: 0 }] : [])];

/** An Orca with one focused worktree, whose events the test can fire and whose posts it can read. */
function liveOrca(focused: string | null, paths = ['/nowhere/a', '/nowhere/b'], running: object[] = [], stored: Record<string, unknown> = {}) {
  let changed: ((payload: { context: { workspaceId?: string } | null }) => unknown) | undefined;
  const posts: Post[] = [];
  const calls: { method: string; params: unknown }[] = [];
  // the plugin's private store, kept for the test to read
  const store = new Map<string, unknown>(Object.entries(stored));
  const orca = {
    events: { on: (_: string, h: typeof changed) => { changed = h; return { dispose() {} }; } },
    host: {
      has: () => true,
      call: async (method: string, params: unknown) => {
        if (method === 'workspace.readContext') return focused ? { workspaceId: focused } : null;
        if (method === 'workspace.list') return { workspaces: [{ id: 'w1', path: paths[0] }, { id: 'w2', path: paths[1] }], truncated: false };
        calls.push({ method, params });
        if (method === 'storage.get') return { value: store.get((params as { key: string }).key) ?? null };
        if (method === 'storage.set') { store.set((params as { key: string }).key, (params as { value: unknown }).value); return { ok: true }; }
        if (method === 'agent.launch') return { terminalId: 't1' };
        if (method === 'agents.list') return { agents: launched(calls, running) };
        if (method === 'terminal.sendText') return { accepted: true };
        return {};
      },
    },
    panels: { handle() { return { dispose() {} }; }, post: (_: string, payload: Post) => { posts.push(payload); } },
    log() {},
  };
  return { orca: orca as never, posts, calls, store, focus: (id: string) => changed?.({ context: { workspaceId: id } }) };
}

const STATE = 'name: a\ntitle: Alpha\nkind: feature\nmode: gated\nphase: execute\ncreated: 2026-01-01\n';

/** A CLI the test does not expect to run. */
const noCli = async () => { throw new Error('the CLI should not run here'); };

const settle = () => new Promise(resolve => setTimeout(resolve, 20));

describe('the live worker', () => {
  it('posts the focused worktree and answers the panel with its snapshot', async () => {
    const { orca, posts } = liveOrca('w1');
    const live = liveHandlers(orca, fakePool().pool, noCli);
    await vi.waitFor(() => expect(posts.at(-1)?.snapshot.specRows[0]).toMatchObject({ key: 'specs' }));
    // core leaves optional row fields undefined; Orca refuses a post that holds one
    for (const post of posts) for (const row of [...post.snapshot.specRows, ...post.snapshot.steeringRows]) expect(Object.values(row)).not.toContain(undefined);
    expect(await dispatch(live.handlers, { type: 'steno.panel' })).toMatchObject({ server: 'running', specRows: [{ key: 'specs' }, { key: 'notice:no-specs' }] });
    live.dispose();
  });

  it('answers with an empty panel while no worktree is focused', async () => {
    const { orca } = liveOrca(null);
    const live = liveHandlers(orca, fakePool().pool, noCli);
    await settle();
    expect(await dispatch(live.handlers, { type: 'steno.panel' })).toMatchObject({ specRows: [], steeringRows: [] });
    expect(await dispatch(live.handlers, { type: 'steno.act', key: 'server', action: 'restart' })).toHaveProperty('nothing');
    live.dispose();
  });

  it('restarts the focused worktree\'s server', async () => {
    const { orca, focus } = liveOrca('w1');
    const { pool, restarted } = fakePool();
    const live = liveHandlers(orca, pool, noCli);
    await settle();
    focus('w2');
    await settle();
    expect(await dispatch(live.handlers, { type: 'steno.act', key: 'server', action: 'restart' })).toEqual({ done: true });
    expect(restarted).toEqual(['/nowhere/b']);
    live.dispose();
  });

  it('asks to confirm a reopen and sends it only once the panel confirms', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'steno-orca-worker-'));
    const files = { '.steno/config.yaml': '', '.steno/specs/a/spec.yaml': STATE, '.steno/specs/a/tasks.md': '# T\n\n- [x] 1. One\n' };
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(join(folder, ...path.split('/'), '..'), { recursive: true });
      writeFileSync(join(folder, ...path.split('/')), text);
    }
    const sent: string[] = [];
    const { orca } = liveOrca('w1', [folder, folder]);
    const live = liveHandlers(orca, fakePool({ tree: buildTree(loadProject(folder)), request: async (method: string) => { sent.push(method); return { protocolVersion: 1, spec: 'a', phase: 'execute' } as never; } }).pool, noCli);
    await settle();
    expect(await dispatch(live.handlers, { type: 'steno.act', key: 'task:a/T1', action: 'reopen' })).toEqual({ form: 'reopenConfirm', key: 'task:a/T1' });
    expect(sent).toEqual([]);
    expect(await dispatch(live.handlers, { type: 'steno.submit', form: 'reopenConfirm', key: 'task:a/T1', answers: {} })).toEqual({ done: true });
    expect(sent).toEqual(['steno/taskReopen']);
    live.dispose();
  });

  it('asks for the New Spec form first and runs the CLI only once it is submitted', async () => {
    const runs: string[][] = [];
    const run = async (args: string[]) => { runs.push(args); return { code: 0, stdout: JSON.stringify({ protocolVersion: 1, spec: 'b', phase: 'requirements', created: [] }), stderr: '' }; };
    const { orca } = liveOrca('w1');
    const live = liveHandlers(orca, fakePool().pool, run);
    await settle();
    expect(await dispatch(live.handlers, { type: 'steno.act', key: 'specs', action: 'newSpec' })).toMatchObject({ form: 'newSpec', choices: expect.arrayContaining(['claude']) });
    expect(runs).toEqual([]);
    expect(await dispatch(live.handlers, { type: 'steno.submit', form: 'newSpec', answers: { kind: 'feature', name: 'b', writer: 'self' } })).toEqual({ done: true });
    expect(runs).toEqual([['--root', '/nowhere/a', '--json', 'new', '--', 'b']]);
    live.dispose();
  });

  it('asks for the agents before Set Up and installs only once the pick is submitted', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'steno-orca-worker-'));
    const runs: string[][] = [];
    const run = async (args: string[]) => {
      runs.push(args);
      const out = args.includes('--list-agents') ? { agents: [{ key: 'claude', label: 'Claude Code' }] } : { root: folder, skills: ['steno-run'], agents: { claude: '.claude/skills' } };
      return { code: 0, stdout: JSON.stringify(out), stderr: '' };
    };
    const { orca } = liveOrca('w1', [folder, folder]);
    const live = liveHandlers(orca, fakePool().pool, run);
    await settle();
    expect(await dispatch(live.handlers, { type: 'steno.act', key: 'notice:not-set-up', action: 'setUp' })).toEqual({ form: 'setUp', choices: ['claude'] });
    expect(runs.map(r => r.at(-1))).toEqual(['--list-agents']);
    expect(await dispatch(live.handlers, { type: 'steno.submit', form: 'setUp', answers: { agents: 'claude' } })).toEqual({ done: true });
    expect(runs.map(r => r.at(-1))).toEqual(['--list-agents', '--agent=claude']);
    live.dispose();
  });

  it('asks which agent takes a hand-off and starts it only once one is picked', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'steno-orca-worker-'));
    const files = { '.steno/config.yaml': '', '.steno/specs/a/spec.yaml': STATE, '.steno/specs/a/tasks.md': '# T\n\n- [ ] 1. One\n' };
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(join(folder, ...path.split('/'), '..'), { recursive: true });
      writeFileSync(join(folder, ...path.split('/')), text);
    }
    const { orca, calls } = liveOrca('w1', [folder, folder]);
    const live = liveHandlers(orca, fakePool({ tree: buildTree(loadProject(folder)) }).pool, noCli);
    await settle();
    const asked = await dispatch(live.handlers, { type: 'steno.act', key: 'task:a/T1', action: 'run' });
    expect(asked).toMatchObject({ form: 'agentPick', key: 'task:a/T1', choices: expect.arrayContaining(['claude']) });
    expect(calls.filter(c => c.method === 'agent.launch')).toEqual([]);
    expect(await dispatch(live.handlers, { type: 'steno.submit', form: 'agentPick', key: 'task:a/T1', answers: { action: 'run', agent: 'claude' } })).toEqual({ done: true });
    expect(calls.filter(c => c.method === 'agent.launch')).toEqual([{ method: 'agent.launch', params: { workspaceId: 'w1', agent: 'claude' } }]);
    await vi.waitFor(() => expect(calls.filter(c => c.method === 'terminal.sendText')).toEqual([{ method: 'terminal.sendText', params: { terminalId: 't1', text: '/steno-run T1 a', enter: false } }]));
    live.dispose();
  });

  it('offers an agent already running in the worktree and types the hand-off into it, starting nothing', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'steno-orca-worker-'));
    const files = { '.steno/config.yaml': '', '.steno/specs/a/spec.yaml': STATE, '.steno/specs/a/tasks.md': '# T\n\n- [ ] 1. One\n' };
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(join(folder, ...path.split('/'), '..'), { recursive: true });
      writeFileSync(join(folder, ...path.split('/')), text);
    }
    const running = [{ terminalId: 't7', title: 'Codex', agent: 'codex', state: 'waiting', stateStartedAt: 0 }];
    const { orca, calls } = liveOrca('w1', [folder, folder], running);
    const live = liveHandlers(orca, fakePool({ tree: buildTree(loadProject(folder)) }).pool, noCli);
    await settle();
    expect(await dispatch(live.handlers, { type: 'steno.act', key: 'task:a/T1', action: 'run' }))
      .toMatchObject({ form: 'agentPick', running: [{ terminalId: 't7', agent: 'codex', title: 'Codex' }] });
    expect(await dispatch(live.handlers, { type: 'steno.submit', form: 'agentPick', key: 'task:a/T1', answers: { action: 'run', terminal: 't7' } })).toEqual({ done: true });
    expect(calls.filter(c => c.method === 'agent.launch')).toEqual([]);
    expect(calls.filter(c => c.method === 'terminal.sendText')).toEqual([{ method: 'terminal.sendText', params: { terminalId: 't7', text: '$steno-run T1 a', enter: false } }]);
    expect(calls.at(-1)).toEqual({ method: 'terminal.focus', params: { terminalId: 't7' } });
    live.dispose();
  });

  describe('with a default agent', () => {
    /** A worktree with one open task, its live worker, and an Orca store and agent list as given. */
    async function worktree(running: object[] = [], agent?: string) {
      const folder = mkdtempSync(join(tmpdir(), 'steno-orca-worker-'));
      const files = { '.steno/config.yaml': '', '.steno/specs/a/spec.yaml': STATE, '.steno/specs/a/tasks.md': '# T\n\n- [ ] 1. One\n' };
      for (const [path, text] of Object.entries(files)) {
        mkdirSync(join(folder, ...path.split('/'), '..'), { recursive: true });
        writeFileSync(join(folder, ...path.split('/')), text);
      }
      const fake = liveOrca('w1', [folder, folder], running, agent ? { defaultAgents: { [folder]: agent } } : {});
      const live = liveHandlers(fake.orca, fakePool({ tree: buildTree(loadProject(folder)) }).pool, noCli);
      await settle();
      return { ...fake, folder, live };
    }
    const runTask = (live: { handlers: Parameters<typeof dispatch>[0] }) => dispatch(live.handlers, { type: 'steno.act', key: 'task:a/T1', action: 'run' });

    it('saves the first agent picked in a worktree and draws it in every snapshot after', async () => {
      const { live, posts, store, folder } = await worktree();
      expect(await runTask(live)).toMatchObject({ form: 'agentPick' });
      await dispatch(live.handlers, { type: 'steno.submit', form: 'agentPick', key: 'task:a/T1', answers: { action: 'run', agent: 'codex' } });
      expect(store.get('defaultAgents')).toEqual({ [folder]: 'codex' });
      await vi.waitFor(() => expect((posts.at(-1) as Post).snapshot.defaultAgent).toBe('codex'));
      expect((await dispatch(live.handlers, { type: 'steno.panel' })).defaultAgent).toBe('codex');
      live.dispose();
    });

    it('saves the kind of a running agent picked first', async () => {
      const running = [{ terminalId: 't7', title: null, agent: 'claude', state: 'waiting', stateStartedAt: 0 }];
      const { live, store, folder } = await worktree(running);
      await dispatch(live.handlers, { type: 'steno.submit', form: 'agentPick', key: 'task:a/T1', answers: { action: 'run', terminal: 't7', agent: 'claude' } });
      expect(store.get('defaultAgents')).toEqual({ [folder]: 'claude' });
      live.dispose();
    });

    it('starts the saved agent without asking when none of its kind runs', async () => {
      const running = [{ terminalId: 't7', title: null, agent: 'claude', state: 'waiting', stateStartedAt: 0 }];
      const { live, calls } = await worktree(running, 'codex');
      expect(await runTask(live)).toEqual({ done: true });
      expect(calls.filter(c => c.method === 'agent.launch')).toEqual([{ method: 'agent.launch', params: { workspaceId: 'w1', agent: 'codex' } }]);
      live.dispose();
    });

    it('offers only the running agents of the saved kind and a new one', async () => {
      const running = [
        { terminalId: 't7', title: 'A', agent: 'claude', state: 'waiting', stateStartedAt: 0 },
        { terminalId: 't8', title: 'B', agent: 'codex', state: 'waiting', stateStartedAt: 0 },
      ];
      const { live, calls } = await worktree(running, 'claude');
      expect(await runTask(live)).toEqual({ form: 'agentPick', key: 'task:a/T1', choices: ['claude'], running: [{ terminalId: 't7', agent: 'claude', title: 'A' }] });
      expect(calls.filter(c => c.method === 'agent.launch')).toEqual([]);
      live.dispose();
    });

    it('changes the saved agent from the panel and hands off to the new one', async () => {
      const { live, calls, store, folder } = await worktree([], 'claude');
      const asked = await dispatch(live.handlers, { type: 'steno.act', key: '', action: 'chooseAgent' });
      expect(asked).toMatchObject({ form: 'defaultAgent', choices: expect.arrayContaining(['claude', 'gemini']) });
      expect(await dispatch(live.handlers, { type: 'steno.submit', form: 'defaultAgent', answers: { agent: 'gemini' } })).toEqual({ done: true });
      expect(store.get('defaultAgents')).toEqual({ [folder]: 'gemini' });
      await runTask(live);
      expect(calls.filter(c => c.method === 'agent.launch').at(-1)?.params).toEqual({ workspaceId: 'w1', agent: 'gemini' });
      expect(await dispatch(live.handlers, { type: 'steno.submit', form: 'defaultAgent', answers: { agent: 'no-such-agent' } })).toHaveProperty('nothing');
      live.dispose();
    });
  });
});
