// One folder's Spec_Tree as tree items. Every node is a `vscode.TreeItem` it builds itself, so the
// provider (tree-view.ts) only has to say who the children are. Nothing here touches the editor host:
// a node is pure data, which is what lets the builders below be tested without VS Code.
import * as vscode from 'vscode';
import type { OutlineItem, SpecTree, TreeSpec, TreeSteering } from './protocol.js';
import type { FolderServer, ServerPool } from './servers.js';
import { canApprove } from './actions.js';

const { None, Collapsed } = vscode.TreeItemCollapsibleState;

/** The command every openable node carries; `steno.open` is registered by the tree view. */
export const OPEN_COMMAND = 'steno.open';

/** The stopped folder's inline action. */
export const RESTART_COMMAND = 'steno.server.restart';

/** The view this provider feeds, as contributed in package.json. */
export const VIEW_ID = 'steno.specs';

/** Where specs live when the server did not say; only a set-up folder reaches the builders below. */
export const DEFAULT_SPECS_DIR = '.steno/specs';

/** `steno.open` with a file URI and a 1-based line. */
function open(uri: vscode.Uri, line: number): vscode.TreeItem['command'] {
  return { command: OPEN_COMMAND, title: 'Open', arguments: [uri, line] };
}

export type Node = FolderNode | StoppedNode | SpecNode | DocNode | TaskNode
  | SteeringGroupNode | SteeringNode | FileNode;

/** One Workspace_Folder, shown only when the window has two or more shown folders. */
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

/** Whether the server could read this Spec at all. */
export function unusable(spec: TreeSpec): boolean {
  return spec.unsupported === true || spec.unreadable === true;
}

/**
 * A usable Spec's context value: `spec.{phase}`, plus `.approvable` when it can be approved, such as
 * `spec.design.approvable` or `spec.execute`. The menus in package.json match on these patterns, so each
 * handoff shows only in the phases it makes sense in.
 */
export function specContext(spec: TreeSpec): string {
  const base = spec.phase ? `spec.${spec.phase}` : 'spec';
  return canApprove(spec) ? `${base}.approvable` : base;
}

/**
 * A task's context value. Only an open task without subtasks of a usable Spec in `execute` can be run; a parent
 * task is finished through its subtasks, so it gets plain `task.open`.
 */
export function taskContext(spec: TreeSpec, done: boolean, leaf: boolean): 'task.done' | 'task.open' | 'task.open.run' {
  if (done) return 'task.done';
  return leaf && !unusable(spec) && spec.phase === 'execute' ? 'task.open.run' : 'task.open';
}

/** Find a task by id anywhere in the outline. */
function findTask(items: readonly OutlineItem[], id: string): OutlineItem | undefined {
  for (const item of items) {
    if (item.id === id) return item;
    const inner = findTask(item.children, id);
    if (inner) return inner;
  }
  return undefined;
}

/**
 * Whether a folder's tree offers "Run" on this task: the same rule as `task.open.run`, so the run lens and the
 * tree always agree. A Spec or task the tree doesn't know is not runnable.
 */
export function runnable(tree: SpecTree | undefined, specName: string, taskId: string): boolean {
  const spec = tree?.specs.find(s => s.name === specName);
  if (!spec || unusable(spec)) return false;
  const item = findTask(spec.taskItems ?? [], taskId);
  return item !== undefined && taskContext(spec, item.done === true, item.children.length === 0) === 'task.open.run';
}

/** One Spec: title, `phase · mode · done/total`, or the reason it is Unusable. */
export class SpecNode extends vscode.TreeItem {
  readonly kind = 'spec' as const;
  readonly unusable: boolean;

  constructor(readonly folder: vscode.Uri, readonly tree: SpecTree, readonly spec: TreeSpec) {
    super(spec.title ?? spec.name, Collapsed);
    this.unusable = unusable(spec);
    if (this.unusable) {
      this.label = spec.name;
      this.description = spec.unsupported ? 'unsupported' : 'unreadable';
      this.iconPath = new vscode.ThemeIcon('warning');
      this.tooltip = spec.files?.[0]?.reason;
      // no contextValue on purpose: an Unusable Spec offers nothing but opening its files
      return;
    }
    const counts = spec.tasks;
    this.description = [spec.phase, spec.mode, counts && `${counts.done}/${counts.total}`]
      .filter((part): part is string => typeof part === 'string' && part.length > 0).join(' · ');
    // "Approve", "Write", "Review" and "Run next task" each match the phase part of this value
    this.contextValue = specContext(spec);
  }
}

