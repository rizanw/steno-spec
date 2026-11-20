// The steno requests on top of the Language Server Protocol. Handlers are registered once and answer in every state.
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LSPErrorCodes, ResponseError, SymbolKind, type CodeLens, type Connection, type DocumentSymbol } from 'vscode-languageserver/node';
import {
  applyApprove, applyTaskChange, buildCtx, buildTree, check, diskSource, loadProject, outlineOf, parseTasks, PROTOCOL_VERSION, StenoError,
  STATE_FILE, toStructuredError, type ChangeResult, type DocKind, type OutlineItem, type Request, type SpecEntry, type SpecTree, type TaskPacket,
} from '@steno/core';
import { unsaved, type Session } from './session.js';
import { taskLenses } from './lens.js';

export const METHODS = {
  specTree: 'steno/specTree', taskPacket: 'steno/taskPacket',
  taskDone: 'steno/taskDone', taskReopen: 'steno/taskReopen', approve: 'steno/approve',
} as const;

const KIND_BY_FILE: Record<string, DocKind> = {
  'brief.md': 'brief', 'requirements.md': 'requirements', 'bugfix.md': 'bugfix', 'design.md': 'design', 'tasks.md': 'tasks',
};

/** What a path is in the editor snapshot: a spec document (with its Spec's entry when the folder is a Spec), a steering file, or nothing. */
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

/** The snapshot read from disk for one request, after `check` with the session's unsaved texts. A refusal throws. */
function checked(s: Session, req: Request) {
  // with no root the session stays on NO_PROJECT, which step 2 refuses with not-set-up
  const snap = s.root === undefined ? s.saved : loadProject(s.root, diskSource);
  return { snap, ...check(req, snap, { cli: false, unsaved: paths => unsaved(s, paths) }) };
}

/**
 * The task packet `steno ctx` builds for the task, from the files on disk. Steering files with unsaved edits and
 * Unreadable ones are left out and listed among the trimmed parts with the reason.
 */
export function taskPacket(s: Session, p: { spec?: string; task?: string; budget?: unknown }): TaskPacket {
  const { snap, entry } = checked(s, { kind: 'packet', spec: p.spec, task: p.task, budget: p.budget });
  const spec = (entry as Extract<SpecEntry, { spec: unknown }>).spec;
  const budget = p.budget === undefined || p.budget === null ? snap.config.ctxBudget : Number(p.budget);
  const steering = snap.steering.flatMap(e => (e.steering ? [e.steering] : []));
  const omit = snap.steering.flatMap(e => e.unreadable !== undefined ? [{ file: basename(e.file), reason: e.unreadable }]
    : unsaved(s, [e.file]) ? [{ file: basename(e.file), reason: 'unsaved edits' }] : []);
  const packet = buildCtx(spec, s.root!, p.task!, budget, { steering, omit });
  return { protocolVersion: PROTOCOL_VERSION, spec: entry.name, task: p.task!, ...packet };
}

/** Runs after a state change has been applied, with the files the change may have written. */
export type Changed = (written: string[]) => void;

/**
 * One state change, run synchronously to the end: load from disk, `check`, apply, then `changed` (reload and notice).
 * The library reads the next message only after this returns, so changes apply one at a time in order of arrival.
 */
export function applyChange(s: Session, req: Extract<Request, { kind: 'done' | 'reopen' | 'approve' }>, changed: Changed): ChangeResult {
  const { snap, entry } = checked(s, req);
  const dir = (entry as Extract<SpecEntry, { spec: unknown }>).spec.root;
  // no force: the server offers no equivalent of `steno approve --force`
  const r = req.kind === 'approve'
    ? applyApprove(snap, entry.name, req.phase!)
    : applyTaskChange(snap, entry.name, req.task!, req.kind === 'done');
  changed(req.kind === 'approve' ? [join(dir, STATE_FILE)] : [join(dir, 'tasks.md'), join(dir, STATE_FILE)]);
  return r;
}

/** Run a handler, returning a refusal as a protocol error that carries the structured error. */
function answer<T>(run: () => T): T {
  try { return run(); } catch (e) {
    if (e instanceof StenoError) throw failure(e);
    throw e;
  }
}

type Params = { spec?: string; task?: string; phase?: string; budget?: unknown } | null | undefined;

/** `changed` runs after a state change has been applied: it reloads the snapshots and sends the tree change notice. */
export function registerRequests(conn: Connection, session: () => Session, changed: Changed = () => {}): void {
  // never checked: the saved snapshot, an empty tree marked notSetUp when the project is not set up
  conn.onRequest(METHODS.specTree, (): SpecTree => buildTree(session().saved));
  conn.onDocumentSymbol(p => {
    const path = toPath(p.textDocument.uri);
    if (!path) return [];
    return answer(() => documentSymbols(session(), path));
  });
  conn.onRequest(METHODS.taskPacket, (p: Params) => answer(() => taskPacket(session(), p ?? {})));
  conn.onRequest(METHODS.taskDone, (p: Params) => answer(() => applyChange(session(), { kind: 'done', spec: p?.spec, task: p?.task }, changed)));
  conn.onRequest(METHODS.taskReopen, (p: Params) => answer(() => applyChange(session(), { kind: 'reopen', spec: p?.spec, task: p?.task }, changed)));
  conn.onRequest(METHODS.approve, (p: Params) => answer(() => applyChange(session(), { kind: 'approve', spec: p?.spec, phase: p?.phase }, changed)));
  conn.onCodeLens(p => {
    const path = toPath(p.textDocument.uri);
    return path ? codeLenses(session(), path) : [];
  });
}
