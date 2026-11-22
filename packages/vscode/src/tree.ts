// The two sidebar views, Specs and Steering, built from each folder's spec tree. Every node is a
// `vscode.TreeItem` it builds itself, so a provider only has to say who the children are. A node is pure
// data, which is what lets the builders below be tested without VS Code; only the Steering view looks at
// the disk, to find the agent instruction files the server does not report.
import * as vscode from 'vscode';
import type { OutlineItem, SpecTree, TreeSpec, TreeSteering } from './protocol.js';
import type { FolderServer, ServerPool } from './servers.js';
import {
  INSTRUCTION_GLOB, listInstructions, specsDir, type FolderReader,
  documentRow, instructionRow, specOrder, specRow, steeringOrder, steeringRow, taskRow, taskRows, unusable, type RowIcon, type RowText,
  canApproveDocument, specActions, taskActions, type TaskRow,
} from '@steno/core/host';

const { None, Collapsed } = vscode.TreeItemCollapsibleState;

/** The command every openable node carries; `steno.open` is registered by the tree view. */
export const OPEN_COMMAND = 'steno.open';

/** The stopped folder's inline action. */
export const RESTART_COMMAND = 'steno.server.restart';

/** The Specs view, as contributed in package.json. */
export const VIEW_ID = 'steno.specs';

/** The Steering view, as contributed in package.json. */
export const STEERING_VIEW_ID = 'steno.steering';

/** The codicon VS Code shows for each kind of row. */
const CODICONS: Record<RowIcon, string> = {
  spec: 'edit', execute: 'play-circle', done: 'pass-filled', warning: 'warning', document: 'file-text',
  finished: 'pass', next: 'arrow-right', task: 'circle-large-outline', steering: 'file-text', instruction: 'hubot',
};

/** Put a row's description, hover and icon on a tree item; the label is already set by the constructor. */
function show(item: vscode.TreeItem, row: RowText): void {
  item.description = row.description;
  item.tooltip = row.tooltip;
  item.iconPath = new vscode.ThemeIcon(CODICONS[row.icon]);
}

/** VS Code's built-in rich Markdown editor, from the bundled markdown extension. */
const MARKDOWN_EDITOR = 'vscode.markdown.editor';

/**
 * `steno.open` with a file URI. With a 1-based line it opens the Text Editor there; without one it opens the
 * document as a whole, in the Markdown Editor when VS Code has it.
 */
function open(uri: vscode.Uri, line?: number): vscode.TreeItem['command'] {
  return { command: OPEN_COMMAND, title: 'Open', arguments: line === undefined ? [uri] : [uri, line] };
}

export type Node = FolderNode | StoppedNode | SpecNode | DocNode | TaskNode | FileNode;
export type SteeringViewNode = FolderNode | SteeringNode | InstructionNode;

/** One workspace folder, shown only when the window has two or more shown folders. */
export class FolderNode extends vscode.TreeItem {
  readonly kind = 'folder' as const;

  constructor(readonly folder: vscode.WorkspaceFolder, readonly project: boolean) {
    super(folder.name, Collapsed);
    this.iconPath = new vscode.ThemeIcon('folder');
    // `folder.project` is what the "new spec" menu item asks for, a stopped folder is not one
    this.contextValue = project ? 'folder.project' : 'folder';
  }
}

/** A folder whose server gave up after five exits: no Specs, just the way back. */
export class StoppedNode extends vscode.TreeItem {
  readonly kind = 'stopped' as const;

  constructor(readonly folder: vscode.WorkspaceFolder) {
    super('steno server stopped', None);
    this.description = folder.name;
    this.tooltip = `steno server for ${folder.name} stopped after repeated exits: its specs are no longer being followed. Restart to pick them up again.`;
    this.iconPath = new vscode.ThemeIcon('debug-disconnect');
    // the view's item menu hangs the inline "Restart" off this value
    this.contextValue = 'stopped';
  }
}

/**
 * A usable Spec's context value: `spec.{phase}`, then `.written` once the phase's document is filled in, then
 * `.approvable` when it can be approved, such as `spec.design.written.approvable` or `spec.execute`. The menus in
 * package.json match on these patterns, so each handoff shows only in the phases it makes sense in, and Write
 * turns into Revise once there is something to revise.
 */
