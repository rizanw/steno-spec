// The two sidebar views, Specs and Steering, built from each folder's spec tree. Every node is a
// `vscode.TreeItem` it builds itself, so a provider only has to say who the children are. A node is pure
// data, which is what lets the builders below be tested without VS Code; only the Steering view looks at
// the disk, to find the agent instruction files the server does not report.
import * as vscode from 'vscode';
import type { OutlineItem, SpecTree, TreeSpec, TreeSteering } from './protocol.js';
import type { FolderServer, ServerPool } from './servers.js';
import { canApprove } from './actions.js';

const { None, Collapsed } = vscode.TreeItemCollapsibleState;

/** The command every openable node carries; `steno.open` is registered by the tree view. */
export const OPEN_COMMAND = 'steno.open';

/** The stopped folder's inline action. */
export const RESTART_COMMAND = 'steno.server.restart';

/** The Specs view, as contributed in package.json. */
export const VIEW_ID = 'steno.specs';

/** The Steering view, as contributed in package.json. */
export const STEERING_VIEW_ID = 'steno.steering';

/** Where specs live when the server did not say; only a set-up folder reaches the builders below. */
export const DEFAULT_SPECS_DIR = '.steno/specs';

/** The agent instruction files the Steering view lists when a folder has them at its root. */
const INSTRUCTION_FILES = ['AGENTS.md', 'CLAUDE.md'] as const;

/** VS Code's built-in rich Markdown editor, from the bundled markdown extension. */
const MARKDOWN_EDITOR = 'vscode.markdown.editor';

/**
 * `steno.open` with a file URI. With a 1-based line it opens the Text Editor there; without one it opens the
 * document as a whole, in the Markdown Editor when VS Code has it.
 */
function open(uri: vscode.Uri, line?: number): vscode.TreeItem['command'] {
  return { command: OPEN_COMMAND, title: 'Open', arguments: line === undefined ? [uri] : [uri, line] };
}

/** A file name without its `.md`, as the views label documents: `tasks.md` reads `tasks`. */
function bareName(file: string): string {
  return file.replace(/\.md$/i, '');
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

/** A Spec's icon: a pen while its documents are being written, a play button while its tasks run, a tick once done. */
function specIcon(spec: TreeSpec): string {
  if (spec.phase === 'done') return 'pass-filled';
  if (spec.phase === 'execute') return 'play-circle';
  return 'edit';
}

/** "18 of 19 tasks", from the required tasks only. */
function taskProgress(spec: TreeSpec): string | undefined {
  const counts = spec.tasks;
  if (!counts || counts.total === 0) return undefined;
  return `${counts.done} of ${counts.total} ${counts.total === 1 ? 'task' : 'tasks'}`;
}

/**
 * The one fact a Spec's row shows beside its title: the phase while it is being written, the required tasks
 * left while they run, nothing once it is done (its icon says so).
 */
function specDescription(spec: TreeSpec): string | undefined {
  if (spec.phase === undefined || spec.phase === 'done') return undefined;
  if (spec.phase !== 'execute') return spec.phase;
  const counts = spec.tasks;
  const left = counts ? counts.total - counts.done : 0;
  if (left <= 0) return 'all tasks done';
  return `${left} ${left === 1 ? 'task' : 'tasks'} left`;
}

/**
 * The hover of a Spec: its folder name (the row already shows the title), then `execute | 18 of 19 tasks | gated`,
 * then the next task when there is one.
 */
function specTooltip(spec: TreeSpec): string {
  const status = [spec.phase, taskProgress(spec), spec.mode]
    .filter((part): part is string => typeof part === 'string' && part.length > 0).join(' | ');
  const next = spec.next ? `next: ${spec.next.id} ${spec.next.title}` : undefined;
  return [spec.name, status, next].filter(Boolean).join('\n');
}

/** One Spec: its title with the one fact `specDescription` picks, or the reason it is Unusable. */
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
    this.iconPath = new vscode.ThemeIcon(specIcon(spec));
    this.description = specDescription(spec);
    this.tooltip = specTooltip(spec);
    // "Approve", "Write", "Review" and "Run next task" each match the phase part of this value
    this.contextValue = specContext(spec);
  }
}

/** The phases in the order a Spec moves through them. */
const PHASE_ORDER = ['brief', 'requirements', 'design', 'tasks', 'execute', 'done'] as const;

/** The phase each spec document is written in; `bugfix.md` takes the place of `requirements.md`. */
const DOCUMENT_PHASE: Record<string, 'brief' | 'requirements' | 'design' | 'tasks'> = {
  'brief.md': 'brief', 'requirements.md': 'requirements', 'bugfix.md': 'requirements', 'design.md': 'design', 'tasks.md': 'tasks',
};

/**
 * Whether a spec document's stage is behind the Spec: approved, or the Spec has moved past its phase. A quick
 * Spec records no approvals, so the phase is what tells for it; a gated one only moves on by approving.
 */
