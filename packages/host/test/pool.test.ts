// One language server per folder: started, restarted after crashes, stopped after too many, shut down when idle.
import { EventEmitter } from 'node:events';
import { join, resolve } from 'node:path';
import { PassThrough } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createMessageConnection, StreamMessageReader, StreamMessageWriter, type MessageConnection } from 'vscode-jsonrpc/node';
import { REQUESTS, TREE_CHANGED } from '@steno/core/host';
import type { SpecTree } from '@steno/core';
import { convertDiagnostics, createPool, type Clock, type ServerPool } from '../src/pool.js';

const SPEC_TREE = REQUESTS.specTree;

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
  it('starts one server per folder with the folder as root and no watching of its own', async () => {
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

  it('keeps diagnostics by folder-relative path, 1-based, and drops a file whose list empties', async () => {
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

  it('applies no tree that arrives after the pool was disposed', async () => {
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
    pool.dispose();
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

  it('shuts a server down after a minute with no holder or request, and starts a fresh one on next use', async () => {
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

  it('keeps the last tree through a crash and a stop', async () => {
    setUp();
    const server = pool.serverFor(DIR);
    await server.settled();
    for (let i = 0; i < 5; i++) started[i].crash();
    expect(server.state).toBe('stopped');
    expect(server.tree!.specs[0].name).toBe('v1');
  });

  it('counts a server that will not start as an exit, and stops after the fifth', () => {
    let tries = 0;
    pool = createPool({ start: () => { tries++; throw new Error('ENOENT'); }, clock: new FakeClock(), log: () => {} });
    const server = pool.serverFor(DIR);
    expect(tries).toBe(5);
    expect(server.state).toBe('stopped');
  });

  it('stops a folder at once when given no programs to start', () => {
    pool = createPool({ clock: new FakeClock(), log: () => {} });
    expect(pool.serverFor(DIR).state).toBe('stopped');
  });
});

describe('the pool for any sequence of events', () => {
  const MINUTE = 60_000;

  it('stops a folder exactly on the fifth exit within three minutes of its last start, and starts nothing while stopped', () => {
    const step = fc.oneof(
      fc.record({ kind: fc.constant('crash' as const), dt: fc.integer({ min: 0, max: 2 * MINUTE }) }),
      fc.record({ kind: fc.constant('restart' as const), dt: fc.integer({ min: 0, max: 2 * MINUTE }) }),
      fc.record({ kind: fc.constant('ask' as const), dt: fc.integer({ min: 0, max: 2 * MINUTE }) }),
    );
    fc.assert(fc.property(fc.array(step, { maxLength: 25 }), steps => {
      setUp();
      try {
        const server = pool.serverFor(DIR);
        server.hold();
        // the model: exits since the last start or restart that still fall inside the window
        let exits: number[] = [];
        let stopped = false;
        let starts = 1;
        for (const { kind, dt } of steps) {
          clock.advance(dt);
          if (kind === 'crash') {
            if (stopped) continue;    // no server runs, so none can exit
            started[started.length - 1].crash();
            exits = [...exits.filter(t => clock.time - t < 3 * MINUTE), clock.time];
            if (exits.length >= 5) stopped = true; else starts++;
          } else if (kind === 'restart') {
            expect(pool.restart(DIR)).toBe(server);
            exits = [];
            stopped = false;
            starts++;
          } else {
            expect(pool.serverFor(DIR)).toBe(server);
          }
          expect(server.state === 'stopped').toBe(stopped);
          expect(started).toHaveLength(starts);
        }
      } finally {
        pool.dispose();
      }
    }), { numRuns: 150 });
  });

  it('shuts a server down only after the idle time with no holder and no request, never marking it stopped', async () => {
    const step = fc.oneof(
      fc.constant({ kind: 'hold' as const }), fc.constant({ kind: 'release' as const }), fc.constant({ kind: 'request' as const }),
      fc.record({ kind: fc.constant('advance' as const), dt: fc.integer({ min: 0, max: 90_000 }) }),
    );
    await fc.assert(fc.asyncProperty(fc.array(step, { maxLength: 20 }), async steps => {
      setUp();
      try {
        const server = pool.serverFor(DIR);
        await server.settled();
        // the model: when the idle wait last began, if it is running, and how many holds are open
        let armedAt: number | undefined = 0;
        const holds: (() => void)[] = [];
        let shutDown = false;
        for (const s of steps) {
          if (s.kind === 'hold') { holds.push(server.hold()); armedAt = undefined; }
          else if (s.kind === 'release') { const release = holds.pop(); if (release) { release(); if (holds.length === 0) armedAt = clock.time; } }
          else if (s.kind === 'request') { server.request(SPEC_TREE).catch(() => {}); if (holds.length === 0) armedAt = clock.time; }
          else {
            clock.advance(s.dt);
            if (!shutDown && holds.length === 0 && armedAt !== undefined && clock.time >= armedAt + 60_000) shutDown = true;
          }
          expect(server.state).not.toBe('stopped');
        }
        expect(pool.serverFor(DIR) === server).toBe(!shutDown);
      } finally {
        pool.dispose();
      }
    }), { numRuns: 100 });
  });
});

describe('diagnostic conversion', () => {
  it('turns a warning into a folder-relative path with forward slashes', () => {
    const uri = pathToFileURL(join(DIR, 'docs', 'a.md')).href;
    expect(convertDiagnostics(DIR, { uri, diagnostics: [{ range: { start: { line: 0 } }, severity: 2, message: 'm' }] })).toEqual({
      path: 'docs/a.md', diagnostics: [{ file: 'docs/a.md', line: 1, severity: 'warning', rule: '', message: 'm' }],
    });
  });

  it('ignores a URI that is not a file', () => {
    expect(convertDiagnostics(DIR, { uri: 'untitled:1', diagnostics: [] })).toBeUndefined();
  });
});