export function specContext(spec: TreeSpec): string {
  const actions = specActions(spec);
  // only where Write is offered: `spec.execute` must stay exact, or Run Next Task would vanish from a written spec
  const written = spec.written && actions.includes('write') ? '.written' : '';
  const base = (spec.phase ? `spec.${spec.phase}` : 'spec') + written;
  return actions.includes('approve') ? `${base}.approvable` : base;
}

/**
 * A task's context value. Any open task of a usable Spec in `execute` can be run, a parent task included: the
 * agent then works through its subtasks in order.
 */
export function taskContext(spec: TreeSpec, done: boolean): 'task.done' | 'task.open' | 'task.open.run' {
  const actions = taskActions(spec, done);
  if (actions.includes('reopen')) return 'task.done';
  return actions.includes('run') ? 'task.open.run' : 'task.open';
}

/** One Spec: its title with the one fact `specDescription` picks, or the reason it is Unusable. */
export class SpecNode extends vscode.TreeItem {
  readonly kind = 'spec' as const;
  readonly unusable: boolean;

  constructor(readonly folder: vscode.Uri, readonly tree: SpecTree, readonly spec: TreeSpec) {
    const row = specRow(spec);
    super(row.label, Collapsed);
    show(this, row);
    this.unusable = unusable(spec);
    // no contextValue on purpose: an Unusable Spec offers nothing but opening its files
    if (this.unusable) return;
    // "Approve", "Write", "Review" and "Run next task" each match the phase part of this value
    this.contextValue = specContext(spec);
  }
}

/**
 * One spec document, ticked once its stage is done. `tasks.md` holds the Spec's tasks. The document of the
 * Spec's current phase carries "Approve" while the phase can be approved, so the user approves with it in view.
 */
export class DocNode extends vscode.TreeItem {
  readonly kind = 'doc' as const;

  constructor(readonly folder: vscode.Uri, readonly document: string, readonly uri: vscode.Uri,
    readonly children: TaskNode[] = [], readonly row: RowText, readonly spec?: TreeSpec) {
    super(row.label, children.length ? Collapsed : None);
    this.resourceUri = uri;
    // the icon is a codicon, not 'file': that one means "the file icon theme's icon", the Markdown icon for a .md
    show(this, row);
    this.contextValue = spec && canApproveDocument(spec, document) ? 'doc.approvable' : 'doc';
    this.command = open(uri);
  }
}

/** One task, nested as it is in `tasks.md`. */
export class TaskNode extends vscode.TreeItem {
  readonly kind = 'task' as const;
  readonly taskId: string;
  readonly done: boolean;
  readonly optional: boolean;

  constructor(readonly spec: TreeSpec, readonly item: OutlineItem, readonly children: TaskNode[],
    readonly next: boolean, uri?: vscode.Uri) {
    const row = taskRow(item, next);
    super(row.label, children.length ? Collapsed : None);
    show(this, row);
    this.taskId = row.id;
    this.done = row.done;
    this.optional = row.optional;
    this.contextValue = taskContext(spec, row.done);
    if (uri) {
      this.resourceUri = uri;
      this.command = open(uri, row.line);
    }
  }
}

/**
 * The Spec's tasks as nodes, keeping the ids, order and nesting of `items`. At most one node is
 * marked `next`: the one whose id is the Spec's `next.id`. `uri` is `tasks.md`, so a node can
 * open at its own line; the builders that only care about the shape leave it out.
 */
export function taskNodes(spec: TreeSpec, items: OutlineItem[], uri?: vscode.Uri): TaskNode[] {
  // the rows have the shape of `items`, so the two are walked together
  const build = (item: OutlineItem, row: TaskRow): TaskNode =>
    new TaskNode(spec, item, item.children.map((child, i) => build(child, row.children[i])), row.next, uri);
  const rows = taskRows(spec, items);
  return items.map((item, i) => build(item, rows[i]));
}

/** A file of an Unusable Spec, or of any other thing the server could only name. */
export class FileNode extends vscode.TreeItem {
  readonly kind = 'file' as const;

  constructor(readonly folder: vscode.Uri, readonly path: string, readonly reason: string, readonly uri: vscode.Uri) {
    super(path, None);
    this.description = reason;
    this.tooltip = reason;
    this.resourceUri = uri;
    this.command = open(uri, 1);
  }
}

