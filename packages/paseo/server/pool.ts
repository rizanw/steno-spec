// One steno language server per workspace directory: started on first use, restarted after a crash until core's
// RestartWindow says to give up, and shut down after a minute nobody looked at it. The panel reads each server's
// last tree and diagnostics from here and hears of every change through `onChange`.
import type { Readable, Writable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { relative, sep } from 'node:path';
import {
  createMessageConnection, RestartWindow, StreamMessageReader, StreamMessageWriter,
  type Diagnostic, type MessageConnection, type SpecTree,
} from './vendor/host.mjs';
import type { ServerState } from '../shared/contracts';
import { runProgram } from './programs';

export const SPEC_TREE = 'steno/specTree';
export const TREE_CHANGED = 'steno/treeChanged';
const PUBLISH_DIAGNOSTICS = 'textDocument/publishDiagnostics';

/** How long a server with no subscriber and no request keeps running. */
export const IDLE_MS = 60_000;

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
 * The bundled server, started in the workspace directory. Its stderr goes to the plugin's own, so its crash
 * messages land in `paseo plugin logs`.
 */
function startBundled(directory: string): ServerProcess {
  return runProgram('steno-lsp.mjs', [], { cwd: directory, stdio: ['pipe', 'pipe', 'inherit'] });
}

export interface PoolOptions {
  start?: (directory: string) => ServerProcess;
  clock?: Clock;
  idleMs?: number;
  log?: (line: string) => void;
}

interface LspDiagnostic { range: { start: { line: number } }; severity?: number; code?: string | number; message: string }

/**
 * A published diagnostics list as the workspace path it is for and core's diagnostics. The server sends whole
 * lines, 0-based; core counts from 1. Anything but an error is a warning, as steno reports nothing milder.
 * A URI that is not a file yields nothing.
 */
export function convertDiagnostics(directory: string, params: { uri: string; diagnostics: LspDiagnostic[] }):
  { path: string; diagnostics: Diagnostic[] } | undefined {
  let file: string;
  try { file = fileURLToPath(params.uri); } catch { return undefined; }
  const path = relative(directory, file).split(sep).join('/');
  return {
    path,
    diagnostics: params.diagnostics.map(d => ({
      file: path, line: d.range.start.line + 1, severity: d.severity === 1 ? 'error' : 'warning',
      rule: d.code === undefined ? '' : String(d.code), message: d.message,
    })),
  };
}

export class FolderServer {
  state: ServerState = 'starting';
  /** the last tree the server answered with; kept across a restart until the new server answers */
  tree?: SpecTree;
  /** workspace path → that file's diagnostics; a file with none has no entry */
  readonly diagnostics = new Map<string, Diagnostic[]>();
  private readonly restarts = new RestartWindow();
  private readonly listeners = new Set<() => void>();
  private child?: ServerProcess;
  private connection?: MessageConnection;
  private started: Promise<void> = Promise.resolve();
  private loading = false;
  private owed = false;
  private subscribers = 0;
  private cancelIdle?: () => void;

  constructor(readonly directory: string, private readonly pool: { options: Required<PoolOptions>; remove(server: FolderServer): void }) {
    this.launch();
    this.armIdle();
  }

  /** Hear of every change to the state, the tree or the diagnostics. Returns the way to stop hearing. */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** Keep the server alive while a subscriber looks at it. Returns the release; the last release starts the idle wait. */
  hold(): () => void {
    this.subscribers++;
    this.cancelIdle?.();
    let held = true;
    return () => {
      if (!held) return;
      held = false;
      if (--this.subscribers === 0) this.armIdle();
    };
  }

  /** Send a request once the server is running. A stopped server refuses at once. */
  async request<R>(method: string, params?: unknown): Promise<R> {
    if (this.subscribers === 0) this.armIdle();
    if (this.state === 'stopped') throw new Error('the steno server is stopped');
    await this.started;
    if (!this.connection) throw new Error('the steno server is not running');
    return this.connection.sendRequest<R>(method, params);
  }

  /** Resolves once there is a tree to draw or the server has stopped, whichever comes first. */
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
    if (this.subscribers === 0) this.armIdle();
  }

  /** Shut the server down for good; its exit is not a crash. */
  dispose(): void {
    this.cancelIdle?.();
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
      child = this.pool.options.start(this.directory);
    } catch (err) {
      this.pool.options.log(`steno: server for ${this.directory} could not start: ${err}`);
      this.crashed();
      return;
    }
    // writing to a server that just died raises an error on its stdin; the exit handler deals with the death
    child.stdin?.on('error', () => {});
    const connection = createMessageConnection(new StreamMessageReader(child.stdout!), new StreamMessageWriter(child.stdin!));
    connection.onError(() => {});
    connection.onNotification(TREE_CHANGED, () => void this.loadTree());
    connection.onNotification(PUBLISH_DIAGNOSTICS, (params: { uri: string; diagnostics: LspDiagnostic[] }) => {
      if (this.connection !== connection) return;
      const converted = convertDiagnostics(this.directory, params);
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

    // no file-watching capability: the server then watches `.steno/` itself, which a Paseo host cannot do for it
    this.started = connection.sendRequest('initialize', {
      processId: process.pid, rootUri: pathToFileURL(this.directory).href, workspaceFolders: null, capabilities: {},
    }).then(() => {
      if (this.connection !== connection) return;
      // a server that dies here is handled by its exit; the failed write must not become an unhandled rejection
      connection.sendNotification('initialized', {}).catch(() => {});
      this.state = 'running';
      this.emit();
      void this.loadTree();
    });
    this.started.catch(() => {});
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
      this.pool.options.log(`steno: server for ${this.directory} exited, restarting it`);
      this.launch();
      return;
    }
    this.pool.options.log(`steno: server for ${this.directory} exited too often, stopped until Restart steno Server`);
    this.state = 'stopped';
    this.emit();
  }

  /** Fetch the tree with at most one request in flight; notices during a fetch collapse into one more. */
  private async loadTree(): Promise<void> {
    if (this.loading) { this.owed = true; return; }
    this.loading = true;
    try {
      do {
        this.owed = false;
        const connection = this.connection;
        if (!connection) break;
        // a failed fetch keeps the last tree
        try {
          const tree = await connection.sendRequest<SpecTree>(SPEC_TREE);
          if (tree && connection === this.connection) { this.tree = tree; this.emit(); }
        } catch { /* keep the last tree */ }
      } while (this.owed);
    } finally {
      this.loading = false;
    }
  }

  private armIdle(): void {
    this.cancelIdle?.();
    this.cancelIdle = this.pool.options.clock.after(this.pool.options.idleMs, () => {
      this.cancelIdle = undefined;
      if (this.subscribers > 0) return;
      // a stopped server stays, so the panel can still say so; one still starting gets another minute
      if (this.state === 'stopped') return;
      if (this.state === 'starting') { this.armIdle(); return; }
      this.pool.remove(this);
      this.dispose();
    });
  }
}

export interface ServerPool {
  /** The directory's server, started if the pool has none. A stopped one is returned as it is, never revived. */
  serverFor(directory: string): FolderServer;
  /** Restart the directory's server with a clean crash record, or start one if the pool has none. */
  restart(directory: string): FolderServer;
  dispose(): void;
}

export function createPool(options: PoolOptions = {}): ServerPool {
  const servers = new Map<string, FolderServer>();
  const host = {
    options: { start: startBundled, clock: realClock, idleMs: IDLE_MS, log: (line: string) => console.log(line), ...options },
    remove(server: FolderServer) { if (servers.get(server.directory) === server) servers.delete(server.directory); },
  };
  const serverFor = (directory: string) => {
    let server = servers.get(directory);
    if (!server) { server = new FolderServer(directory, host); servers.set(directory, server); }
    return server;
  };
  return {
    serverFor,
    restart(directory) {
      const server = servers.get(directory);
      if (!server) return serverFor(directory);
      server.restart();
      return server;
    },
    dispose() {
      for (const server of servers.values()) server.dispose();
      servers.clear();
    },
  };
}
