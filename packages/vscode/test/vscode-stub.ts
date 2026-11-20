// A small stand-in for the `vscode` module, aliased in vitest.config.ts so unit tests can import the
// extension's own modules. It carries only what those modules touch; grow it with them. Anything the
// extension host would do (showing a message, running a command) is recorded, not performed.

export class Uri {
  private constructor(readonly scheme: string, readonly path: string) {}
  static file(path: string): Uri { return new Uri('file', path); }
  static parse(value: string): Uri {
    const m = /^([a-z][a-z0-9+.-]*):\/\/?(.*)$/i.exec(value);
    return m ? new Uri(m[1], m[2]) : Uri.file(value);
  }
  static joinPath(base: Uri, ...parts: string[]): Uri {
    return new Uri(base.scheme, [base.path.replace(/\/$/, ''), ...parts].join('/'));
  }
  get fsPath(): string { return this.path; }
  toString(): string { return `${this.scheme}://${this.path}`; }
}

export class Position {
  constructor(readonly line: number, readonly character: number) {}
}
export class Range {
  constructor(readonly start: Position, readonly end: Position) {}
}

export class EventEmitter<T> {
  private listeners = new Set<(e: T) => unknown>();
  readonly event = (listener: (e: T) => unknown) => {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  };
  fire(e: T): void { for (const l of [...this.listeners]) l(e); }
  dispose(): void { this.listeners.clear(); }
}

export enum ExtensionMode { Production = 1, Development = 2, Test = 3 }

export enum TreeItemCollapsibleState { None = 0, Collapsed = 1, Expanded = 2 }

export class ThemeIcon {
  constructor(readonly id: string) {}
}

export class TreeItem {
  label?: string;
  description?: string | boolean;
  tooltip?: string;
  iconPath?: ThemeIcon;
  contextValue?: string;
  resourceUri?: Uri;
  command?: { command: string; title: string; arguments?: unknown[] };
  constructor(label: string, public collapsibleState: TreeItemCollapsibleState = TreeItemCollapsibleState.None) {
    this.label = label;
  }
}

/** The shape `window.registerTreeDataProvider` accepts; structural, as the real API is. */
export interface TreeDataProvider<T> {
  readonly onDidChangeTreeData?: (listener: (e: T | undefined) => unknown) => Disposable;
  getTreeItem(element: T): TreeItem | Promise<TreeItem>;
  getChildren(element?: T): T[] | undefined | Promise<T[] | undefined>;
}

/** Everything the stub was asked to show or run, for a test to assert on. */
export const recorded: {
  info: string[]; warning: string[]; error: string[];
  commands: { command: string; args: unknown[] }[];
  context: Record<string, unknown>;
  /** the documents `showTextDocument` was asked to open, and the line the selection landed on */
  opened: { uri: string; line: number }[];
  /** the tree data providers registered, by view id */
  views: Record<string, unknown>;
  /** the messages shown as modal dialogs, also recorded under their severity */
  modal: string[];
  /** each quick pick shown: its title, the labels it offered and whether it allowed several */
  picks: { title?: string; labels: string[]; many?: boolean }[];
  /** each input box shown: its prompt and the validator it was given, so a test can run it */
  inputs: { title?: string; prompt?: string; placeHolder?: string; validate?: InputValidator }[];
  /** the documents `save()` was called on */
  saved: string[];
  /** the status bar items created */
  statusItems: StatusBarItem[];
  /** the terminals created, with the options they were given and whether they were shown */
  terminals: { options: TerminalOptions; shown: boolean }[];
  /** what was written to the clipboard, in order */
  clipboard: string[];
  /** the URIs `env.openExternal` was asked to open */
  external: string[];
} = { info: [], warning: [], error: [], commands: [], context: {}, opened: [], views: {}, modal: [], picks: [], saved: [], inputs: [], statusItems: [], terminals: [], clipboard: [], external: [] };

/** The handlers `registerCommand` was given, so a test can invoke a command the way the host would. */
export const handlers = new Map<string, (...args: any[]) => unknown>();