/** One Spec_Document. `tasks.md` holds the Spec's tasks. */
export class DocNode extends vscode.TreeItem {
  readonly kind = 'doc' as const;

  constructor(readonly folder: vscode.Uri, readonly document: string, readonly uri: vscode.Uri,
    readonly children: TaskNode[] = []) {
    super(document, children.length ? Collapsed : None);
    this.resourceUri = uri;
    this.contextValue = 'doc';
    this.command = open(uri, 1);
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
    super(item.title, children.length ? Collapsed : None);
    this.taskId = item.id ?? '';
    this.done = item.done === true;
    this.optional = item.optional === true;
    this.iconPath = new vscode.ThemeIcon(next ? 'arrow-right' : this.done ? 'pass' : 'circle-large-outline');
    this.description = [this.optional && 'optional', next && 'next'].filter(Boolean).join(' · ');
    this.contextValue = taskContext(spec, this.done, children.length === 0);
    if (uri) {
      this.resourceUri = uri;
      this.command = open(uri, item.line);
    }
  }
}

/**
 * The Spec's tasks as nodes, keeping the ids, order and nesting of `items`. At most one node is
 * marked `next`: the one whose id is the Spec's `next.id`. `uri` is `tasks.md`, so a node can
 * open at its own line; the builders that only care about the shape leave it out.
 */
