import { EventEmitter } from 'node:events';
import { join, resolve } from 'node:path';
import { PassThrough } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { createMessageConnection, StreamMessageReader, StreamMessageWriter, type MessageConnection, type SpecTree } from '../server/vendor/host.mjs';
import { convertDiagnostics, createPool, SPEC_TREE, TREE_CHANGED, type Clock, type ServerPool } from '../server/pool';

const DIR = resolve('/', 'work', 'shop');   // resolved, so Windows gets a drive letter as pathToFileURL does

/** A language server in memory: answers the handshake and the tree, and dies when told to. */
class FakeServer extends EventEmitter {
  stdin = new PassThrough();
  stdout = new PassThrough();
  conn: MessageConnection;
  initialize?: { rootUri: string; capabilities: object };
  initialized = false;
  treeRequests = 0;
  killed = false;
  /** while set, a tree request waits for it before answering */
  gate?: Promise<void>;

  constructor(public tree: SpecTree) {
    super();
    this.conn = createMessageConnection(new StreamMessageReader(this.stdin), new StreamMessageWriter(this.stdout));
    this.conn.onRequest('initialize', (params: FakeServer['initialize']) => { this.initialize = params; return { capabilities: {} }; });
    this.conn.onNotification('initialized', () => { this.initialized = true; });
    this.conn.onRequest(SPEC_TREE, async () => { this.treeRequests++; const answer = this.tree; await this.gate; return answer; });
    this.conn.onRequest('shutdown', () => null);
    this.conn.listen();
  }

  kill(): boolean { this.killed = true; this.crash(); return true; }
  /** an exit nobody asked for */
  crash(): void { this.conn.dispose(); this.emit('exit', 1); }
}

/** A clock moved by hand: `advance` runs every timer that falls due. */
class FakeClock implements Clock {
  time = 0;
  private timers = new Set<{ at: number; run: () => void }>();
  now() { return this.time; }
  after(ms: number, run: () => void) { const t = { at: this.time + ms, run }; this.timers.add(t); return () => { this.timers.delete(t); }; }
  advance(ms: number) {
    this.time += ms;
    for (const t of [...this.timers].sort((a, b) => a.at - b.at)) if (t.at <= this.time && this.timers.delete(t)) t.run();
  }
}

const tree = (name: string): SpecTree => ({ protocolVersion: 1, specs: [{ name }], steering: [] });
const until = async (check: () => boolean) => { for (let i = 0; i < 200 && !check(); i++) await new Promise(r => setTimeout(r, 5)); expect(check()).toBe(true); };

let pool: ServerPool;
let started: FakeServer[];
let clock: FakeClock;
const setUp = () => {
  started = [];
  clock = new FakeClock();
  pool = createPool({ start: () => { const s = new FakeServer(tree(`v${started.length + 1}`)); started.push(s); return s; }, clock, log: () => {} });
};
afterEach(() => pool.dispose());