export function documentDone(spec: TreeSpec, document: string): boolean {
  const stage = DOCUMENT_PHASE[document];
  if (stage === undefined) return false;
  if (stage !== 'brief' && spec.approvals?.[stage] !== undefined) return true;
  const at = PHASE_ORDER.indexOf(spec.phase as (typeof PHASE_ORDER)[number]);
  return at > PHASE_ORDER.indexOf(stage);
}

/** A spec document's label: its name without `.md`, capitalised, so `requirements.md` reads `Requirements`. */
function documentLabel(document: string): string {
  const name = bareName(document);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** One spec document, ticked once its stage is done. `tasks.md` holds the Spec's tasks. */
export class DocNode extends vscode.TreeItem {
  readonly kind = 'doc' as const;

  constructor(readonly folder: vscode.Uri, readonly document: string, readonly uri: vscode.Uri,
    readonly children: TaskNode[] = [], readonly done = false) {
    super(documentLabel(document), children.length ? Collapsed : None);
    this.resourceUri = uri;
    // not 'file': that one means "the file icon theme's icon", which is the Markdown icon for a .md
    this.iconPath = new vscode.ThemeIcon(done ? 'pass' : 'file-text');
    this.tooltip = done ? `${document} · done` : document;
    this.contextValue = 'doc';
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

/** When a steering file reaches the coding agent, in a few words for its row and a sentence for its hover. */
function inclusionText(entry: TreeSteering): { short: string; long: string } {
  switch (entry.inclusion) {
    case 'fileMatch': {
      const files = entry.pattern ? `: ${entry.pattern.split(',').map(p => p.trim()).join(', ')}` : '';
      return { short: 'matching files', long: `Given to the agent for a task that touches matching files${files}` };
    }
    case 'manual': {
      const file = entry.path.split('/').pop() ?? entry.path;
      return { short: 'on request', long: `Never given to the agent on its own; fetch it with \`steno show steering/${file}\`` };
    }
    default: return { short: 'always on', long: 'Given to the agent with every task' };
  }
}

/** One steering file, by its name, with when it reaches the agent, or the reason it could not be read. */
export class SteeringNode extends vscode.TreeItem {
  readonly kind = 'steering-file' as const;
  readonly uri: vscode.Uri;

  constructor(readonly folder: vscode.Uri, readonly entry: TreeSteering) {
    super(bareName(entry.path.split('/').pop() ?? entry.path), None);
    this.uri = vscode.Uri.joinPath(folder, ...entry.path.split('/'));
    this.resourceUri = this.uri;
    this.command = open(this.uri);
    if (entry.unreadable) {
      this.description = 'unreadable';
      this.tooltip = `${entry.path}: ${entry.reason ?? 'could not be read'}`;
      this.iconPath = new vscode.ThemeIcon('warning');
      return;
    }
    const when = inclusionText(entry);
    this.description = when.short;
    this.tooltip = `${entry.path}\n${when.long}`;
    this.iconPath = new vscode.ThemeIcon('file-text');
    this.contextValue = 'steering.file';
  }
}

/** An agent instruction file at the folder's root, such as `AGENTS.md`, listed with the steering it sits beside. */
export class InstructionNode extends vscode.TreeItem {
  readonly kind = 'instructions' as const;

  constructor(readonly folder: vscode.Uri, readonly file: string, readonly uri: vscode.Uri) {
    super(bareName(file), None);
    this.resourceUri = uri;
    this.tooltip = `${file}: instructions your coding agent reads`;
    this.iconPath = new vscode.ThemeIcon('hubot');
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
  const dir = (tree.specsDir ?? DEFAULT_SPECS_DIR).split('/').filter(Boolean);
  return (spec.documents ?? []).map(document => {
    const uri = vscode.Uri.joinPath(folder, ...dir, spec.name, document);
    const tasks = document === 'tasks.md' ? taskNodes(spec, spec.taskItems ?? [], uri) : [];
    return new DocNode(folder, document, uri, tasks, documentDone(spec, document));
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
  return tree.specs.map(spec => new SpecNode(uri, tree, spec));
}

/** Whether a file exists; `stat` throws for one that does not. */
async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

/**
 * The items of one folder in the Steering view: the agent instruction files at its root, then its
 * steering files in the server's order.
 */
export async function steeringItems(server: FolderServer): Promise<SteeringViewNode[]> {
  const tree = server.tree;
  if (server.state === 'stopped' || !tree) return [];
  const uri = server.folder.uri;
  const found = await Promise.all(INSTRUCTION_FILES.map(async file => {
    const at = vscode.Uri.joinPath(uri, file);
    return (await exists(at)) ? new InstructionNode(uri, file, at) : undefined;
  }));
  const instructions = found.filter((node): node is InstructionNode => node !== undefined);
  return [...instructions, ...tree.steering.map(entry => new SteeringNode(uri, entry))];
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
  const watcher = vscode.workspace.createFileSystemWatcher(`**/{${INSTRUCTION_FILES.map(bareName).join(',')}}.md`, false, true, false);
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
