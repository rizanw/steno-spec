// The steno language server, built as bin/lsp.js and loaded only by `steno lsp`. stdio transport only: no network module here.
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConnection, TextDocuments, TextDocumentSyncKind, type InitializeParams, type InitializeResult } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { PROTOCOL_VERSION, projectDiagnostics } from '@steno/core';
import { createReloadTimer, createSession, NO_PROJECT, reload, type ReloadCause, type Session } from './session.js';
import { registerRequests } from './requests.js';
import { createPublisher, toLspDiagnostic, type Publisher } from './publish.js';
import { watchKey, watchProject, type Watcher } from './watch.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

export const TREE_CHANGED = 'steno/treeChanged';

/** The folder to serve: the first workspace folder, else `rootUri`; other folders are ignored. Only `file:` URIs count. */
export function pickRoot(p: Pick<InitializeParams, 'workspaceFolders' | 'rootUri'>): string | undefined {
  const uri = p.workspaceFolders?.[0]?.uri ?? p.rootUri ?? undefined;
  return uri ? toPath(uri) : undefined;
}

function toPath(uri: string): string | undefined {
  try { return fileURLToPath(uri); } catch { return undefined; }
}

export function startServer(input: NodeJS.ReadableStream, output: NodeJS.WritableStream): void {
  // the library exits the process on `exit`, when the input ends or closes, and when the parent process is gone
  const conn = createConnection(input, output);
  const docs = new TextDocuments(TextDocument);
  let session: Session = { open: new Map(), saved: NO_PROJECT, editor: NO_PROJECT };
  let publisher: Publisher | undefined;
  let watcher: Watcher | undefined;
  let watchedKey = '';
  let clientWatches = false;
  // resources to release when the process exits
  const closers: (() => void)[] = [() => watcher?.close(), () => timer.dispose()];
  process.on('exit', () => { for (const close of closers) close(); });

  // the files the server's own state changes wrote, with the bytes written: their watcher events are echoes, already
  // reloaded and noticed, and are dropped until the file holds something else
  const own = new Map<string, string>();
  const read = (path: string) => { try { return readFileSync(path, 'latin1'); } catch { return undefined; } };
  // the folders holding those files, with their entry names: Windows also reports the folder of a replaced file, an echo
  // too while the folder lists the same entries
  const ownDirs = new Map<string, string>();
  const list = (dir: string) => { try { return readdirSync(dir).sort().join('\n'); } catch { return undefined; } };
  const TEMP = /\.steno-\d+\.tmp$/;
  const onWatch = (paths: string[]) => {
    const foreign = paths.filter(p => {
      if (TEMP.test(p)) return false;
      const entries = ownDirs.get(p);
      if (entries !== undefined) {
        if (list(p) === entries) return false;
        ownDirs.delete(p);
        return true;
      }
      const mine = own.get(p);
      if (mine === undefined) return true;
      if (read(p) === mine) return false;
      own.delete(p);
      return true;
    });
    if (foreign.length) timer.request('event');
  };

  const rewatch = () => {
    const key = watchKey(session, clientWatches);
    if (watcher && key === watchedKey) return;
    watcher?.close();
    watchedKey = key;
    watcher = watchProject(conn, session, onWatch, clientWatches);
  };

  // one reload serves every pending edit and watcher event; the notice follows any reload that served an event or flipped set-up
  const timer = createReloadTimer((served: Set<ReloadCause>) => {
    if (session.root === undefined) return;
    const flipped = reload(session);
    publisher?.sync(projectDiagnostics(session.editor));
    if (served.has('event') || flipped.becameSetUp || flipped.becameNotSetUp) {
      rewatch();
      void conn.sendNotification(TREE_CHANGED);
    }
  });

  conn.onInitialize((params): InitializeResult => {
    session = createSession(pickRoot(params));
    clientWatches = params.capabilities.workspace?.didChangeWatchedFiles?.dynamicRegistration === true;
    return {
      serverInfo: { name: 'steno', version },
      capabilities: {
        textDocumentSync: { openClose: true, change: TextDocumentSyncKind.Incremental },
        documentSymbolProvider: true,
        codeLensProvider: { resolveProvider: false },
        experimental: { steno: { protocolVersion: PROTOCOL_VERSION } },
      },
    };
  });

  // serving begins: every file's Diagnostics, open or not, then the watcher. With no usable root there is neither.
  conn.onInitialized(() => {
    if (session.root === undefined) return;
    publisher = createPublisher((uri, items) => void conn.sendDiagnostics({ uri, diagnostics: items.map(toLspDiagnostic) }), session.root);
    publisher.sync(projectDiagnostics(session.editor));
    rewatch();
  });

  // text sync (the library reports an open as a content change too): every open, edit and close updates the open texts
  // at once, so requests see the current text, and asks for a reload
  const sync = (uri: string, text: string | undefined) => {
    const path = toPath(uri);
    if (!path) return;
    if (text === undefined) session.open.delete(path); else session.open.set(path, text);
    timer.request('edit');
  };
  docs.onDidChangeContent(e => sync(e.document.uri, e.document.getText()));
  docs.onDidClose(e => sync(e.document.uri, undefined));

  // a state change the server applied: reload, publish and send the notice at once, with no wait
  const changed = (written: string[]) => {
    for (const path of written) { const bytes = read(path); if (bytes === undefined) own.delete(path); else own.set(path, bytes); }
    for (const dir of new Set(written.map(p => dirname(p)))) { const entries = list(dir); if (entries === undefined) ownDirs.delete(dir); else ownDirs.set(dir, entries); }
    reload(session);
    publisher?.sync(projectDiagnostics(session.editor));
    rewatch();
    void conn.sendNotification(TREE_CHANGED);
  };
  registerRequests(conn, () => session, changed);
  docs.listen(conn);
  conn.listen();
}
