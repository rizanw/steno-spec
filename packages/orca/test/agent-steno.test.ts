// The agents' `steno`: which PATH the worker checks, when it checks again, and what the panel's warning says.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AgentSteno, CheckOptions, FolderServer, ServerPool } from '@steno/host';
import type { Post } from '../src/shared/messages.js';
import { dispatch, liveHandlers } from '../src/worker.js';
import { checkAgentSteno, UNCHECKED, VERSION, workerEnv } from '../src/worker/agent-steno.js';
import { agentStenoWarning, installCommand } from '../src/panel/rows.js';

const cliVersion = (JSON.parse(readFileSync(new URL('../../cli/package.json', import.meta.url), 'utf8')) as { version: string }).version;

describe('the PATH the worker checks', () => {
  it('takes PATH, or the Path some Windows environments set, with PATHEXT and the platform', () => {
    expect(workerEnv({ PATH: '/usr/bin' }, 'darwin')).toEqual({ path: '/usr/bin', pathExt: undefined, windows: false });
    expect(workerEnv({ Path: 'C:\\bin', PATHEXT: '.COM;.CMD' }, 'win32')).toEqual({ path: 'C:\\bin', pathExt: '.COM;.CMD', windows: true });
    expect(workerEnv({}, 'linux')).toEqual({ path: '', pathExt: undefined, windows: false });
  });

  it('compares with the bundled CLI, whose version is compiled in', async () => {
    expect(VERSION).toBe(cliVersion);
    let given: CheckOptions | undefined;
    const found: AgentSteno = { found: true, version: '0.0.1', protocol: 1, matches: false, bundled: VERSION };
    expect(await checkAgentSteno(async options => { given = options; return found; })).toBe(found);
    expect(given).toEqual({ env: workerEnv(), bundled: VERSION });
  });

  it('warns about nothing before the first check answers', () => {
    expect(UNCHECKED).toEqual({ found: false, matches: true, bundled: VERSION });
    expect(agentStenoWarning(UNCHECKED)).toBeUndefined();
  });
});

describe("the warning about the agents' steno", () => {
  const bundled = '0.2.0';
  const install = installCommand(bundled);

  it('installs the bundled version', () => {
    expect(install).toBe('npm install -g steno-spec@0.2.0');
  });

  it('says nothing when it matches', () => {
    expect(agentStenoWarning({ found: true, protocol: 1, version: '0.2.0', matches: true, bundled })).toBeUndefined();
  });

  it('names the bundled version and the install command when there is no steno', () => {
    const text = agentStenoWarning({ found: false, matches: false, bundled })!;
    expect(text).toContain('no steno command');
    expect(text).toContain(bundled);
    expect(text).toContain(install);
  });

  it('names both versions when the agents run an older one', () => {
    const text = agentStenoWarning({ found: true, protocol: 1, version: '0.1.4', matches: false, bundled })!;
    expect(text).toContain('0.1.4');
    expect(text).toContain(bundled);
    expect(text).toContain(install);
  });

  it('names the other protocol, and the version when known', () => {
    const text = agentStenoWarning({ found: true, protocol: 2, version: '0.9.0', matches: false, bundled })!;
    expect(text).toContain('protocol 2');
    expect(text).toContain('0.9.0');
    expect(text).toContain(bundled);
    expect(text).toContain(install);
    expect(agentStenoWarning({ found: true, matches: false, bundled })).toContain('an unknown protocol');
  });
});

/** A pool whose servers answer with a set-up tree and no specs. */
function fakePool(): ServerPool {
  const serverFor = (folder: string): FolderServer => ({
    folder, state: 'running', diagnostics: new Map(), tree: { protocolVersion: 1, specs: [], steering: [] } as never,
    onChange: () => () => {}, hold: () => () => {}, request: () => Promise.reject(new Error('not used')), settled: () => Promise.resolve(),
  });
  return { serverFor, restart: serverFor, dispose() {} };
}

/** An Orca with worktree w1 focused, whose focus the test can move and whose posts it can read. */
function liveOrca() {
  let changed: ((payload: { context: { workspaceId?: string } | null }) => unknown) | undefined;
  const posts: Post[] = [];
  const orca = {
    events: { on: (_: string, h: typeof changed) => { changed = h; return { dispose() {} }; } },
    host: {
      has: () => true,
      call: async (method: string) => {
        if (method === 'workspace.readContext') return { workspaceId: 'w1' };
        if (method === 'workspace.list') return { workspaces: [{ id: 'w1', path: '/nowhere/a' }, { id: 'w2', path: '/nowhere/b' }], truncated: false };
        return {};
      },
    },
    panels: { handle() { return { dispose() {} }; }, post: (_: string, payload: Post) => { posts.push(payload); } },
    log() {},
  };
  return { orca: orca as never, posts, focus: (id: string) => changed?.({ context: { workspaceId: id } }) };
}

const noCli = async () => { throw new Error('the CLI should not run here'); };
const settle = () => new Promise(resolve => setTimeout(resolve, 200));
const missing: AgentSteno = { found: false, matches: false, bundled: VERSION };
const matching: AgentSteno = { found: true, protocol: 1, version: VERSION, matches: true, bundled: VERSION };

describe("the worker's check", () => {
  it('runs when the worktree changes and posts what it found', async () => {
    const { orca, posts, focus } = liveOrca();
    let checks = 0;
    const live = liveHandlers(orca, fakePool(), noCli, async () => { checks++; return missing; });
    await settle();
    expect(checks).toBe(1);
    expect(posts.at(-1)?.snapshot.agentSteno).toEqual(missing);
    focus('w2');
    await settle();
    expect(checks).toBe(2);
    live.dispose();
  });

  it('checks again on Re-check and drops the warning once the agents\' steno matches', async () => {
    const { orca, posts } = liveOrca();
    const answers = [missing, matching];
    const live = liveHandlers(orca, fakePool(), noCli, async () => answers.shift()!);
    await settle();
    expect(agentStenoWarning((await dispatch(live.handlers, { type: 'steno.panel' })).agentSteno)).toContain('no steno command');
    const rechecked = await dispatch(live.handlers, { type: 'steno.recheck' });
    expect(rechecked.agentSteno).toEqual(matching);
    expect(agentStenoWarning(rechecked.agentSteno)).toBeUndefined();
    await settle();
    expect(posts.at(-1)?.snapshot.agentSteno).toEqual(matching);
    live.dispose();
  });

  it('keeps the latest check when an earlier one answers after it', async () => {
    const { orca } = liveOrca();
    let release: (found: AgentSteno) => void = () => {};
    const slow = new Promise<AgentSteno>(resolve => { release = resolve; });
    const answers = [() => slow, async () => matching];
    const live = liveHandlers(orca, fakePool(), noCli, () => answers.shift()!());
    await settle();
    await dispatch(live.handlers, { type: 'steno.recheck' });
    release(missing);
    await settle();
    expect((await dispatch(live.handlers, { type: 'steno.panel' })).agentSteno).toEqual(matching);
    live.dispose();
  });

  it('shows no warning when the check itself fails', async () => {
    const { orca } = liveOrca();
    const live = liveHandlers(orca, fakePool(), noCli, () => Promise.reject(new Error('spawn failed')));
    await settle();
    expect(agentStenoWarning((await dispatch(live.handlers, { type: 'steno.panel' })).agentSteno)).toBeUndefined();
    live.dispose();
  });
});