export function taskNodes(spec: TreeSpec, items: OutlineItem[], uri?: vscode.Uri): TaskNode[] {
  const nextId = spec.next?.id;
  let marked = false;
  const build = (item: OutlineItem): TaskNode => {
    // the flag, and deciding before recursing, keep the mark on the first match in document order
    const isNext = !marked && item.id !== undefined && item.id === nextId;
    if (isNext) marked = true;
    return new TaskNode(spec, item, item.children.map(build), isNext, uri);
  };
  return items.map(build);
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

/** The steering group, the last item of its level, and where "Generate steering" hangs. */
export class SteeringGroupNode extends vscode.TreeItem {
  readonly kind = 'steering-group' as const;
  readonly children: SteeringNode[];

  constructor(readonly folder: vscode.Uri, readonly tree: SpecTree) {
    super('Steering', Collapsed);
    this.iconPath = new vscode.ThemeIcon('compass');
    this.contextValue = 'steering';
    this.children = tree.steering.map(entry => new SteeringNode(folder, entry));
  }
}

/** One Steering_File, by path, with its inclusion mode, or the reason it could not be read. */
export class SteeringNode extends vscode.TreeItem {
  readonly kind = 'steering-file' as const;
  readonly uri: vscode.Uri;

  constructor(readonly folder: vscode.Uri, readonly entry: TreeSteering) {
    super(entry.path, None);
    this.uri = vscode.Uri.joinPath(folder, ...entry.path.split('/'));
    this.resourceUri = this.uri;
    this.command = open(this.uri, 1);
    if (entry.unreadable) {
      this.description = 'unreadable';
      this.tooltip = entry.reason;
      this.iconPath = new vscode.ThemeIcon('warning');
      return;
    }
    this.description = entry.inclusion;
    this.contextValue = 'steering.file';
  }
}

/**
 * What hangs under one Spec: its Spec_Documents in the server's order, with the Spec's tasks under tasks.md`. 
 * An Unusable Spec has only its files, so it offers nothing but opening them.
 */
export function specChildren(folder: vscode.Uri, tree: SpecTree, spec: TreeSpec): Node[] {
  if (unusable(spec)) {
    return (spec.files ?? []).map(f => new FileNode(folder, f.file, f.reason, vscode.Uri.joinPath(folder, ...f.file.split('/'))));
  }
  const dir = (tree.specsDir ?? DEFAULT_SPECS_DIR).split('/').filter(Boolean);
  return (spec.documents ?? []).map(document => {
    const uri = vscode.Uri.joinPath(folder, ...dir, spec.name, document);
    const tasks = document === 'tasks.md' ? taskNodes(spec, spec.taskItems ?? [], uri) : [];
    return new DocNode(folder, document, uri, tasks);
  });
}

/** The folders the view shows: one that is stopped, or one whose tree says it is set up. */
export function shown(servers: readonly FolderServer[]): FolderServer[] {
  // a folder with no tree yet is not shown: its server has not said whether it is a steno project
  return servers.filter(s => s.state === 'stopped' || (s.tree !== undefined && s.tree.notSetUp !== true));
}

/** The items of one folder: its Specs then the steering group, or the stopped item. */
export function folderItems(server: FolderServer): Node[] {
  if (server.state === 'stopped') return [new StoppedNode(server.folder)];
  const tree = server.tree;
  if (!tree) return [];
  const uri = server.folder.uri;
  const items: Node[] = tree.specs.map(spec => new SpecNode(uri, tree, spec));
  // "Steering" is the last item of the folder's level. It shows even with no steering files yet, because that
  // is exactly when the user wants "Generate steering"
  items.push(new SteeringGroupNode(uri, tree));
  return items;
}

/** The sidebar tree (view `steno.specs`): every shown folder's Spec_Tree. */
export class SpecTreeProvider implements vscode.TreeDataProvider<Node> {
  private readonly changed = new vscode.EventEmitter<Node | undefined>();
  readonly onDidChangeTreeData = this.changed.event;
  /** one FolderNode per folder, kept so a refresh can name a subtree the view already holds */
  private readonly folderNodes = new Map<string, FolderNode>();

  constructor(private readonly pool: ServerPool) {}

  /** Redraw the whole tree, or just this node's subtree. */
  refresh(node?: Node): void { this.changed.fire(node); }

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

  /** The folders the view shows right now, in the order their servers started. */
  shownServers(): FolderServer[] { return shown(this.pool.all()); }

  getTreeItem(node: Node): vscode.TreeItem { return node; }

  getChildren(node?: Node): Node[] {
    if (!node) {
      const servers = this.shownServers();
      // one shown folder puts its items at the root; several group them per folder
      if (servers.length === 1) return folderItems(servers[0]);
      return servers.map(server => this.folderNode(server));
    }
    switch (node.kind) {
      case 'folder': {
        const server = this.pool.all().find(s => s.folder.uri.toString() === node.folder.uri.toString());
        return server ? folderItems(server) : [];
      }
      case 'spec': return node.unusable || node.spec.documents ? specChildren(node.folder, node.tree, node.spec) : [];
      case 'doc': return node.children;
      case 'task': return node.children;
      case 'steering-group': return node.children;
      default: return [];
    }
  }

  dispose(): void { this.changed.dispose(); }
}

/** `steno.open`: open a document and put the cursor on a 1-based line. */
export function registerOpen(): vscode.Disposable {
  return vscode.commands.registerCommand(OPEN_COMMAND, async (uri: vscode.Uri, line = 1) => {
    const document = await vscode.workspace.openTextDocument(uri);
    const at = new vscode.Position(Math.max(0, line - 1), 0);
    await vscode.window.showTextDocument(document, { selection: new vscode.Range(at, at) });
  });
}

/** `steno.server.restart`: the stopped folder's inline action, which resets the count too. */
export function registerRestart(pool: ServerPool): vscode.Disposable {
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
export function canSetUp(servers: readonly FolderServer[]): boolean {
  return servers.some(s => s.tree?.notSetUp === true);
}

/** Set both context keys from what the folders have answered so far. */
function setKeys(servers: readonly FolderServer[]): void {
  void vscode.commands.executeCommand('setContext', HAS_PROJECT, hasProject(servers));
  void vscode.commands.executeCommand('setContext', CAN_SET_UP, canSetUp(servers));
}

/**
 * Keep the view current: every change a pool reports redraws as little of the tree as it can, and
 * refreshes the empty-state and set-up keys with it.
 */
export function watchTree(pool: ServerPool, provider: SpecTreeProvider): vscode.Disposable {
  let was = provider.shownServers().map(s => s.folder.uri.toString()).join('\n');
  const sync = (server: FolderServer): void => {
    const servers = provider.shownServers();
    const now = servers.map(s => s.folder.uri.toString()).join('\n');
    const setChanged = now !== was;
    was = now;
    // with one shown folder its items sit at the root, so only the whole tree can be redrawn
    if (setChanged || servers.length <= 1) provider.refresh();
    else provider.refresh(provider.folderNode(server));
    setKeys(pool.all());
  };
  setKeys(pool.all());
  return pool.onDidChange(sync);
}

/** The view, its data provider and the two commands its items use. */
export function registerSpecTree(pool: ServerPool): { provider: SpecTreeProvider; disposables: vscode.Disposable[] } {
  const provider = new SpecTreeProvider(pool);
  return {
    provider,
    disposables: [
      vscode.window.registerTreeDataProvider(VIEW_ID, provider),
      watchTree(pool, provider),
      registerOpen(),
      registerRestart(pool),
      provider,
    ],
  };
}