/** One steering file, by its name, with when it reaches the agent, or the reason it could not be read. */
export class SteeringNode extends vscode.TreeItem {
  readonly kind = 'steering-file' as const;
  readonly uri: vscode.Uri;

  constructor(readonly folder: vscode.Uri, readonly entry: TreeSteering) {
    const row = steeringRow(entry);
    super(row.label, None);
    show(this, row);
    this.uri = vscode.Uri.joinPath(folder, ...entry.path.split('/'));
    this.resourceUri = this.uri;
    this.command = open(this.uri);
    if (!entry.unreadable) this.contextValue = 'steering.file';
  }
}

/**
 * An agent instruction file, listed with the steering it sits beside. One at the folder's root, such as
 * `AGENTS.md`, reads by its name; one inside a folder, such as `.github/copilot-instructions.md`, by its path.
 */
export class InstructionNode extends vscode.TreeItem {
  readonly kind = 'instructions' as const;

  constructor(readonly folder: vscode.Uri, readonly file: string, readonly uri: vscode.Uri) {
    const row = instructionRow(file);
    super(row.label, None);
    show(this, row);
    this.resourceUri = uri;
    this.contextValue = 'instructions';
    this.command = open(uri);
  }
}

/**
 * What hangs under one Spec: its spec documents in the server's order, with the Spec's tasks under tasks.md`. 
 * An Unusable Spec has only its files, so it offers nothing but opening them.
 */
export function specChildren(folder: vscode.Uri, tree: SpecTree, spec: TreeSpec): Node[] {
  if (unusable(spec)) {
    return (spec.files ?? []).map(f => new FileNode(folder, f.file, f.reason, vscode.Uri.joinPath(folder, ...f.file.split('/'))));
  }
  const dir = specsDir(tree).split('/').filter(Boolean);
  return (spec.documents ?? []).map(document => {
    const uri = vscode.Uri.joinPath(folder, ...dir, spec.name, document);
    const tasks = document === 'tasks.md' ? taskNodes(spec, spec.taskItems ?? [], uri) : [];
    return new DocNode(folder, document, uri, tasks, documentRow(spec, document), spec);
  });
}

/** The folders the view shows: one that is stopped, or one whose tree says it is set up. */
export function shown(servers: readonly FolderServer[]): FolderServer[] {
  // a folder with no tree yet is not shown: its server has not said whether it is a steno project
  return servers.filter(s => s.state === 'stopped' || (s.tree !== undefined && s.tree.notSetUp !== true));
}

/** The items of one folder in the Specs view: its Specs, or the stopped item. */
export function folderItems(server: FolderServer): Node[] {
  if (server.state === 'stopped') return [new StoppedNode(server.folder)];
  const tree = server.tree;
  if (!tree) return [];
  const uri = server.folder.uri;
  return specOrder(tree.specs).map(spec => new SpecNode(uri, tree, spec));
}

/** The folder's files through the editor's file system, so a remote or virtual workspace reads the same way. */
function folderReader(folder: vscode.Uri): FolderReader {
  const at = (path: string) => vscode.Uri.joinPath(folder, ...path.split('/'));
  return {
    // `stat` throws for a file that does not exist
    exists: async path => { try { await vscode.workspace.fs.stat(at(path)); return true; } catch { return false; } },
    files: async dir => (await vscode.workspace.fs.readDirectory(at(dir))).filter(([, type]) => type === vscode.FileType.File).map(([name]) => name),
  };
}

/**
 * The items of one folder in the Steering view, in three groups, each A to Z: the agent instruction files at
 * its root, then its steering files, then the instruction files only one agent reads, such as Cursor's rules.
 */
export async function steeringItems(server: FolderServer): Promise<SteeringViewNode[]> {
  const tree = server.tree;
  if (server.state === 'stopped' || !tree) return [];
  const uri = server.folder.uri;
  const { root, agent } = await listInstructions(folderReader(uri));
  const byPath = new Map(tree.steering.map(entry => [entry.path, entry]));
  return steeringOrder(tree.steering, root, agent).map(row => row.kind === 'steering'
    ? new SteeringNode(uri, byPath.get(row.path)!)
    : new InstructionNode(uri, row.path, vscode.Uri.joinPath(uri, ...row.path.split('/'))));
}

