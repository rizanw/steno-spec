// The pool: one server per `file` folder, started and stopped with the folder.
import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { changeFolders, folder, resetRecorded, setFolders, Uri } from './vscode-stub.js';
import {
  Refresher, ServerPool, keepLenses, provideCodeLenses, selectorFor, trackFolders, type ClientHandlers, type CreateClient,
  type StenoClient,
} from '../src/servers.js';
import type { OutlineItem, SpecTree } from '../src/protocol.js';

const SERVER = '/ext/dist/steno-lsp.mjs';

interface Fake extends StenoClient {
  readonly log: string[];
  readonly serverPath: string;
  readonly folderName: string;
}

/** A factory whose clients only record what the pool asked of them. */
function fakes(): { create: CreateClient; made: Fake[] } {
  const made: Fake[] = [];
  const create: CreateClient = (f, serverPath) => {
    const log: string[] = [];
    const client: Fake = {
      log, serverPath, folderName: f.name,
      start: async () => { log.push('start'); },
      stop: async () => { log.push('stop'); },
      sendRequest: async <T>() => undefined as T,
      onNotification: () => ({ dispose: () => {} }),
    };
    made.push(client);
    return client;
  };
  return { create, made };
}

beforeEach(() => resetRecorded());

describe('ServerPool', () => {
  it('starts one bundled server per folder, and only the bundled one', async () => {
    const { create, made } = fakes();
    const pool = new ServerPool(SERVER, create);
    await pool.start(folder('/work/a'));
    await pool.start(folder('/work/b', 1));
    expect(made.map(c => c.folderName)).toEqual(['a', 'b']);
    expect(made.map(c => c.serverPath)).toEqual([SERVER, SERVER]);
    expect(made.every(c => c.log.includes('start'))).toBe(true);
  });

  it('starts nothing twice for the same folder', async () => {
    const { create, made } = fakes();
    const pool = new ServerPool(SERVER, create);
    const a = folder('/work/a');
    await pool.start(a);
    await pool.start(a);
    expect(made).toHaveLength(1);
  });

  it('gives a folder with a non-file scheme no server', async () => {
    const { create, made } = fakes();
    const pool = new ServerPool(SERVER, create);
    await pool.start({ uri: Uri.parse('vscode-vfs://host/repo'), name: 'repo', index: 0 });
    expect(made).toHaveLength(0);
    expect(pool.all()).toHaveLength(0);
  });

  it('stops a folder\'s server and forgets it', async () => {
    const { create, made } = fakes();
    const pool = new ServerPool(SERVER, create);
    const a = folder('/work/a');
    await pool.start(a);
    await pool.stop(a);
    expect(made[0].log).toEqual(['start', 'stop']);
    expect(pool.all()).toHaveLength(0);
  });

  it('stops every server on dispose, as the window closing does', async () => {
    const { create, made } = fakes();
    const pool = new ServerPool(SERVER, create);
    await pool.start(folder('/work/a'));
    await pool.start(folder('/work/b', 1));
    await pool.dispose();
    expect(made.map(c => c.log)).toEqual([['start', 'stop'], ['start', 'stop']]);
    expect(pool.all()).toHaveLength(0);
  });

  it('finds the folder that holds a file, taking the longest match', async () => {
    const { create } = fakes();
    const pool = new ServerPool(SERVER, create);
    const outer = folder('/work');
    const inner = folder('/work/nested', 1);
    await pool.start(outer);
    await pool.start(inner);
    expect(pool.get(Uri.file('/work/a.md'))?.folder.name).toBe('work');
    expect(pool.get(Uri.file('/work/nested/a.md'))?.folder.name).toBe('nested');
    expect(pool.get(Uri.file('/elsewhere/a.md'))).toBeUndefined();
    // a sibling whose name merely starts with the folder's path is not inside it
    expect(pool.get(Uri.file('/workshop/a.md'))).toBeUndefined();
  });

  it('fires onDidChange when a server starts, stops or answers with a tree', async () => {
    const { create } = fakes();
    const pool = new ServerPool(SERVER, create);
    const seen: string[] = [];
    pool.onDidChange(s => seen.push(`${s.folder.name}:${s.state}:${s.tree ? 'tree' : '-'}`));
    const a = folder('/work/a');
    await pool.start(a);
    pool.setTree(pool.get(Uri.file('/work/a/x.md'))!, { protocolVersion: 1, specs: [], steering: [] });
    await pool.stop(a);
    expect(seen).toEqual(['a:running:-', 'a:running:tree', 'a:stopped:tree']);
  });
});