export function resetRecorded(): void {
  setFolders();
  recorded.info.length = 0;
  recorded.warning.length = 0;
  recorded.error.length = 0;
  recorded.commands.length = 0;
  recorded.context = {};
  recorded.opened.length = 0;
  recorded.views = {};
  recorded.modal.length = 0;
  recorded.picks.length = 0;
  recorded.saved.length = 0;
  recorded.inputs.length = 0;
  recorded.statusItems.length = 0;
  recorded.terminals.length = 0;
  recorded.clipboard.length = 0;
  recorded.external.length = 0;
  installed.clear();
  markdownEditor.available = false;
  files.clear();
  watchers.length = 0;
  failures.createTerminal = false;
  failures.executeCommand = false;
  failures.openExternal = undefined;
  handlers.clear();
  answers.message = undefined;
  answers.pick = undefined;
  answers.input = undefined;
  answers.many = undefined;
  window.activeTextEditor = undefined;
  workspace.textDocuments = [];
  workspace.isTrusted = true;
}

/**
 * Test hook: what the user answers. A single value answers every call; a list answers one call each, in
 * order, and runs out into `undefined`. Unset means none, as Escape does.
 */
export const answers = {
  message: undefined as string | undefined,
  /** the label a quick pick chooses */
  pick: undefined as string | (string | undefined)[] | undefined,
  /** the text an input box is given */
  input: undefined as string | (string | undefined)[] | undefined,
  /** the labels each multi-select quick pick accepts, one entry per pick; `undefined` dismisses it */
  many: undefined as (string[] | undefined)[] | undefined,
};

/** Test hook: make a host call fail. `openExternal` either throws or answers `false`. */
export const failures = {
  createTerminal: false,
  executeCommand: false,
  openExternal: undefined as 'throw' | 'false' | undefined,
};

/** The next answer: one of a list, or the single value that answers every call. */
function next(answer: string | (string | undefined)[] | undefined): string | undefined {
  return Array.isArray(answer) ? answer.shift() : answer;
}

export interface MessageOptions { modal?: boolean; detail?: string }

/** `show*Message(message, options?, ...items)`, as the real API accepts it. */
interface ShowMessage {
  <T extends string>(message: string, options: MessageOptions, ...items: T[]): Promise<T | undefined>;
  <T extends string>(message: string, ...items: T[]): Promise<T | undefined>;
}
const show = (into: string[]): ShowMessage => async (message: string, ...rest: (string | MessageOptions)[]) => {
  into.push(message);
  const [first] = rest;
  if (typeof first === 'object' && first?.modal) recorded.modal.push(message);
  return rest.find((i): i is string => typeof i === 'string' && i === answers.message) as never;
};

export interface QuickPickItem { label: string; description?: string; detail?: string }
export interface QuickPickOptions { title?: string; placeHolder?: string; canPickMany?: boolean }

/** `showQuickPick`, as the real API types it: a list back when several may be picked. */
interface ShowQuickPick {
  <T extends QuickPickItem>(items: readonly T[] | Promise<readonly T[]>, options: QuickPickOptions & { canPickMany: true }): Promise<T[] | undefined>;
  <T extends QuickPickItem>(items: readonly T[] | Promise<readonly T[]>, options?: QuickPickOptions): Promise<T | undefined>;
}

/** `InputBoxOptions.validateInput`, as far as the extension uses it. */
export type InputValidator = (value: string) => string | undefined | null | Promise<string | undefined | null>;
export interface InputBoxOptions { title?: string; prompt?: string; placeHolder?: string; value?: string; validateInput?: InputValidator }