describe('the server pool', () => {
  it('starts one server per directory with the directory as root and no watching of its own', async () => {
    setUp();
    const server = pool.serverFor(DIR);
    expect(pool.serverFor(DIR)).toBe(server);
    pool.serverFor(resolve('/', 'other'));
    expect(started).toHaveLength(2);
    await server.settled();
    expect(started[0].initialize!.rootUri).toBe(pathToFileURL(DIR).href);
    expect(started[0].initialize!.capabilities).toEqual({});
    expect(started[0].initialized).toBe(true);
    expect(server.state).toBe('running');
    expect(server.tree!.specs[0].name).toBe('v1');
  });

  it('fetches the tree again on each change notice and tells its listeners', async () => {
    setUp();
    const server = pool.serverFor(DIR);
    await server.settled();
    let changes = 0;
    server.onChange(() => { changes++; });
    started[0].tree = tree('edited');
    void started[0].conn.sendNotification(TREE_CHANGED);
    await until(() => server.tree!.specs[0].name === 'edited');
    expect(changes).toBeGreaterThan(0);
  });

  it('keeps diagnostics by workspace path, 1-based, and drops a file whose list empties', async () => {
    setUp();
    const server = pool.serverFor(DIR);
    await server.settled();
    const uri = pathToFileURL(join(DIR, '.steno', 'specs', 'login', 'requirements.md')).href;
    void started[0].conn.sendNotification('textDocument/publishDiagnostics', {
      uri, diagnostics: [{ range: { start: { line: 4, character: 0 }, end: { line: 5, character: 0 } }, severity: 1, code: 'ears/vague', message: 'vague' }],
    });
    await until(() => server.diagnostics.size === 1);
    expect(server.diagnostics.get('.steno/specs/login/requirements.md')).toEqual([
      { file: '.steno/specs/login/requirements.md', line: 5, severity: 'error', rule: 'ears/vague', message: 'vague' },
    ]);
    void started[0].conn.sendNotification('textDocument/publishDiagnostics', { uri, diagnostics: [] });
    await until(() => server.diagnostics.size === 0);
  });

  it('restarts a crashed server and fetches the tree from the new one', async () => {
    setUp();
    const server = pool.serverFor(DIR);
    await server.settled();
    started[0].crash();
    expect(started).toHaveLength(2);
    await until(() => server.tree!.specs[0].name === 'v2');
    expect(server.state).toBe('running');
    expect(started[1].treeRequests).toBe(1);
  });

  it('ignores a tree the replaced server answers after a restart', async () => {
    setUp();
    const server = pool.serverFor(DIR);
    await server.settled();
    let open!: () => void;
    started[0].gate = new Promise(r => { open = r; });
    started[0].tree = tree('stale');
    void started[0].conn.sendNotification(TREE_CHANGED);
    await until(() => started[0].treeRequests === 2);
    pool.restart(DIR);
    open();
    await until(() => server.tree!.specs[0].name === 'v2');
    expect(server.tree!.specs[0].name).toBe('v2');
  });

  it('applies no tree that arrives after the server was disposed', async () => {
    setUp();
    const server = pool.serverFor(DIR);
    await server.settled();
    let open!: () => void;
    started[0].gate = new Promise(r => { open = r; });
    started[0].tree = tree('late');
    void started[0].conn.sendNotification(TREE_CHANGED);
    await until(() => started[0].treeRequests === 2);
    let changes = 0;
    server.onChange(() => { changes++; });
    server.dispose();
    open();
    await new Promise(r => setTimeout(r, 50));
    expect(server.tree!.specs[0].name).toBe('v1');
    expect(changes).toBe(0);
  });

  it('stops on the fifth crash within three minutes, and only Restart starts it again', async () => {
    setUp();
    const server = pool.serverFor(DIR);
    for (let i = 0; i < 5; i++) { clock.advance(10_000); started[i].crash(); }
    expect(server.state).toBe('stopped');
    expect(started).toHaveLength(5);
    await expect(server.request(SPEC_TREE)).rejects.toThrow(/stopped/);
    expect(pool.serverFor(DIR)).toBe(server);
    expect(started).toHaveLength(5);
    expect(pool.restart(DIR)).toBe(server);
    await until(() => server.state === 'running');
    // the record starts clean: one more crash is restarted
    started[5].crash();
    expect(server.state).toBe('starting');
    expect(started).toHaveLength(7);
  });

  it('forgets crashes older than three minutes', () => {
    setUp();
    const server = pool.serverFor(DIR);
    for (let i = 0; i < 5; i++) { clock.advance(60_000); started[i].crash(); }
    expect(server.state).not.toBe('stopped');
  });

  it('shuts a server down after a minute with no subscriber or request, and starts a fresh one on next use', async () => {
    setUp();
    const server = pool.serverFor(DIR);
    await server.settled();
    const release = server.hold();
    clock.advance(120_000);
    expect(started[0].killed).toBe(false);
    release();
    clock.advance(30_000);
    await server.request(SPEC_TREE);
    clock.advance(59_000);
    expect(pool.serverFor(DIR)).toBe(server);
    clock.advance(1_000);
    await until(() => started[0].killed);
    expect(server.state).not.toBe('stopped');
    expect(pool.serverFor(DIR)).not.toBe(server);
    expect(started).toHaveLength(2);
  });
});

describe('diagnostic conversion', () => {
  it('turns a warning into a workspace-relative path with forward slashes', () => {
    const uri = pathToFileURL(join(DIR, 'docs', 'a.md')).href;
    expect(convertDiagnostics(DIR, { uri, diagnostics: [{ range: { start: { line: 0 } }, severity: 2, message: 'm' }] })).toEqual({
      path: 'docs/a.md', diagnostics: [{ file: 'docs/a.md', line: 1, severity: 'warning', rule: '', message: 'm' }],
    });
  });

  it('ignores a URI that is not a file', () => {
    expect(convertDiagnostics(DIR, { uri: 'untitled:1', diagnostics: [] })).toBeUndefined();
  });
});
