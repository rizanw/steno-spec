// One steno language server per folder: started on first use, restarted after a crash until core's RestartWindow says
// to give up, and shut down after a minute nobody looked at it. A host reads each server's state, last tree and
// diagnostics from here and hears of every change through `onChange`.
import type { Readable, Writable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { relative, sep } from 'node:path';
import { REQUESTS, RestartWindow, TREE_CHANGED, TreeFetcher } from '@steno/core/host';
import type { Diagnostic, SpecTree } from '@steno/core';
import { createMessageConnection, StreamMessageReader, StreamMessageWriter, type MessageConnection } from 'vscode-jsonrpc/node';
import { runProgram, type ProgramSource } from './programs.js';

const PUBLISH_DIAGNOSTICS = 'textDocument/publishDiagnostics';

/** The bundled language server's file name among a host's programs. */
const SERVER_PROGRAM = 'steno-lsp.mjs';

/** How long a server with no holder and no request keeps running. */
const IDLE_MS = 60_000;

export type ServerState = 'starting' | 'running' | 'stopped';

/** The part of a child process the pool uses, so a test can hand it a fake one. */
export interface ServerProcess {
  stdin: Writable | null;
  stdout: Readable | null;
  kill(): boolean;
  on(event: 'exit' | 'error', listener: (...args: unknown[]) => void): unknown;
}

/** Time as the pool sees it; tests pass a clock they move by hand. `after` returns its own cancel. */
export interface Clock { now(): number; after(ms: number, run: () => void): () => void }

const realClock: Clock = {
  now: () => Date.now(),
  after: (ms, run) => { const t = setTimeout(run, ms); t.unref?.(); return () => clearTimeout(t); },
};

/**
 * How the pool gets its servers: `source` starts the host's bundled server in the folder, with its stderr on the
 * host's own so crash messages land in the host's log; `start` replaces that, as tests do. With neither, every start
 * fails and the folder stops after five tries, as with any server that will not start.
 */
export interface PoolOptions {
  source?: ProgramSource;
  start?: (folder: string) => ServerProcess;
  clock?: Clock;
  idleMs?: number;
  log?: (line: string) => void;
}

interface LspDiagnostic { range: { start: { line: number } }; severity?: number; code?: string | number; message: string }

/**
 * A published diagnostics list as the folder-relative path it is for and core's diagnostics. The server sends whole
 * lines, 0-based; core counts from 1. Anything but an error is a warning, as steno reports nothing milder.
 * A URI that is not a file yields nothing.
 */
export function convertDiagnostics(folder: string, params: { uri: string; diagnostics: LspDiagnostic[] }):
  { path: string; diagnostics: Diagnostic[] } | undefined {
  let file: string;
  try { file = fileURLToPath(params.uri); } catch { return undefined; }
  const path = relative(folder, file).split(sep).join('/');
  return {
    path,
    diagnostics: params.diagnostics.map(d => ({
      file: path, line: d.range.start.line + 1, severity: d.severity === 1 ? 'error' : 'warning',
      rule: d.code === undefined ? '' : String(d.code), message: d.message,
    })),
  };
}

/** One folder's server as a host sees it. */
export interface FolderServer {
  readonly folder: string;
  readonly state: ServerState;
  /** the last tree the server answered with; kept across a crash, a restart and a stop */
  readonly tree?: SpecTree;
  /** folder-relative `/` path → that file's diagnostics; a file with none has no entry */
  readonly diagnostics: ReadonlyMap<string, Diagnostic[]>;
  /** Hear of every change to the state, the tree or the diagnostics. Returns the way to stop hearing. */
  onChange(listener: () => void): () => void;
  /** Keep the server alive while the folder is shown. Returns the release; the last release starts the idle wait. */
  hold(): () => void;
  /** Send a request once the server is running. A stopped server refuses at once. */
  request<R>(method: string, params?: unknown): Promise<R>;
  /** Resolves once there is a tree to draw or the server has stopped, whichever comes first. */
  settled(): Promise<void>;
}

interface PoolHost { options: Required<Omit<PoolOptions, 'source'>>; remove(server: Server): void }

class Server implements FolderServer {
  state: ServerState = 'starting';
  tree?: SpecTree;
  readonly diagnostics = new Map<string, Diagnostic[]>();
  private readonly restarts = new RestartWindow();
  private readonly listeners = new Set<() => void>();
  // one fetch at a time; an answer from a connection that has since gone is dropped in `load`
  private readonly fetcher = new TreeFetcher<SpecTree>(() => this.loadTree(), tree => { this.tree = tree; this.emit(); });
  private child?: ServerProcess;
  private connection?: MessageConnection;
  private started: Promise<void> = Promise.resolve();
  private holders = 0;
  private cancelIdle?: () => void;

  constructor(readonly folder: string, private readonly pool: PoolHost) {
    this.launch();
    this.armIdle();
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  hold(): () => void {
    this.holders++;
    this.cancelIdle?.();
    let held = true;
    return () => {
      if (!held) return;
      held = false;
      if (--this.holders === 0) this.armIdle();
    };
  }

  async request<R>(method: string, params?: unknown): Promise<R> {
    if (this.holders === 0) this.armIdle();
    if (this.state === 'stopped') throw new Error('the steno server is stopped');
    await this.started;
    if (!this.connection) throw new Error('the steno server is not running');
    return this.connection.sendRequest<R>(method, params);
  }

  settled(): Promise<void> {
    if (this.tree || this.state === 'stopped') return Promise.resolve();
    return new Promise(resolve => {
      const off = this.onChange(() => { if (this.tree || this.state === 'stopped') { off(); resolve(); } });
    });
  }

  /** Start again with a clean crash record: the user asked for it, so a stopped server runs again. */
  restart(): void {
    this.restarts.reset();
    this.halt();
    this.launch();
    if (this.holders === 0) this.armIdle();
  }

  /** Shut the server down for good; its exit is not a crash. */
  dispose(): void {
    this.cancelIdle?.();
    this.fetcher.dispose();
    const connection = this.connection;
    const child = this.child;
    this.child = undefined;
    this.connection = undefined;
    if (!connection || !child) return;
    // a polite shutdown first, so the server's own exit runs; a server that ignores it is killed a moment later
    const kill = this.pool.options.clock.after(2_000, () => child.kill());
    connection.sendRequest('shutdown').then(() => connection.sendNotification('exit')).catch(() => {}).finally(() => {
      kill();
      connection.dispose();
      child.kill();
    });
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener();
  }

  private launch(): void {
    this.state = 'starting';
    // the new server publishes every file's diagnostics again, so the old ones would only linger
    this.diagnostics.clear();
    this.emit();
    let child: ServerProcess;
    try {
      child = this.pool.options.start(this.folder);
    } catch (err) {
      this.pool.options.log(`steno: server for ${this.folder} could not start: ${err}`);
      this.crashed();
      return;
    }
    // writing to a server that just died raises an error on its stdin; the exit handler deals with the death
    child.stdin?.on('error', () => {});
    const connection = createMessageConnection(new StreamMessageReader(child.stdout!), new StreamMessageWriter(child.stdin!));
    connection.onError(() => {});
    connection.onNotification(TREE_CHANGED, () => this.fetcher.request());
    connection.onNotification(PUBLISH_DIAGNOSTICS, (params: { uri: string; diagnostics: LspDiagnostic[] }) => {
      if (this.connection !== connection) return;
      const converted = convertDiagnostics(this.folder, params);
      if (!converted) return;
      if (converted.diagnostics.length) this.diagnostics.set(converted.path, converted.diagnostics);
      else this.diagnostics.delete(converted.path);
      this.emit();
    });
    connection.listen();
    this.child = child;
    this.connection = connection;

    // exit and error can both fire for one death; only the first counts, and only for the current child
    let gone = false;
    const exited = () => {
      if (gone) return;
      gone = true;
      connection.dispose();
      if (this.child !== child) return;   // halted or disposed on purpose
      this.child = undefined;
      this.connection = undefined;
      this.crashed();
    };
    child.on('exit', exited);
    child.on('error', exited);

    // no file-watching capability: the server then watches `.steno/` itself, which a host without a watcher cannot do for it
    this.started = connection.sendRequest('initialize', {
      processId: process.pid, rootUri: pathToFileURL(this.folder).href, workspaceFolders: null, capabilities: {},
    }).then(() => {
      if (this.connection !== connection) return;
      // a server that dies here is handled by its exit; the failed write must not become an unhandled rejection
      connection.sendNotification('initialized', {}).catch(() => {});
      this.state = 'running';
      this.emit();
      this.fetcher.request();
    });
    this.started.catch(() => {});
  }

  /** The tree from the current server, or nothing when the connection changed while asking. */
  private async loadTree(): Promise<SpecTree | undefined> {
    const connection = this.connection;
    if (!connection) return undefined;
    const tree = await connection.sendRequest<SpecTree>(REQUESTS.specTree);
    return connection === this.connection ? tree : undefined;
  }

  /** Kill the current server without counting its exit as a crash. */
  private halt(): void {
    const child = this.child;
    this.connection?.dispose();
    this.child = undefined;
    this.connection = undefined;
    child?.kill();
  }

  private crashed(): void {
    if (this.restarts.record(this.pool.options.clock.now()) === 'restart') {
      this.pool.options.log(`steno: server for ${this.folder} exited, restarting it`);
      this.launch();
      return;
    }
    this.pool.options.log(`steno: server for ${this.folder} exited too often, stopped until it is restarted`);
    this.state = 'stopped';
    this.emit();
  }

  private armIdle(): void {
    this.cancelIdle?.();
    this.cancelIdle = this.pool.options.clock.after(this.pool.options.idleMs, () => {
      this.cancelIdle = undefined;
      if (this.holders > 0) return;
      // a stopped server stays, so the host can still say so; one still starting gets another wait
      if (this.state === 'stopped') return;
      if (this.state === 'starting') { this.armIdle(); return; }
      this.pool.remove(this);
      this.dispose();
    });
  }
}

export interface ServerPool {
  /** The folder's server, started if the pool has none. A stopped one is returned as it is, never revived. */
  serverFor(folder: string): FolderServer;
  /** Restart the folder's server with a clean crash record, or start one if the pool has none. */
  restart(folder: string): FolderServer;
  dispose(): void;
}

export function createPool(options: PoolOptions = {}): ServerPool {
  const { source, ...rest } = options;
  const start = (folder: string): ServerProcess => {
    if (!source) throw new Error('the pool was given no programs to start');
    return runProgram(source, SERVER_PROGRAM, [], { cwd: folder, stdio: ['pipe', 'pipe', 'inherit'] });
  };
  const servers = new Map<string, Server>();
  const host: PoolHost = {
    options: { start, clock: realClock, idleMs: IDLE_MS, log: (line: string) => console.log(line), ...rest },
    remove(server) { if (servers.get(server.folder) === server) servers.delete(server.folder); },
  };
  const serverFor = (folder: string) => {
    let server = servers.get(folder);
    if (!server) { server = new Server(folder, host); servers.set(folder, server); }
    return server;
  };
  return {
    serverFor,
    restart(folder) {
      const server = servers.get(folder);
      if (!server) return serverFor(folder);
      server.restart();
      return server;
    },
    dispose() {
      for (const server of servers.values()) server.dispose();
      servers.clear();
    },
  };
}
