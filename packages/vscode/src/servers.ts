// One bundled server per workspace folder: started when the folder opens, stopped when it closes.
// Every folder gets one, steno project or not, because the server is what reports a folder becoming one.
import * as vscode from 'vscode';
import {
  CloseAction, ErrorAction, LanguageClient, TransportKind,
  type ErrorHandler, type LanguageClientOptions, type ServerOptions,
} from 'vscode-languageclient/node';
import { METHODS, TREE_CHANGED, type SpecTree } from './protocol.js';
import { MAX_EXITS, RestartWindow, WINDOW_MS } from './restart.js';
import { runnable } from './tree.js';

/** The part of `LanguageClient` the pool uses, so a test can pass a fake in its place. */
export interface StenoClient {
  start(): Promise<void>;
  stop(): Promise<void>;
  sendRequest<T>(method: string, param?: unknown): Promise<T>;
  /** the server's own notices; registered once the client is running */
  onNotification(method: string, handler: (params: unknown) => void): vscode.Disposable;
}

/**
 * One folder's tree fetches, with at most one request in flight. Notices that arrive during a
 * fetch collapse into exactly one more, so the last notice is always served and a noisy server cannot
 * queue up work. A failed fetch leaves the folder's last tree in place.
 */
export class Refresher {
  private running = false;
  private queued = false;

  constructor(
    // not named `fetch`: the manifest test bans that call shape outright, to keep the extension offline
    private readonly load: () => Promise<SpecTree>,
    private readonly apply: (tree: SpecTree) => void,
  ) {}

  /** Ask for the tree, or mark that one more fetch is owed once the one in flight finishes. */
  request(): void {
    if (this.running) { this.queued = true; return; }
    void this.run();
  }

  private async run(): Promise<void> {
    this.running = true;
    try {
      do {
        this.queued = false;
        // an answer that is not a tree counts as a failed fetch: the folder keeps the last one it had
        try { const tree = await this.load(); if (tree) this.apply(tree); } catch { /* keep the last tree */ }
      } while (this.queued);
    } finally {
      this.running = false;
    }
  }
}

export interface FolderServer {
  folder: vscode.WorkspaceFolder;
  client: StenoClient;
  state: 'running' | 'stopped';
  /** the last spec tree this folder's server answered with; absent until the first answer */
  tree?: SpecTree;
  /** this folder's unexpected exits, which decide whether the next one is restarted */
  restarts: RestartWindow;
  /** this folder's tree fetches, one in flight at a time */
  refresher: Refresher;
}

/** What the pool asks the library to do when a server fails, built per folder. */
export interface ClientHandlers {
  errorHandler: ErrorHandler;
  /** `true` asks the library to try the start again */
  initializationFailedHandler: (error: unknown) => boolean;
  /** whether the folder's tree offers "Run" on this task, so the run lens can follow it */
  runnable: (spec: string, task: string) => boolean;
}

/** Builds the client for one folder. Production calls `new LanguageClient`; tests pass a fake. */
export type CreateClient = (
  folder: vscode.WorkspaceFolder,
  serverPath: string,
  selector: vscode.DocumentFilter[],
  handlers: ClientHandlers,
) => StenoClient;

/** Markdown and YAML under this folder alone, so an open document reaches only its own folder's server. */
export function selectorFor(folder: vscode.WorkspaceFolder): vscode.DocumentFilter[] {
  const pattern = new vscode.RelativePattern(folder, '**/*.{md,yaml}');
  return [
    { scheme: 'file', language: 'markdown', pattern },
    { scheme: 'file', language: 'yaml', pattern },
  ];
}

/** The lens the server puts on an open task; choosing it hands the task to the coding agent. */
const RUN_LENS = 'steno.task.run';

/** The lens the server puts on a done task; choosing it reopens the task. */
const DONE_LENS = 'steno.task.done';

/** The part of a code lens the middleware reads and rewrites. */
interface Lens { command?: { command: string; title: string; arguments?: unknown[] } }
type Lenses<T extends Lens> = T[] | null | undefined;