/** What both views share: one FolderNode per folder, kept so a refresh can name a subtree the view already holds. */
abstract class FolderView<N extends vscode.TreeItem> {
  protected readonly changed = new vscode.EventEmitter<N | undefined>();
  readonly onDidChangeTreeData = this.changed.event;
  private readonly folderNodes = new Map<string, FolderNode>();

  constructor(protected readonly pool: ServerPool) {}

  /** The folders this view shows right now, in the order their servers started. */
  abstract shownServers(): FolderServer[];

  /** Redraw the whole tree, or just this node's subtree. */
  // every view's node type includes FolderNode, so naming one is always a node this view holds
  refresh(node?: N | FolderNode): void { this.changed.fire(node as N | undefined); }

  /** The FolderNode of this folder, the same object every time, so the view can refresh its subtree. */
  folderNode(server: FolderServer): FolderNode {
    const key = server.folder.uri.toString();
    const project = server.state !== 'stopped';
    const held = this.folderNodes.get(key);
    if (held && held.project === project) return held;
    const made = new FolderNode(server.folder, project);
    this.folderNodes.set(key, made);
    return made;
  }

  /** The server behind a FolderNode of this view. */
  protected serverOf(node: FolderNode): FolderServer | undefined {
    return this.pool.all().find(s => s.folder.uri.toString() === node.folder.uri.toString());
  }

  getTreeItem(node: N): vscode.TreeItem { return node; }

  dispose(): void { this.changed.dispose(); }
}

/** The Steering view (`steno.steering`): each running project's agent instruction files and steering files. */
export class SteeringTreeProvider extends FolderView<SteeringViewNode> implements vscode.TreeDataProvider<SteeringViewNode> {
  // a stopped folder has no tree to read its steering from; the Specs view already offers its restart
  shownServers(): FolderServer[] { return shown(this.pool.all()).filter(s => s.state !== 'stopped'); }

  async getChildren(node?: SteeringViewNode): Promise<SteeringViewNode[]> {
    if (!node) {
      const servers = this.shownServers();
      if (servers.length === 1) return steeringItems(servers[0]);
      return servers.map(server => this.folderNode(server));
    }
    if (node.kind !== 'folder') return [];
    const server = this.serverOf(node);
    return server ? steeringItems(server) : [];
  }
}

/** The Specs view (`steno.specs`): every shown folder's Specs. */
export class SpecTreeProvider extends FolderView<Node> implements vscode.TreeDataProvider<Node> {
  shownServers(): FolderServer[] { return shown(this.pool.all()); }

  getChildren(node?: Node): Node[] {
    if (!node) {
      const servers = this.shownServers();
      // one shown folder puts its items at the root; several group them per folder
      if (servers.length === 1) return folderItems(servers[0]);
      return servers.map(server => this.folderNode(server));
    }
    switch (node.kind) {
      case 'folder': {
        const server = this.serverOf(node);
        return server ? folderItems(server) : [];
      }
      case 'spec': return node.unusable || node.spec.documents ? specChildren(node.folder, node.tree, node.spec) : [];
      case 'doc': return node.children;
      case 'task': return node.children;
      default: return [];
    }
  }
}

/** Whether this VS Code has the built-in Markdown Editor; editors built on older VS Code, or forks, may not. */
function hasMarkdownEditor(): boolean {
  const manifest = vscode.extensions.getExtension('vscode.markdown-language-features')?.packageJSON as
    { contributes?: { customEditors?: { viewType?: string }[] } } | undefined;
  return manifest?.contributes?.customEditors?.some(editor => editor.viewType === MARKDOWN_EDITOR) === true;
}

/**
 * `steno.open`: with a 1-based line, open the Text Editor with the cursor on it. Without one, open a Markdown
 * document in the Markdown Editor, falling back to the Text Editor where VS Code has no Markdown Editor.
 */
