// The pool: one server per `file` folder, started and stopped with the folder (R1.1, R1.2, R2.1, R6.3).
import { describe, it, expect, beforeEach } from 'vitest';
import { changeFolders, folder, resetRecorded, setFolders, Uri } from './vscode-stub.js';
import { Refresher, ServerPool, selectorFor, trackFolders, type CreateClient, type StenoClient } from '../src/servers.js';
import type { SpecTree } from '../src/protocol.js';

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
  it('starts one bundled server per folder, and only the bundled one (R1.1, R2.1, R6.3)', async () => {
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

  it('stops a folder\'s server and forgets it (R1.2)', async () => {
    const { create, made } = fakes();
    const pool = new ServerPool(SERVER, create);
    const a = folder('/work/a');
    await pool.start(a);
    await pool.stop(a);
    expect(made[0].log).toEqual(['start', 'stop']);
    expect(pool.all()).toHaveLength(0);
  });

  it('stops every server on dispose, as the window closing does (R1.2)', async () => {
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
  it('starts every open folder, then follows folders added and removed (R1.1, R1.2)', async () => {
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

  it('keeps one fetch in flight and collapses the notices that arrive during it (R3.6)', async () => {
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

  it('asks for the tree once the client runs, and again on steno/treeChanged (R3.6)', async () => {
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

  it('asks again after a restart, since the restarted server told us nothing yet (R1.4, R3.6)', async () => {
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