describe('the document selector', () => {
  it('is Markdown and YAML under that folder alone', () => {
    const selector = selectorFor(folder('/work/a')) as { language: string; pattern: { pattern: string; baseUri: Uri } }[];
    expect(selector.map(s => s.language)).toEqual(['markdown', 'yaml']);
    for (const s of selector) {
      expect(s.pattern.pattern).toBe('**/*.{md,yaml}');
      expect(s.pattern.baseUri.fsPath).toBe('/work/a');
    }
  });
});

describe('trackFolders', () => {
  it('starts every open folder, then follows folders added and removed', async () => {
    const { create, made } = fakes();
    const pool = new ServerPool(SERVER, create);
    const a = folder('/work/a'), b = folder('/work/b', 1), c = folder('/work/c', 2);
    setFolders(a, b);
    const tracker = trackFolders(pool);
    await Promise.resolve();
    expect(pool.all().map(s => s.folder.name)).toEqual(['a', 'b']);

    changeFolders({ added: [c], removed: [a] });
    await Promise.resolve();
    await Promise.resolve();
    expect(pool.all().map(s => s.folder.name)).toEqual(['b', 'c']);
    expect(made.find(m => m.folderName === 'a')!.log).toEqual(['start', 'stop']);
    tracker.dispose();
  });
});

describe('Refresher', () => {
  /** let every queued microtask run, as the event loop would between notices. */
  const settle = () => new Promise(resolve => setImmediate(resolve));

  it('keeps one fetch in flight and collapses the notices that arrive during it', async () => {
    let calls = 0;
    let release: (() => void) | undefined;
    const applied: number[] = [];
    const r = new Refresher(
      () => { calls++; return new Promise<SpecTree>(res => { release = () => res({ protocolVersion: 1, specs: [], steering: [] }); }); },
      () => applied.push(calls),
    );
    r.request();
    await settle();
    expect(calls).toBe(1);
    r.request(); r.request(); r.request();   // three notices while the first fetch is out
    expect(calls).toBe(1);
    release!();
    await settle();
    expect(calls).toBe(2);                   // exactly one more, not three
    release!();
    await settle();
    expect(calls).toBe(2);
    expect(applied).toEqual([1, 2]);
  });

  it('leaves the last tree in place when a fetch fails, and serves the next notice', async () => {
    let calls = 0;
    const applied: SpecTree[] = [];
    const r = new Refresher(
      async () => { if (++calls === 1) throw new Error('server went away'); return { protocolVersion: 1, specs: [], steering: [] }; },
      t => applied.push(t),
    );
    r.request();
    await settle();
    expect(applied).toHaveLength(0);
    r.request();
    await settle();
    expect(applied).toHaveLength(1);
  });
});

describe('tree notices', () => {
  const settle = () => new Promise(resolve => setImmediate(resolve));

  /** A client that answers `steno/specTree` and hands back the notice handler it was given. */
  function noticing(): { create: CreateClient; notify: () => void; requests: string[] } {
    const requests: string[] = [];
    let handler: (() => void) | undefined;
    const create: CreateClient = () => ({
      start: async () => {},
      stop: async () => {},
      sendRequest: async <T>(method: string) => { requests.push(method); return { protocolVersion: 1, specs: [], steering: [] } as T; },
      onNotification: (_m: string, h: (params: unknown) => void) => { handler = () => h(undefined); return { dispose: () => { handler = undefined; } }; },
    });
    return { create, notify: () => handler?.(), requests };
  }

  it('asks for the tree once the client runs, and again on steno/treeChanged', async () => {
    const { create, notify, requests } = noticing();
    const pool = new ServerPool(SERVER, create);
    await pool.start(folder('/work/a'));
    await settle();
    expect(requests).toEqual(['steno/specTree']);
    expect(pool.all()[0].tree).toBeDefined();
    notify();
    await settle();
    expect(requests).toEqual(['steno/specTree', 'steno/specTree']);
  });

  it('asks again after a restart, since the restarted server told us nothing yet', async () => {
    const { create, requests } = noticing();
    const pool = new ServerPool(SERVER, create);
    await pool.start(folder('/work/a'));
    await settle();
    await pool.restart(pool.all()[0]);
    await settle();
    expect(requests).toHaveLength(2);
  });

  it('stops following a folder it has stopped', async () => {
    const { create, notify, requests } = noticing();
    const pool = new ServerPool(SERVER, create);
    const a = folder('/work/a');
    await pool.start(a);
    await settle();
    await pool.stop(a);
    notify();
    await settle();
    expect(requests).toHaveLength(1);
  });
});