export const window = {
  showInformationMessage: show(recorded.info),
  showWarningMessage: show(recorded.warning),
  showErrorMessage: show(recorded.error),
  showInputBox: async (options?: InputBoxOptions): Promise<string | undefined> => {
    const { title, prompt, placeHolder, validateInput } = options ?? {};
    recorded.inputs.push({ title, prompt, placeHolder, validate: validateInput });
    return next(answers.input);
  },
  showQuickPick: (async <T extends QuickPickItem>(items: readonly T[] | Promise<readonly T[]>, options?: QuickPickOptions): Promise<T | T[] | undefined> => {
    const list = await items;
    if (options?.canPickMany) {
      recorded.picks.push({ title: options.title, labels: list.map(i => i.label), many: true });
      const want = answers.many?.shift();
      return want && list.filter(i => want.includes(i.label));
    }
    recorded.picks.push({ title: options?.title, labels: list.map(i => i.label) });
    const want = next(answers.pick);
    return list.find(i => i.label === want);
  }) as ShowQuickPick,
  activeTextEditor: undefined as { document: TextDocument } | undefined,
  showTextDocument: async (document: { uri: Uri }, options?: { selection?: Range }) => {
    recorded.opened.push({ uri: document.uri.toString(), line: (options?.selection?.start.line ?? 0) + 1 });
    return { document };
  },
  createStatusBarItem: (_alignment?: StatusBarAlignment, _priority?: number): StatusBarItem => {
    const item = new StatusBarItem();
    recorded.statusItems.push(item);
    return item;
  },
  createTerminal: (options: TerminalOptions) => {
    if (failures.createTerminal) throw new Error('no terminal');
    const entry = { options, shown: false };
    recorded.terminals.push(entry);
    return { show: () => { entry.shown = true; }, dispose: () => {} };
  },
  registerTreeDataProvider: (viewId: string, provider: unknown) => {
    recorded.views[viewId] = provider;
    return { dispose: () => { delete recorded.views[viewId]; } };
  },
};

export const commands = {
  registerCommand: (command: string, handler: (...args: any[]) => unknown) => {
    handlers.set(command, handler);
    return { dispose: () => handlers.delete(command) };
  },
  executeCommand: async (command: string, ...args: unknown[]) => {
    recorded.commands.push({ command, args });
    if (failures.executeCommand && !handlers.has(command)) throw new Error(`command ${command} failed`);
    if (command === 'setContext') recorded.context[args[0] as string] = args[1];
    const handler = handlers.get(command);
    return handler ? await handler(...args) : undefined;
  },
};

export interface TerminalOptions { name?: string; cwd?: Uri | string; shellPath?: string; shellArgs?: string[] | string }

export const env = {
  uriScheme: 'vscode',
  clipboard: { writeText: async (text: string) => { recorded.clipboard.push(text); } },
  openExternal: async (uri: Uri): Promise<boolean> => {
    if (failures.openExternal === 'throw') throw new Error('cannot open');
    recorded.external.push(uri.toString());
    return failures.openExternal !== 'false';
  },
};

export interface WorkspaceFolder { uri: Uri; name: string; index: number }
export interface WorkspaceFoldersChangeEvent { added: readonly WorkspaceFolder[]; removed: readonly WorkspaceFolder[] }

const folderChanges = new EventEmitter<WorkspaceFoldersChangeEvent>();

/** An open document, as far as the extension reads one. */
export interface TextDocument { uri: Uri; isDirty: boolean; save(): Promise<boolean> }

/** Test helper: an open document with unsaved edits, which records its save. */
export function openDocument(uri: Uri, isDirty = true): TextDocument {
  const doc: TextDocument = {
    uri, isDirty,
    save: async () => { recorded.saved.push(uri.toString()); doc.isDirty = false; return true; },
  };
  workspace.textDocuments.push(doc);
  return doc;
}

export const workspace = {
  workspaceFolders: undefined as WorkspaceFolder[] | undefined,
  textDocuments: [] as TextDocument[],
  /** false in Restricted Mode; tests flip it */
  isTrusted: true,
  onDidChangeWorkspaceFolders: folderChanges.event,
  getConfiguration: () => ({ get: () => undefined }),
  openTextDocument: async (uri: Uri) => ({ uri }),
  /** `stat` finds only the paths a test put in `files` */
  fs: {
    stat: async (uri: Uri) => {
      if (!files.has(uri.toString())) throw new Error(`ENOENT ${uri.toString()}`);
      return { type: 1 };
    },
  },
  createFileSystemWatcher: (pattern: string, _ignoreCreate?: boolean, _ignoreChange?: boolean, _ignoreDelete?: boolean) => {
    const created = new EventEmitter<Uri>();
    const deleted = new EventEmitter<Uri>();
    const watcher = { pattern, onDidCreate: created.event, onDidDelete: deleted.event, fire: { created, deleted }, dispose: () => {} };
    watchers.push(watcher);
    return watcher;
  },
};