export function registerOpen(): vscode.Disposable {
  return vscode.commands.registerCommand(OPEN_COMMAND, async (uri: vscode.Uri, line?: number) => {
    if (line === undefined && /\.md$/i.test(uri.path) && hasMarkdownEditor()) {
      try {
        await vscode.commands.executeCommand('vscode.openWith', uri, MARKDOWN_EDITOR);
        return;
      } catch {
        // the editor refused this document: the Text Editor below still opens it
      }
    }
    const document = await vscode.workspace.openTextDocument(uri);
    const at = new vscode.Position(Math.max(0, (line ?? 1) - 1), 0);
    await vscode.window.showTextDocument(document, { selection: new vscode.Range(at, at) });
  });
}

/** `steno.server.restart`: the stopped folder's inline action, which resets the count too. */
function registerRestart(pool: ServerPool): vscode.Disposable {
  return vscode.commands.registerCommand(RESTART_COMMAND, async (node: StoppedNode) => {
    const server = pool.all().find(s => s.folder.uri.toString() === node.folder.uri.toString());
    if (server) await pool.restart(server);
  });
}

/** The context key the empty-state `viewsWelcome` entry watches. */
export const HAS_PROJECT = 'steno.hasProject';

/** Whether any folder has answered with a tree that says it is a steno project. */
export function hasProject(servers: readonly FolderServer[]): boolean {
  // a folder with no tree yet has not answered, so it neither sets nor clears the key
  return servers.some(s => s.tree !== undefined && s.tree.notSetUp !== true);
}

/** The context key that offers "Set up steno" in the palette while some folder is not a steno project. */
export const CAN_SET_UP = 'steno.canSetUp';

/** Whether any folder has answered with a tree that says it is not a steno project yet. */
function canSetUp(servers: readonly FolderServer[]): boolean {
  return servers.some(s => s.tree?.notSetUp === true);
}

/** Set both context keys from what the folders have answered so far. */
function setKeys(servers: readonly FolderServer[]): void {
  void vscode.commands.executeCommand('setContext', HAS_PROJECT, hasProject(servers));
  void vscode.commands.executeCommand('setContext', CAN_SET_UP, canSetUp(servers));
}

/**
 * Keep both views current: every change a pool reports redraws as little of each view as it can, and
 * refreshes the empty-state and set-up keys with it.
 */
export function watchTree(pool: ServerPool, ...views: (SpecTreeProvider | SteeringTreeProvider)[]): vscode.Disposable {
  const keyOf = (servers: FolderServer[]) => servers.map(s => s.folder.uri.toString()).join('\n');
  const was = views.map(view => keyOf(view.shownServers()));
  const sync = (server: FolderServer): void => {
    views.forEach((view, i) => {
      const servers = view.shownServers();
      const now = keyOf(servers);
      const setChanged = now !== was[i];
      was[i] = now;
      // with one shown folder its items sit at the root, so only the whole tree can be redrawn
      if (setChanged || servers.length <= 1) view.refresh();
      else if (servers.some(s => s.folder.uri.toString() === server.folder.uri.toString())) view.refresh(view.folderNode(server));
    });
    setKeys(pool.all());
  };
  setKeys(pool.all());
  return pool.onDidChange(sync);
}

/** Redraw the Steering view when an agent instruction file appears or goes; the server does not watch them. */
function watchInstructions(view: SteeringTreeProvider): vscode.Disposable {
  const watcher = vscode.workspace.createFileSystemWatcher(INSTRUCTION_GLOB, false, true, false);
  const redraw = () => view.refresh();
  const listening = [watcher.onDidCreate(redraw), watcher.onDidDelete(redraw), watcher];
  return { dispose: () => { for (const d of listening) d.dispose(); } };
}

/** Both views, their data providers and the two commands their items use. */
export function registerSpecTree(pool: ServerPool): {
  provider: SpecTreeProvider; steering: SteeringTreeProvider; disposables: vscode.Disposable[];
} {
  const provider = new SpecTreeProvider(pool);
  const steering = new SteeringTreeProvider(pool);
  return {
    provider,
    steering,
    disposables: [
      vscode.window.registerTreeDataProvider(VIEW_ID, provider),
      vscode.window.registerTreeDataProvider(STEERING_VIEW_ID, steering),
      watchTree(pool, provider, steering),
      watchInstructions(steering),
      registerOpen(),
      registerRestart(pool),
      provider,
      steering,
    ],
  };
}