/**
 * Keep only the lenses this extension handles, and give each of them the document's URI so its handler can find
 * the folder's server. The run lens stays only where `runnable` says the tree offers "Run" too: an open task
 * without subtasks of a Spec in `execute`. A lens with no command is kept as is.
 */
export function keepLenses<T extends Lens>(
  uri: vscode.Uri,
  lenses: Lenses<T>,
  runnable: (spec: string, task: string) => boolean,
): Lenses<T> {
  if (!lenses) return lenses;
  return lenses.filter(lens => {
    if (lens.command?.command !== RUN_LENS) return true;
    const [args] = lens.command.arguments ?? [];
    const { spec, task } = (args ?? {}) as { spec?: unknown; task?: unknown };
    return typeof spec === 'string' && typeof task === 'string' && runnable(spec, task);
  }).map(lens => {
    if (lens.command?.command !== DONE_LENS && lens.command?.command !== RUN_LENS) return lens;
    const [args] = lens.command.arguments ?? [];
    lens.command = { ...lens.command, arguments: [{ ...(args as object), uri }] };
    return lens;
  });
}

/** The client middleware that runs every lens answer through `keepLenses`. */
export async function provideCodeLenses<T extends Lens>(
  document: { uri: vscode.Uri },
  token: unknown,
  next: (document: any, token: any) => Lenses<T> | PromiseLike<Lenses<T>>,
  runnable: (spec: string, task: string) => boolean,
): Promise<Lenses<T>> {
  return keepLenses(document.uri, await next(document, token), runnable);
}

/** The production factory: a `module` server, which the library runs on the editor's own Node. */
const createLanguageClient: CreateClient = (folder, serverPath, documentSelector, handlers) => {
  const server: ServerOptions = {
    run: { module: serverPath, transport: TransportKind.stdio },
    debug: { module: serverPath, transport: TransportKind.stdio },
  };
  // the library's own `DocumentSelector` type does not admit a `vscode.RelativePattern`, which it accepts at run time
  const options: LanguageClientOptions = {
    documentSelector: documentSelector as LanguageClientOptions['documentSelector'],
    workspaceFolder: folder,
    errorHandler: handlers.errorHandler,
    initializationFailedHandler: handlers.initializationFailedHandler,
    // typed loosely so the stubbed library in the unit tests accepts it too
    middleware: {
      provideCodeLenses: (document: { uri: vscode.Uri }, token: unknown, next: Parameters<typeof provideCodeLenses>[2]) =>
        provideCodeLenses(document, token, next, handlers.runnable),
    } as unknown as LanguageClientOptions['middleware'],
  };
  return new LanguageClient('steno', `steno: ${folder.name}`, server, options) as unknown as StenoClient;
};

export class ServerPool implements vscode.Disposable {
  private readonly servers = new Map<string, FolderServer>();
  private readonly changed = new vscode.EventEmitter<FolderServer>();
  /** one `steno/treeChanged` subscription per folder, replaced on a restart and dropped on a stop */
  private readonly notices = new Map<string, vscode.Disposable>();
  /** a server's state or tree changed */
  readonly onDidChange = this.changed.event;

  constructor(
    private readonly serverPath: string,
    private readonly create: CreateClient = createLanguageClient,
  ) {}

  /** Every folder that has a server, in the order they were started. */
  all(): FolderServer[] { return [...this.servers.values()]; }

  /** Start this folder's server. A folder with a non-`file` scheme gets none, and a second call is a no-op. */
  async start(folder: vscode.WorkspaceFolder): Promise<void> {
    const key = folder.uri.toString();
    if (folder.uri.scheme !== 'file' || this.servers.has(key)) return;
    const server = { folder, state: 'running', restarts: new RestartWindow() } as FolderServer;
    server.client = this.create(folder, this.serverPath, selectorFor(folder), this.handlersFor(server));
    server.refresher = new Refresher(
      () => server.client.sendRequest<SpecTree>(METHODS.specTree),
      tree => this.setTree(server, tree),
    );
    this.servers.set(key, server);
    await server.client.start();
    this.listen(server);
    this.changed.fire(server);
  }

