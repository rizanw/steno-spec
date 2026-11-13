// The steno language server, built as bin/lsp.js and loaded only by `steno lsp`. stdio transport only: no network module here.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createConnection, TextDocuments, TextDocumentSyncKind, type InitializeParams, type InitializeResult } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { PROTOCOL_VERSION } from '@steno/core';
import { createSession, NO_PROJECT, reload, type Session } from './session.js';
import { registerRequests } from './requests.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

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
  // resources to release when the process exits (the watcher, once there is one)
  const closers: (() => void)[] = [];
  process.on('exit', () => { for (const close of closers) close(); });

  conn.onInitialize((params): InitializeResult => {
    session = createSession(pickRoot(params));
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

  // text sync (the library reports an open as a content change too): every open, edit and close updates the open texts and reloads both snapshots
  const sync = (uri: string, text: string | undefined) => {
    const path = toPath(uri);
    if (!path) return;
    if (text === undefined) session.open.delete(path); else session.open.set(path, text);
    reload(session);
  };
  docs.onDidChangeContent(e => sync(e.document.uri, e.document.getText()));
  docs.onDidClose(e => sync(e.document.uri, undefined));

  registerRequests(conn, () => session);
  docs.listen(conn);
  conn.listen();
}