/** Test hook: the files `workspace.fs.stat` finds, by URI string. */
export const files = new Set<string>();

/** Test hook: every file watcher made, so a test can fire its events. */
export const watchers: { pattern: string; fire: { created: EventEmitter<Uri>; deleted: EventEmitter<Uri> } }[] = [];

/** Test helper: open the given folders, as if the window had just opened them. */
export function setFolders(...folders: WorkspaceFolder[]): void {
  workspace.workspaceFolders = folders.length ? folders : undefined;
}

/** Test helper: fire `onDidChangeWorkspaceFolders` and update `workspaceFolders` to match. */
export function changeFolders(e: WorkspaceFoldersChangeEvent): void {
  const removed = new Set(e.removed.map(f => f.uri.toString()));
  const kept = (workspace.workspaceFolders ?? []).filter(f => !removed.has(f.uri.toString()));
  setFolders(...kept, ...e.added);
  folderChanges.fire(e);
}

/** Test helper: a workspace folder at a path. */
export function folder(path: string, index = 0): WorkspaceFolder {
  return { uri: Uri.file(path), name: path.split('/').filter(Boolean).pop() ?? path, index };
}

export class RelativePattern {
  readonly baseUri: Uri;
  constructor(base: WorkspaceFolder | Uri | string, readonly pattern: string) {
    this.baseUri = base instanceof Uri ? base : typeof base === 'string' ? Uri.file(base) : base.uri;
  }
}

export interface ExtensionContext { extensionUri: Uri; subscriptions: { dispose(): unknown }[]; workspaceState: Memento }

/** `vscode.Memento`, kept in a map; `memento()` makes one for a test. */
export interface Memento { get<T>(key: string): T | undefined; update(key: string, value: unknown): Promise<void>; keys(): readonly string[] }
export function memento(initial: Record<string, unknown> = {}): Memento & { values: Map<string, unknown> } {
  const values = new Map(Object.entries(initial));
  return {
    values,
    get: <T>(key: string) => values.get(key) as T | undefined,
    update: async (key: string, value: unknown) => { if (value === undefined) values.delete(key); else values.set(key, value); },
    keys: () => [...values.keys()],
  };
}

export enum StatusBarAlignment { Left = 1, Right = 2 }

/** A status bar item that records what the extension set on it. */
export class StatusBarItem {
  text = '';
  tooltip: string | undefined;
  command: string | undefined;
  name: string | undefined;
  visible = false;
  disposed = false;
  show(): void { this.visible = true; }
  hide(): void { this.visible = false; }
  dispose(): void { this.disposed = true; this.visible = false; }
}

/** Test hook: the extension ids `extensions.getExtension` finds. */
export const installed = new Set<string>();
/** Test hook: whether the bundled markdown extension contributes the Markdown Editor. */
export const markdownEditor = { available: false };
const MARKDOWN_EXTENSION = 'vscode.markdown-language-features';
export const extensions = {
  getExtension: (id: string) => {
    if (id === MARKDOWN_EXTENSION && markdownEditor.available) {
      return { id, packageJSON: { contributes: { customEditors: [{ viewType: 'vscode.markdown.editor' }] } } };
    }
    return installed.has(id) ? { id } : undefined;
  },
};

/** vscode.Disposable is structural: anything with `dispose()` satisfies it. */
export interface Disposable { dispose(): unknown }

export interface DocumentFilter {
  readonly language?: string;
  readonly scheme?: string;
  readonly pattern?: string | RelativePattern;
  readonly notebookType?: string;
}
export type DocumentSelector = DocumentFilter | string | readonly (DocumentFilter | string)[];
