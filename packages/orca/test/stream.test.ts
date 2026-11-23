import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentSteno, FolderServer } from '@steno/host';
import type { Snapshot } from '../src/shared/messages.js';
import { streamSnapshots, THROTTLE_MS } from '../src/worker/snapshot.js';
import type { Active } from '../src/worker/worktree.js';

const AGENT: AgentSteno = { found: true, matches: true, bundled: '0.1.4' };

function fakeServer(folder: string) {
  const listeners = new Set<() => void>();
  const server = { folder, state: 'running', diagnostics: new Map(), onChange: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; } };
  return { server: server as unknown as FolderServer, emit: () => { for (const l of [...listeners]) l(); }, listening: () => listeners.size };
}

/** A stream whose builds number themselves, so a test can see which change each post carries. */
function stream(active: Active) {
  let built = 0;
  let instructionsChanged = () => {};
  const posts: number[] = [];
  const controller = new AbortController();
  const build = vi.fn(async () => ({ specRows: [], steeringRows: [], server: 'running', agentSteno: AGENT, built: ++built }) as unknown as Snapshot);
  const handle = streamSnapshots(active, s => posts.push((s as unknown as { built: number }).built), controller.signal, {
    agentSteno: () => AGENT, build, watch: (_folder, changed) => { instructionsChanged = changed; },
  });
  return { posts, build, abort: () => controller.abort(), refresh: handle.refresh, instructions: () => instructionsChanged() };
}

const tick = (ms: number) => vi.advanceTimersByTimeAsync(ms);

describe('the snapshot stream', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('posts the worktree at once', async () => {
    const { server } = fakeServer('/repo');
    const s = stream({ workspaceId: 'w', folder: '/repo', server });
    await tick(0);
    expect(s.posts).toEqual([1]);
  });

  it('posts a burst of changes at most once per window, always including the last', async () => {
    const { server, emit } = fakeServer('/repo');
    const s = stream({ workspaceId: 'w', folder: '/repo', server });
    await tick(0);
    for (let i = 0; i < 10; i++) { emit(); s.instructions(); await tick(20); }
    // 200 ms of changes after the first post: one post per 150 ms window, then the trailing one
    await tick(THROTTLE_MS);
    expect(s.posts).toEqual([1, 2, 3]);
    await tick(1000);
    expect(s.posts).toHaveLength(3);
  });

  it('posts on a change to the instruction files, the enclosing project or a refresh', async () => {
    const main = fakeServer('/repo/sub');
    const outer = fakeServer('/repo');
    const s = stream({ workspaceId: 'w', folder: '/repo/sub', server: main.server, enclosing: outer.server });
    await tick(0);
    s.instructions(); await tick(THROTTLE_MS);
    outer.emit(); await tick(THROTTLE_MS);
    s.refresh(); await tick(THROTTLE_MS);
    expect(s.posts).toEqual([1, 2, 3, 4]);
  });

  it('never posts an older snapshot after a newer one', async () => {
    const { server, emit } = fakeServer('/repo');
    const s = stream({ workspaceId: 'w', folder: '/repo', server });
    s.build.mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve({ built: 0 } as unknown as Snapshot), 500)));
    await tick(0);
    emit(); await tick(THROTTLE_MS);
    await tick(500);
    expect(s.posts).toEqual([0, 1]);
  });

  it('stops listening and posting once aborted', async () => {
    const main = fakeServer('/repo');
    const s = stream({ workspaceId: 'w', folder: '/repo', server: main.server });
    await tick(0);
    main.emit();
    s.abort();
    await tick(1000);
    expect(s.posts).toEqual([1]);
    expect(main.listening()).toBe(0);
  });
});
