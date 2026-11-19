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
  /** each quick pick shown: its title and the labels it offered */
  picks: { title?: string; labels: string[] }[];
  /** each input box shown: its prompt and the validator it was given, so a test can run it */
  inputs: { title?: string; prompt?: string; placeHolder?: string; validate?: InputValidator }[];
  /** the documents `save()` was called on */
  saved: string[];
} = { info: [], warning: [], error: [], commands: [], context: {}, opened: [], views: {}, modal: [], picks: [], saved: [], inputs: [] };

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
  handlers.clear();
  answers.message = undefined;
  answers.pick = undefined;
  answers.input = undefined;
  window.activeTextEditor = undefined;
  workspace.textDocuments = [];
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
};

/** The next answer: one of a list, or the single value that answers every call. */
function next(answer: string | (string | undefined)[] | undefined): string | undefined {
  return Array.isArray(answer) ? answer.shift() : answer;
}

export interface MessageOptions { modal?: boolean; detail?: string }

/** `show*Message(message, options?, ...items)`, as the real API accepts it. */
const show = (into: string[]) => async <T extends string>(message: string, ...rest: (T | MessageOptions)[]): Promise<T | undefined> => {
  into.push(message);
  const [first] = rest;
  if (typeof first === 'object' && first?.modal) recorded.modal.push(message);
  return rest.find((i): i is T => typeof i === 'string' && i === answers.message);
};

export interface QuickPickItem { label: string; description?: string; detail?: string }

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
  showQuickPick: async <T extends QuickPickItem>(items: readonly T[] | Promise<readonly T[]>, options?: { title?: string; placeHolder?: string }): Promise<T | undefined> => {
    const list = await items;
    recorded.picks.push({ title: options?.title, labels: list.map(i => i.label) });
    const want = next(answers.pick);
    return list.find(i => i.label === want);
  },
  activeTextEditor: undefined as { document: TextDocument } | undefined,
  showTextDocument: async (document: { uri: Uri }, options?: { selection?: Range }) => {
    recorded.opened.push({ uri: document.uri.toString(), line: (options?.selection?.start.line ?? 0) + 1 });
    return { document };
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
    if (command === 'setContext') recorded.context[args[0] as string] = args[1];
    const handler = handlers.get(command);
    return handler ? await handler(...args) : undefined;
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
  onDidChangeWorkspaceFolders: folderChanges.event,
  getConfiguration: () => ({ get: () => undefined }),
  openTextDocument: async (uri: Uri) => ({ uri }),
};

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

export interface ExtensionContext { extensionUri: Uri; subscriptions: { dispose(): unknown }[] }

/** vscode.Disposable is structural: anything with `dispose()` satisfies it. */
export interface Disposable { dispose(): unknown }

export interface DocumentFilter {
  readonly language?: string;
  readonly scheme?: string;
  readonly pattern?: string | RelativePattern;
  readonly notebookType?: string;
}
export type DocumentSelector = DocumentFilter | string | readonly (DocumentFilter | string)[];