describe('the lens middleware', () => {
  const uri = Uri.file('/work/a/.steno/specs/auth/tasks.md') as unknown as import('vscode').Uri;
  const lens = (command: string, args: unknown = { spec: 'auth', task: 'T1', optional: false }) =>
    ({ range: 1, command: { command, title: command, arguments: [args] } });
  const never = () => false;

  it('drops a run lens the tree does not offer, and adds the document URI to the done lens', async () => {
    const next = async () => [lens('steno.task.run'), lens('steno.task.done'), lens('steno.task.run')];
    const out = await provideCodeLenses({ uri }, undefined, next, never);
    expect(out).toHaveLength(1);
    expect(out![0].command!.command).toBe('steno.task.done');
    expect(out![0].command!.arguments).toEqual([{ spec: 'auth', task: 'T1', optional: false, uri }]);
  });

  it('keeps a runnable run lens and adds the document URI to it', async () => {
    const out = await provideCodeLenses({ uri }, undefined, async () => [lens('steno.task.run')], (spec, task) => spec === 'auth' && task === 'T1');
    expect(out!.map(l => l.command!.arguments)).toEqual([[{ spec: 'auth', task: 'T1', optional: false, uri }]]);
  });

  it('keeps a lens with no command and passes no answer through', async () => {
    const bare: { range: number; command?: undefined }[] = [{ range: 1 }];
    expect(keepLenses(uri, bare, never)).toEqual([{ range: 1 }]);
    expect(keepLenses(uri, null, never)).toBeNull();
    expect(await provideCodeLenses({ uri }, undefined, () => undefined, never)).toBeUndefined();
  });

  it('keeps every other lens, a run lens exactly when runnable, and gives kept run and done lenses the URI', () => {
    const anyLens = fc.record({
      command: fc.constantFrom('steno.task.run', 'steno.task.done', 'other.command'),
      spec: fc.constantFrom('auth', 'billing'),
      task: fc.constantFrom('T1', 'T2', 'T3'),
    });
    fc.assert(fc.property(fc.array(anyLens), fc.func(fc.boolean()), (specs, decide) => {
      const isRunnable = (spec: string, task: string) => decide(spec, task);
      const lenses = specs.map(l => lens(l.command, { spec: l.spec, task: l.task, optional: false }));
      const out = keepLenses(uri, lenses, isRunnable)!;
      const expected = specs.filter(l => l.command !== 'steno.task.run' || isRunnable(l.spec, l.task));
      expect(out.map(l => l.command!.command)).toEqual(expected.map(l => l.command));
      out.forEach((l, i) => {
        const [args] = l.command!.arguments as { uri?: unknown }[];
        expect(args.uri).toBe(expected[i].command === 'other.command' ? undefined : uri);
      });
    }));
  });

  it('builds runnable from the folder tree, so the lens follows its phase and tasks', async () => {
    const handlers: ClientHandlers[] = [];
    const create: CreateClient = (_f, _p, _s, h) => {
      handlers.push(h);
      return { start: async () => {}, stop: async () => {}, sendRequest: async <T>() => undefined as T, onNotification: () => ({ dispose: () => {} }) };
    };
    const pool = new ServerPool(SERVER, create);
    await pool.start(folder('/work/a'));
    const [{ runnable }] = handlers;
    expect(runnable('auth', 'T1')).toBe(false);
    const item: OutlineItem = { kind: 'task', id: 'T1', title: 'T1', line: 3, endLine: 3, children: [] };
    const tree = (phase: 'tasks' | 'execute'): SpecTree =>
      ({ protocolVersion: 1, specs: [{ name: 'auth', phase, taskItems: [item] }], steering: [] }) as SpecTree;
    pool.setTree(pool.all()[0], tree('tasks'));
    expect(runnable('auth', 'T1')).toBe(false);
    pool.setTree(pool.all()[0], tree('execute'));
    expect(runnable('auth', 'T1')).toBe(true);
    pool.setTree(pool.all()[0], { ...tree('execute'), specs: [{ name: 'auth', unreadable: true, taskItems: [item] }] } as SpecTree);
    expect(runnable('auth', 'T1')).toBe(false);
  });
});
