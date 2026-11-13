// The steno requests on top of the Language Server Protocol. Handlers are registered once and answer in every state.
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LSPErrorCodes, ResponseError, SymbolKind, type CodeLens, type Connection, type DocumentSymbol } from 'vscode-languageserver/node';
import { buildTree, diskSource, outlineOf, parseTasks, StenoError, toStructuredError, type DocKind, type OutlineItem, type SpecEntry, type SpecTree } from '@steno/core';
import type { Session } from './session.js';
import { taskLenses } from './lens.js';

export const METHODS = {
  specTree: 'steno/specTree', taskPacket: 'steno/taskPacket',
  taskDone: 'steno/taskDone', taskReopen: 'steno/taskReopen', approve: 'steno/approve',
} as const;

const KIND_BY_FILE: Record<string, DocKind> = {
  'brief.md': 'brief', 'requirements.md': 'requirements', 'bugfix.md': 'bugfix', 'design.md': 'design', 'tasks.md': 'tasks',
};

/** What a path is in the editor snapshot: a Spec_Document (with its Spec's entry when the folder is a Spec), a Steering_File, or nothing. */
export function documentAt(s: Session, path: string): { kind: DocKind; entry?: SpecEntry } | undefined {
  const snap = s.editor;
  if (s.root === undefined || !snap.setUp) return undefined;
  const specs = resolve(s.root, snap.config.specsDir), steering = resolve(s.root, snap.config.steeringDir);
  const kind = KIND_BY_FILE[basename(path)];
  if (kind && dirname(dirname(path)) === specs) return { kind, entry: snap.specs.find(e => e.name === basename(dirname(path))) };
  if (dirname(path) === steering && path.endsWith('.md')) return { kind: 'steering' };
  return undefined;
}

const toPath = (uri: string) => { try { return fileURLToPath(uri); } catch { return undefined; } };
const failure = (err: StenoError) => new ResponseError(LSPErrorCodes.RequestFailed, err.message, toStructuredError(err));

const SYMBOL_KIND: Record<OutlineItem['kind'], SymbolKind> = {
  requirement: SymbolKind.Module, criterion: SymbolKind.Property, section: SymbolKind.Namespace, task: SymbolKind.Event, heading: SymbolKind.String,
};

/** Each Outline item as a document symbol: the title as name, the ID as detail, `line` to `endLine` as range. */
function toSymbols(items: OutlineItem[], lines: string[]): DocumentSymbol[] {
  const width = (line: number) => (lines[line - 1] ?? '').length;
  return items.map(i => ({
    name: i.title || i.id || '(untitled)',
    detail: i.id,
    kind: SYMBOL_KIND[i.kind],
    range: { start: { line: i.line - 1, character: 0 }, end: { line: i.endLine - 1, character: width(i.endLine) } },
    selectionRange: { start: { line: i.line - 1, character: 0 }, end: { line: i.line - 1, character: width(i.line) } },
    children: toSymbols(i.children, lines),
  }));
}

/** The document's Outline as symbols, from its current text: the open text, else the saved file. */
export function documentSymbols(s: Session, path: string): DocumentSymbol[] {
  const doc = documentAt(s, path);
  if (!doc) return [];
  const open = s.open.get(path);
  const disk = open === undefined ? diskSource.read(path) : undefined;
  if (open === undefined && !disk) throw new StenoError('not-found', `${path} does not exist and is not open`, { file: path });
  if (doc.entry && !('spec' in doc.entry)) return [];
  const text = open ?? (disk && 'text' in disk ? disk.text : undefined);
  if (text === undefined) return [];
  return toSymbols(outlineOf(doc.kind, text), text.split(/\r?\n/));
}

/** The task lenses of an open tasks document of a usable Spec, from its open text. */
export function codeLenses(s: Session, path: string): CodeLens[] {
  const doc = documentAt(s, path);
  const text = s.open.get(path);
  if (doc?.kind !== 'tasks' || !doc.entry || !('spec' in doc.entry) || text === undefined) return [];
  return taskLenses(doc.entry.name, parseTasks(text)).map(l => ({
    range: { start: { line: l.line - 1, character: 0 }, end: { line: l.line - 1, character: 0 } },
    command: { title: l.title, command: l.command, arguments: [l.args] },
  }));
}

export function registerRequests(conn: Connection, session: () => Session): void {
  // never checked: the saved snapshot, an empty tree marked notSetUp when the project is not set up
  conn.onRequest(METHODS.specTree, (): SpecTree => buildTree(session().saved));
  conn.onDocumentSymbol(p => {
    const path = toPath(p.textDocument.uri);
    if (!path) return [];
    try { return documentSymbols(session(), path); } catch (e) {
      if (e instanceof StenoError) throw failure(e);
      throw e;
    }
  });
  conn.onCodeLens(p => {
    const path = toPath(p.textDocument.uri);
    return path ? codeLenses(session(), path) : [];
  });
}