  /** Stop this folder's server and forget it. */
  async stop(folder: vscode.WorkspaceFolder): Promise<void> {
    const key = folder.uri.toString();
    const server = this.servers.get(key);
    if (!server) return;
    this.servers.delete(key);
    this.notices.get(key)?.dispose();
    this.notices.delete(key);
    server.state = 'stopped';
    await server.client.stop().catch(() => {});
    this.changed.fire(server);
  }

  /** The server of the folder that holds this file: the longest folder path the file sits under. */
  get(uri: vscode.Uri): FolderServer | undefined {
    if (uri.scheme !== 'file') return undefined;
    let best: FolderServer | undefined;
    for (const server of this.servers.values()) {
      const root = server.folder.uri.fsPath.replace(/[\\/]+$/, '');
      if (uri.fsPath !== root && !uri.fsPath.startsWith(root + '/') && !uri.fsPath.startsWith(root + '\\')) continue;
      if (!best || root.length > best.folder.uri.fsPath.replace(/[\\/]+$/, '').length) best = server;
    }
    return best;
  }

  /**
   * The handlers for one folder's client. The library calls `closed()` only for an exit it did not ask for,
   * so every call is an unexpected exit; a failed start never reaches it and arrives at the other handler.
   */
  private handlersFor(server: FolderServer): ClientHandlers {
    const decide = () => {
      const verdict = server.restarts.record(Date.now());
      if (verdict === 'stop') this.giveUp(server);
      return verdict;
    };
    return {
      errorHandler: {
        // a protocol error is not an exit: the server is still there, so keep going
        error: () => ({ action: ErrorAction.Continue }),
        closed: () => ({ action: decide() === 'stop' ? CloseAction.DoNotRestart : CloseAction.Restart }),
      },
      initializationFailedHandler: () => decide() === 'restart',
      // read the tree at the moment the editor asks for lenses, so a later tree is seen without a new client
      runnable: (spec, task) => runnable(server.tree, spec, task),
    };
  }

  /** Too many exits: stop restarting, show the folder's name and offer the way back. */
  private giveUp(server: FolderServer): void {
    server.state = 'stopped';
    this.changed.fire(server);
    const minutes = WINDOW_MS / 60_000;
    const message = `steno server for ${server.folder.name} stopped after ${MAX_EXITS} exits in ${minutes} minutes`;
    void Promise.resolve(vscode.window.showErrorMessage(message, 'Restart')).then(choice => {
      if (choice === 'Restart') return this.restart(server);
      return undefined;
    });
  }

  /**
   * Follow this server's notices and ask for its first tree. Every running client gets this: after a
   * start and after a restart, since the restarted server has forgotten what it told us.
   */
  private listen(server: FolderServer): void {
    this.notices.get(server.folder.uri.toString())?.dispose();
    this.notices.set(
      server.folder.uri.toString(),
      server.client.onNotification(TREE_CHANGED, () => server.refresher.request()),
    );
    server.refresher.request();
  }

  /** Start a stopped server again with a clean record, from the error or from the tree. */
  async restart(server: FolderServer): Promise<void> {
    server.restarts.reset();
    server.state = 'running';
    this.changed.fire(server);
    await server.client.start();
    this.listen(server);
  }

  /** Store a folder's latest tree and tell listeners. */
  setTree(server: FolderServer, tree: SpecTree): void {
    server.tree = tree;
    this.changed.fire(server);
  }

  /** Stop every server; the window is closing or the extension is deactivating. */
  async dispose(): Promise<void> {
    await Promise.all(this.all().map(s => this.stop(s.folder)));
    this.changed.dispose();
  }
}

/** Start a server for every open `file` folder, and follow folders added and removed afterwards. */
export function trackFolders(pool: ServerPool): vscode.Disposable {
  for (const folder of vscode.workspace.workspaceFolders ?? []) void pool.start(folder);
  return vscode.workspace.onDidChangeWorkspaceFolders(e => {
    for (const folder of e.added) void pool.start(folder);
    for (const folder of e.removed) void pool.stop(folder);
  });
}
