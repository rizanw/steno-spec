// The node builders: one folder's spec tree as tree items.
import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { ExtensionMode, Uri, commands, files, folder, handlers, markdownEditor, recorded, resetRecorded, watchers } from './vscode-stub.js';
import { PROBE_COMMAND, STEERING_PROBE_COMMAND, registerProbe, type ProbeItem } from '../src/probe.js';
import type { OutlineItem, SpecTree, TreeSpec } from '../src/protocol.js';
import { ServerPool, type CreateClient, type FolderServer, type StenoClient } from '../src/servers.js';
import {
  CAN_SET_UP, DocNode, FileNode, HAS_PROJECT, InstructionNode, RESTART_COMMAND, STEERING_VIEW_ID, SpecNode,
  SpecTreeProvider, SteeringNode, SteeringTreeProvider, StoppedNode, TaskNode, VIEW_ID, folderItems, registerSpecTree,
  shown, specChildren, specContext, steeringItems, taskContext, taskNodes, watchTree, type Node,
} from '../src/tree.js';
import { specActions, taskActions, type HostAction } from '@steno/core/host';

beforeEach(() => resetRecorded());

const ROOT = Uri.file('/work/app') as unknown as import('vscode').Uri;

function tree(over: Partial<SpecTree> = {}): SpecTree {
  return { protocolVersion: 1, specs: [], steering: [], specsDir: '.steno/specs', steeringDir: '.steno/steering', ...over };
}

function task(id: string, over: Partial<OutlineItem> = {}): OutlineItem {
  return { kind: 'task', id, title: `task ${id}`, line: 10, endLine: 10, children: [], ...over };
}

function spec(over: Partial<TreeSpec> = {}): TreeSpec {
  return {
    name: 'auth', title: 'Auth', kind: 'feature', mode: 'gated', phase: 'execute',
    tasks: { total: 4, done: 1, optionalTotal: 1, optionalDone: 0 },
    next: { id: 'T2', title: 'task T2' },
    documents: ['requirements.md', 'design.md', 'tasks.md'],
    taskItems: [task('T1', { done: true }), task('T2'), task('T3', { optional: true })],
    ...over,
  };
}

describe('SpecNode', () => {
  it('shows the title with the tasks left, and phase | progress | mode in the tooltip', () => {
    const node = new SpecNode(ROOT, tree(), spec());
    expect(node.label).toBe('Auth');
    expect(node.description).toBe('3 tasks left');
    expect((node.iconPath as { id: string }).id).toBe('play-circle');
    expect(node.tooltip).toBe('auth\nexecute | 1 of 4 tasks | gated\nnext: T2 task T2');
    expect(node.contextValue).toBe('spec.execute');
    expect(node.unusable).toBe(false);
  });

  it('shows the phase while the Spec is written, and nothing but a tick once it is done', () => {
    const writing = new SpecNode(ROOT, tree(), spec({ phase: 'design', mode: 'quick', next: null, tasks: { total: 0, done: 0, optionalTotal: 0, optionalDone: 0 } }));
    expect(writing.description).toBe('design');
    expect((writing.iconPath as { id: string }).id).toBe('edit');
    expect(writing.tooltip).toBe('auth\ndesign | quick');
    const done = new SpecNode(ROOT, tree(), spec({ phase: 'done', next: null, tasks: { total: 4, done: 4, optionalTotal: 0, optionalDone: 0 } }));
    expect(done.description).toBeUndefined();
    expect((done.iconPath as { id: string }).id).toBe('pass-filled');
    expect(done.tooltip).toBe('auth\ndone | 4 of 4 tasks | gated');
    const last = spec({ tasks: { total: 2, done: 1, optionalTotal: 0, optionalDone: 0 } });
    expect(new SpecNode(ROOT, tree(), last).description).toBe('1 task left');
    const finished = spec({ tasks: { total: 2, done: 2, optionalTotal: 0, optionalDone: 0 } });
    expect(new SpecNode(ROOT, tree(), finished).description).toBe('all tasks done');
  });

  it('falls back to the folder name when the spec has no title', () => {
    expect(new SpecNode(ROOT, tree(), spec({ title: undefined })).label).toBe('auth');
  });

  it('marks an Unusable spec with the reason and offers no action', () => {
    const bad = { name: 'old', unsupported: true, files: [{ file: '.steno/specs/old/spec.md', reason: 'unknown format' }] } as TreeSpec;
    const node = new SpecNode(ROOT, tree(), bad);
    expect(node.unusable).toBe(true);
    expect(node.label).toBe('old');
    expect(node.description).toBe('unsupported');
    expect(node.tooltip).toBe('unknown format');
    expect((node.iconPath as { id: string }).id).toBe('warning');
    expect(node.contextValue).toBeUndefined();
  });

  it('calls an unreadable spec unreadable', () => {
    const bad = { name: 'old', unreadable: true, files: [{ file: 'a.md', reason: 'EACCES' }] } as TreeSpec;
    expect(new SpecNode(ROOT, tree(), bad).description).toBe('unreadable');
  });
});

describe('specChildren', () => {
  it('lists the documents in the server order, tasks under tasks.md', () => {
    const children = specChildren(ROOT, tree(), spec());
    expect(children.map(c => c.label)).toEqual(['Requirements', 'Design', 'Tasks']);
    const docs = children as DocNode[];
    expect(docs[0].children).toEqual([]);
    expect(docs[2].children.map(t => t.taskId)).toEqual(['T1', 'T2', 'T3']);
  });

  it('opens each document as a whole, with no line, under specsDir/name', () => {
    const doc = specChildren(ROOT, tree(), spec())[0] as DocNode;
    expect(doc.command?.command).toBe('steno.open');
    expect(String(doc.command?.arguments?.[0])).toBe('file:///work/app/.steno/specs/auth/requirements.md');
    // no line: `steno.open` opens it in the Markdown Editor where VS Code has one
    expect(doc.command?.arguments).toHaveLength(1);
  });

  it('ticks a document once its stage is done, and shows the others as a page', () => {
    const approved = spec({ phase: 'tasks', approvals: { requirements: '2026-11-01', design: null } });
    const docs = specChildren(ROOT, tree(), approved) as DocNode[];
    expect(docs.map(d => (d.iconPath as { id: string }).id)).toEqual(['pass', 'pass', 'file-text']);
    expect(docs.map(d => d.tooltip)).toEqual(['requirements.md · done', 'design.md · done', 'tasks.md']);
  });

  it('honours a non-default specsDir', () => {
    const doc = specChildren(ROOT, tree({ specsDir: 'docs/specs' }), spec())[0] as DocNode;
    expect(String(doc.command?.arguments?.[0])).toBe('file:///work/app/docs/specs/auth/requirements.md');
  });

  it('gives an Unusable spec only its files', () => {
    const bad = { name: 'old', unreadable: true, files: [{ file: '.steno/specs/old/tasks.md', reason: 'EACCES' }] } as TreeSpec;
    const children = specChildren(ROOT, tree(), bad);
    expect(children).toHaveLength(1);
    const file = children[0] as FileNode;
    expect(file).toBeInstanceOf(FileNode);
    expect(file.label).toBe('.steno/specs/old/tasks.md');
    expect(file.description).toBe('EACCES');
    expect(String(file.command?.arguments?.[0])).toBe('file:///work/app/.steno/specs/old/tasks.md');
    expect(file.contextValue).toBeUndefined();
  });
});

describe('taskNodes', () => {
  it('marks done, open, optional and next', () => {
    const nodes = taskNodes(spec(), spec().taskItems!);
    expect(nodes.map(n => (n.iconPath as { id: string }).id)).toEqual(['pass', 'arrow-right', 'circle-large-outline']);
    expect(nodes.map(n => n.description)).toEqual(['', 'next', 'optional']);
  });

  it('opens a task at its own line when given the tasks.md URI', () => {
    const uri = Uri.file('/work/app/.steno/specs/auth/tasks.md') as unknown as import('vscode').Uri;
    const node = taskNodes(spec(), [task('T1', { line: 42 })], uri)[0];
    expect(node.command?.arguments?.[1]).toBe(42);
  });
});

describe('SteeringNode', () => {
  it('names each steering file without its folder or .md, with when it reaches the agent', () => {
    const nodes = [
      { path: '.steno/steering/tech.md', inclusion: 'always' as const },
      { path: '.steno/steering/api.md', inclusion: 'fileMatch' as const, pattern: 'src/api/**,src/routes/**' },
      { path: '.steno/steering/db.md', inclusion: 'manual' as const },
    ].map(entry => new SteeringNode(ROOT, entry));
    expect(nodes.map(c => c.label)).toEqual(['tech', 'api', 'db']);
    expect(nodes.map(c => c.description)).toEqual(['always on', 'matching files', 'on request']);
    expect(nodes.map(c => c.tooltip)).toEqual([
      '.steno/steering/tech.md\nGiven to the agent with every task',
      '.steno/steering/api.md\nGiven to the agent for a task that touches matching files: src/api/**, src/routes/**',
      '.steno/steering/db.md\nNever given to the agent on its own; fetch it with `steno show steering/db.md`',
    ]);
    expect((nodes[0].iconPath as { id: string }).id).toBe('file-text');
    expect(String(nodes[0].command?.arguments?.[0])).toBe('file:///work/app/.steno/steering/tech.md');
    expect(nodes[0].command?.arguments).toHaveLength(1);
  });

  it('marks an unreadable steering file with the same icon and its reason', () => {
    const node = new SteeringNode(ROOT, { path: 's/bad.md', unreadable: true, reason: 'EACCES' });
    expect(node.label).toBe('bad');
    expect((node.iconPath as { id: string }).id).toBe('warning');
    expect(node.description).toBe('unreadable');
    expect(node.tooltip).toBe('s/bad.md: EACCES');
    expect(node.contextValue).toBeUndefined();
  });
});

describe('StoppedNode', () => {
  it('names the folder and carries the restart context value', () => {
    const node = new StoppedNode(folder('/work/app') as unknown as import('vscode').WorkspaceFolder);
    expect(node.label).toBe('steno server stopped');
    expect(node.description).toBe('app');
    expect(node.contextValue).toBe('stopped');
  });
});

// --- task nodes mirror the task list ---------------------------------

const taskArb: fc.Arbitrary<OutlineItem> = fc.letrec<{ item: OutlineItem }>(tie => ({
  item: fc.record({
    kind: fc.constant('task' as const),
    id: fc.string({ minLength: 1, maxLength: 4, unit: fc.constantFrom('T', '1', '2', '.') }),
    title: fc.string({ minLength: 1, maxLength: 8 }),
    line: fc.integer({ min: 1, max: 500 }),
    endLine: fc.integer({ min: 1, max: 500 }),
    done: fc.boolean(),
    optional: fc.boolean(),
    children: fc.oneof({ maxDepth: 2 }, fc.constant<OutlineItem[]>([]), fc.array(tie('item'), { maxLength: 3 })),
  }),
})).item;

function flatten(nodes: TaskNode[]): TaskNode[] {
  return nodes.flatMap(n => [n, ...flatten(n.children)]);
}
function flattenItems(items: OutlineItem[]): OutlineItem[] {
  return items.flatMap(i => [i, ...flattenItems(i.children)]);
}

describe('task nodes mirror the task list', () => {
  it('keeps ids, order, nesting, done and optional, and marks at most one next', () => {
    fc.assert(fc.property(
      fc.array(taskArb, { maxLength: 5 }),
      fc.option(fc.string({ minLength: 1, maxLength: 4, unit: fc.constantFrom('T', '1', '2', '.') }), { nil: undefined }),
      (items, nextId) => {
        const s = spec({ taskItems: items, next: nextId === undefined ? null : { id: nextId, title: 'x' } });
        const nodes = taskNodes(s, items);
        const flatNodes = flatten(nodes);
        const flatItems = flattenItems(items);

        // ids, order and nesting
        expect(flatNodes.map(n => n.taskId)).toEqual(flatItems.map(i => i.id ?? ''));
        expect(nodes.map(n => n.children.length)).toEqual(items.map(i => i.children.length));
        // done and optional
        expect(flatNodes.map(n => n.done)).toEqual(flatItems.map(i => i.done === true));
        expect(flatNodes.map(n => n.optional)).toEqual(flatItems.map(i => i.optional === true));
        // at most one next, and it is the one whose id matches
        const marked = flatNodes.filter(n => n.next);
        expect(marked.length).toBeLessThanOrEqual(1);
        const expected = nextId === undefined ? [] : flatItems.filter(i => i.id === nextId).slice(0, 1);
        expect(marked.map(n => n.taskId)).toEqual(expected.map(i => i.id));
      },
    ));
  });
});

// --- the provider -------------------------------------------------------------------------


const silent: CreateClient = () => ({
  start: async () => {}, stop: async () => {}, sendRequest: async <T>() => undefined as T,
      onNotification: () => ({ dispose: () => {} }),
} satisfies StenoClient);

/** A pool with one started server per path, each given the tree that follows it. */
async function pooled(...folders: { path: string; tree?: SpecTree; stopped?: boolean }[]): Promise<ServerPool> {
  const pool = new ServerPool('/ext/steno-lsp.mjs', silent);
  for (const [index, f] of folders.entries()) {
    const wf = folder(f.path, index) as unknown as import('vscode').WorkspaceFolder;
    await pool.start(wf);
    const server = pool.all()[index] as FolderServer;
    if (f.tree) pool.setTree(server, f.tree);
    if (f.stopped) server.state = 'stopped';
  }
  return pool;
}

const setUp = () => tree({ specs: [spec()], steering: [{ path: '.steno/steering/tech.md', inclusion: 'always' }] });

describe('folderItems', () => {
  it('lists only the Specs: steering has a view of its own', async () => {
    const pool = await pooled({ path: '/work/a', tree: tree({ specs: [spec()], steering: [{ path: '.steno/steering/tech.md', inclusion: 'always' }] }) });
    expect(folderItems(pool.all()[0]).map(n => n.kind)).toEqual(['spec']);
  });

  it('lists the Specs in progress before the done ones', async () => {
    const specs = [spec({ name: 'a', title: 'A', phase: 'done' }), spec({ name: 'b', title: 'B' })];
    const pool = await pooled({ path: '/work/a', tree: tree({ specs }) });
    expect(folderItems(pool.all()[0]).map(n => n.label)).toEqual(['B', 'A']);
  });
});

describe('steeringItems', () => {
  it('lists AGENTS.md and CLAUDE.md found at the root first, then the steering files', async () => {
    const pool = await pooled({ path: '/work/a', tree: tree({ steering: [{ path: '.steno/steering/tech.md', inclusion: 'always' }] }) });
    files.add('file:///work/a/AGENTS.md');
    let items = await steeringItems(pool.all()[0]);
    expect(items.map(n => n.label)).toEqual(['AGENTS', 'tech']);
    expect(items[0]).toBeInstanceOf(InstructionNode);
    expect(items[0].contextValue).toBe('instructions');
    expect(String(items[0].command?.arguments?.[0])).toBe('file:///work/a/AGENTS.md');
    files.add('file:///work/a/CLAUDE.md');
    items = await steeringItems(pool.all()[0]);
    expect(items.map(n => n.label)).toEqual(['AGENTS', 'CLAUDE', 'tech']);
  });

  it('groups root instruction files, then steering, then other agents\' files, each A to Z ignoring case', async () => {
    const steering = [
      { path: '.steno/steering/tech.md', inclusion: 'always' as const },
      { path: '.steno/steering/API.md', inclusion: 'manual' as const },
      { path: '.steno/steering/product.md', inclusion: 'always' as const },
    ];
    const pool = await pooled({ path: '/work/a', tree: tree({ steering }) });
    for (const file of [
      'GEMINI.md', 'CLAUDE.md', 'AGENTS.md',
      '.github/copilot-instructions.md', '.cursorrules',
      '.cursor/rules/testing.mdc', '.cursor/rules/Api.mdc', '.cursor/rules/notes.txt', '.cursor/rules/nested/deep.mdc',
      '.github/instructions/react.instructions.md', '.github/instructions/README.md',
    ]) files.add(`file:///work/a/${file}`);
    const items = await steeringItems(pool.all()[0]);
    expect(items.map(n => n.label)).toEqual([
      'AGENTS', 'CLAUDE', 'GEMINI',
      'API', 'product', 'tech',
      '.cursor/rules/Api.mdc', '.cursor/rules/testing.mdc', '.cursorrules',
      '.github/copilot-instructions.md', '.github/instructions/react.instructions.md',
    ]);
    const last = items.at(-1) as InstructionNode;
    expect(last).toBeInstanceOf(InstructionNode);
    expect(String(last.command?.arguments?.[0])).toBe('file:///work/a/.github/instructions/react.instructions.md');
  });

  it('is empty with no steering and no instruction file, so the view shows its "Generate steering" message', async () => {
    const pool = await pooled({ path: '/work/a', tree: tree() });
    expect(await steeringItems(pool.all()[0])).toEqual([]);
  });
});

describe('SpecTreeProvider', () => {
  it('shows nothing for a folder whose server has not answered yet', async () => {
    const pool = await pooled({ path: '/work/a' });
    expect(new SpecTreeProvider(pool).getChildren()).toEqual([]);
  });

  it('hides a folder that is not a steno project', async () => {
    const pool = await pooled({ path: '/work/a', tree: tree({ notSetUp: true, specsDir: undefined }) });
    expect(new SpecTreeProvider(pool).getChildren()).toEqual([]);
    expect(shown(pool.all())).toEqual([]);
  });

  it('puts one shown folder’s items at the root', async () => {
    const pool = await pooled({ path: '/work/a', tree: setUp() }, { path: '/work/b', tree: tree({ notSetUp: true }) });
    const roots = new SpecTreeProvider(pool).getChildren();
    expect(roots.map(n => n.kind)).toEqual(['spec']);
    expect(roots.map(n => n.label)).toEqual(['Auth']);
  });

  it('groups two shown folders under one FolderNode each', async () => {
    const pool = await pooled({ path: '/work/a', tree: setUp() }, { path: '/work/b', tree: setUp() });
    const provider = new SpecTreeProvider(pool);
    const roots = provider.getChildren();
    expect(roots.map(n => n.kind)).toEqual(['folder', 'folder']);
    expect(roots.map(n => n.label)).toEqual(['a', 'b']);
    expect(roots[0].contextValue).toBe('folder.project');
    // the same object every time, so a refresh can name the subtree the view already holds
    expect(provider.getChildren()[0]).toBe(roots[0]);
    expect(provider.getChildren(roots[0]).map(n => n.label)).toEqual(['Auth']);
  });

  it('shows a stopped folder stopped instead of its specs', async () => {
    const pool = await pooled({ path: '/work/a', tree: setUp(), stopped: true });
    const roots = new SpecTreeProvider(pool).getChildren();
    expect(roots.map(n => n.kind)).toEqual(['stopped']);
    expect(roots[0].contextValue).toBe('stopped');
  });

  it('hands the spec, document and task children down', async () => {
    const pool = await pooled({ path: '/work/a', tree: setUp() });
    const provider = new SpecTreeProvider(pool);
    const specNode = provider.getChildren()[0];
    const docs = provider.getChildren(specNode);
    expect(docs.map(n => n.label)).toEqual(['Requirements', 'Design', 'Tasks']);
    const tasks = provider.getChildren(docs[2]);
    expect(tasks.map(n => (n as TaskNode).taskId)).toEqual(['T1', 'T2', 'T3']);
    expect(provider.getChildren(tasks[0])).toEqual([]);
  });
});

describe('SteeringTreeProvider', () => {
  it('puts one project\'s steering at the root, and groups two projects per folder', async () => {
    const one = await pooled({ path: '/work/a', tree: tree({ steering: [{ path: '.steno/steering/tech.md', inclusion: 'always' }] }) });
    expect((await new SteeringTreeProvider(one).getChildren()).map(n => n.label)).toEqual(['tech']);
    const two = await pooled({ path: '/work/a', tree: setUp() }, { path: '/work/b', tree: setUp() });
    const provider = new SteeringTreeProvider(two);
    const roots = await provider.getChildren();
    expect(roots.map(n => n.label)).toEqual(['a', 'b']);
    expect(roots[0].contextValue).toBe('folder.project');
    expect((await provider.getChildren(roots[0])).map(n => n.label)).toEqual(['tech']);
  });

  it('leaves out a stopped folder, whose restart the Specs view offers', async () => {
    const pool = await pooled({ path: '/work/a', tree: setUp(), stopped: true });
    expect(await new SteeringTreeProvider(pool).getChildren()).toEqual([]);
  });
});

describe('the view commands', () => {
  it('registers both views and opens a document at a 1-based line', async () => {
    const pool = await pooled({ path: '/work/a', tree: setUp() });
    const { provider, steering } = registerSpecTree(pool);
    expect(recorded.views[VIEW_ID]).toBe(provider);
    expect(recorded.views[STEERING_VIEW_ID]).toBe(steering);
    markdownEditor.available = true;
    await commands.executeCommand('steno.open', Uri.file('/work/a/.steno/specs/auth/tasks.md'), 7);
    expect(recorded.opened).toEqual([{ uri: 'file:///work/a/.steno/specs/auth/tasks.md', line: 7 }]);
  });

  it('opens a Markdown document with no line in the Markdown Editor', async () => {
    const pool = await pooled({ path: '/work/a', tree: setUp() });
    registerSpecTree(pool);
    markdownEditor.available = true;
    const uri = Uri.file('/work/a/.steno/specs/auth/design.md');
    await commands.executeCommand('steno.open', uri);
    expect(recorded.commands.at(-1)).toEqual({ command: 'vscode.openWith', args: [uri, 'vscode.markdown.editor'] });
    expect(recorded.opened).toEqual([]);
  });

  it('falls back to the Text Editor at line 1 without a Markdown Editor, or for a file that is not Markdown', async () => {
    const pool = await pooled({ path: '/work/a', tree: setUp() });
    registerSpecTree(pool);
    await commands.executeCommand('steno.open', Uri.file('/work/a/.steno/specs/auth/design.md'));
    markdownEditor.available = true;
    await commands.executeCommand('steno.open', Uri.file('/work/a/.steno/specs/auth/spec.yaml'));
    expect(recorded.opened).toEqual([
      { uri: 'file:///work/a/.steno/specs/auth/design.md', line: 1 },
      { uri: 'file:///work/a/.steno/specs/auth/spec.yaml', line: 1 },
    ]);
    expect(recorded.commands.some(c => c.command === 'vscode.openWith')).toBe(false);
  });

  it('redraws the Steering view when an agent instruction file appears or goes', async () => {
    const pool = await pooled({ path: '/work/a', tree: setUp() });
    const { steering } = registerSpecTree(pool);
    const fired: unknown[] = [];
    steering.onDidChangeTreeData(e => fired.push(e));
    const watcher = watchers.find(w => w.pattern === '**/{AGENTS.md,CLAUDE.md,GEMINI.md,.cursorrules,'
      + '.github/copilot-instructions.md,.cursor/rules/*.mdc,.github/instructions/*.instructions.md}')!;
    watcher.fire.created.fire(Uri.file('/work/a/AGENTS.md'));
    watcher.fire.deleted.fire(Uri.file('/work/a/AGENTS.md'));
    expect(fired).toEqual([undefined, undefined]);
  });

  it('restarts the stopped folder from its inline action', async () => {
    const pool = await pooled({ path: '/work/a', tree: setUp(), stopped: true });
    registerSpecTree(pool);
    const node = new SpecTreeProvider(pool).getChildren()[0] as StoppedNode;
    await commands.executeCommand(RESTART_COMMAND, node);
    expect(pool.all()[0].state).toBe('running');
  });
});

describe('watchTree', () => {
  /** The nodes `onDidChangeTreeData` fired with; `undefined` means the whole tree. */
  function watching(pool: ServerPool): { provider: SpecTreeProvider; fired: (Node | undefined)[] } {
    const provider = new SpecTreeProvider(pool);
    const fired: (Node | undefined)[] = [];
    provider.onDidChangeTreeData(node => fired.push(node));
    watchTree(pool, provider);
    return { provider, fired };
  }

  it('redraws the whole tree when the set of shown folders changes', async () => {
    const pool = await pooled({ path: '/work/a' }, { path: '/work/b' });
    const { provider, fired } = watching(pool);
    pool.setTree(pool.all()[0], setUp());       // /work/a becomes shown
    expect(fired).toEqual([undefined]);
    pool.setTree(pool.all()[1], setUp());       // /work/b joins it
    expect(fired).toEqual([undefined, undefined]);
    // with both shown and the set unchanged, only that folder's subtree is redrawn
    pool.setTree(pool.all()[1], setUp());
    expect(fired[2]).toBe(provider.folderNode(pool.all()[1]));
  });

  it('redraws the whole tree while one folder is shown, whose items sit at the root', async () => {
    const pool = await pooled({ path: '/work/a', tree: setUp() });
    const { fired } = watching(pool);
    pool.setTree(pool.all()[0], setUp());
    expect(fired).toEqual([undefined]);
  });

  it('redraws the whole tree when a folder is removed', async () => {
    const pool = await pooled({ path: '/work/a', tree: setUp() }, { path: '/work/b', tree: setUp() });
    const { fired } = watching(pool);
    await pool.stop(pool.all()[1].folder);
    expect(fired).toEqual([undefined]);
  });

  it('sets steno.hasProject from the folders that have answered', async () => {
    const pool = await pooled({ path: '/work/a' });
    watching(pool);
    expect(recorded.context[HAS_PROJECT]).toBe(false);
    pool.setTree(pool.all()[0], tree({ notSetUp: true }));
    expect(recorded.context[HAS_PROJECT]).toBe(false);
    pool.setTree(pool.all()[0], setUp());
    expect(recorded.context[HAS_PROJECT]).toBe(true);
  });

  it('sets steno.canSetUp exactly while some folder\'s tree has notSetUp', async () => {
    const pool = await pooled({ path: '/work/a' }, { path: '/work/b', tree: setUp() });
    watching(pool);
    // a folder that has not answered says nothing yet
    expect(recorded.context[CAN_SET_UP]).toBe(false);
    pool.setTree(pool.all()[0], tree({ notSetUp: true }));
    expect(recorded.context[CAN_SET_UP]).toBe(true);
    expect(recorded.context[HAS_PROJECT]).toBe(true);
    pool.setTree(pool.all()[0], setUp());
    expect(recorded.context[CAN_SET_UP]).toBe(false);
  });
});

// --- the end-to-end probe ----------------------------------------------------------------------

describe('the test-run tree probe', () => {
  it('offers both views as plain data, in a test run only', async () => {
    const pool = await pooled({ path: '/work/a', tree: { ...setUp(), steering: [{ path: '.steno/steering/tech.md', inclusion: 'always' }] } });
    const provider = new SpecTreeProvider(pool);
    const steering = new SteeringTreeProvider(pool);
    expect(registerProbe(ExtensionMode.Production, provider, steering)).toEqual([]);
    expect(handlers.has(PROBE_COMMAND)).toBe(false);
    expect(handlers.has(STEERING_PROBE_COMMAND)).toBe(false);
    registerProbe(ExtensionMode.Test, provider, steering);
    const items = (await commands.executeCommand(PROBE_COMMAND)) as ProbeItem[];
    expect(items.map(i => i.label)).toEqual(['Auth']);
    expect(items[0]).toMatchObject({ description: '3 tasks left', contextValue: 'spec.execute' });
    const steered = (await commands.executeCommand(STEERING_PROBE_COMMAND)) as ProbeItem[];
    expect(steered).toEqual([{ label: 'tech', description: 'always on', contextValue: 'steering.file', children: [] }]);
    const tasks = items[0].children.find(c => c.label === 'Tasks')!.children;
    expect(tasks.map(t => [t.label, t.contextValue])).toEqual([
      ['task T1', 'task.done'], ['task T2', 'task.open.run'], ['task T3', 'task.open.run'],
    ]);
    // plain data: nothing in it can be called back into
    expect(JSON.parse(JSON.stringify(items))).toEqual(items);
  });
});

// --- handoff offers --------------------------------------------------------------------------------

/** The `viewItem` part of a menu's `when` clause, run against a context value as VS Code would. */
function matcher(when: string): (value: string | undefined) => boolean {
  const regex = /viewItem =~ \/(.*)\/$/.exec(when);
  if (regex) { const re = new RegExp(regex[1]); return v => v !== undefined && re.test(v); }
  const equal = /viewItem == (\S+)/.exec(when);
  if (equal) return v => v === equal[1];
  throw new Error(`no viewItem in ${when}`);
}

describe('context values for the handoffs', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const menus: { command: string; when: string; group?: string }[] = manifest.contributes.menus['view/item/context'];
  const menu = (command: string) => matcher(menus.find(m => m.command === command)!.when);
  const PHASES = ['brief', 'requirements', 'design', 'tasks', 'execute', 'done'] as const;
  const anySpec = fc.record({
    name: fc.constant('s'),
    mode: fc.option(fc.constantFrom('gated', 'quick'), { nil: undefined }),
    phase: fc.option(fc.constantFrom(...PHASES), { nil: undefined }),
    unsupported: fc.option(fc.constant(true as const), { nil: undefined }),
    unreadable: fc.option(fc.constant(true as const), { nil: undefined }),
  }) as fc.Arbitrary<TreeSpec>;

  // each row menu's command, by the action it stands for
  const SPEC_MENUS: Record<string, HostAction> = {
    'steno.spec.approve': 'approve', 'steno.spec.write': 'write', 'steno.spec.review': 'review', 'steno.spec.runNext': 'runNext',
  };
  const TASK_MENUS: Record<string, HostAction> = { 'steno.task.markDone': 'done', 'steno.task.reopen': 'reopen', 'steno.task.run': 'run' };

  it('names every spec and task row menu in the action table', () => {
    const rowMenus = menus.map(m => m.command)
      .filter(c => !['steno.spec.new', 'steno.server.restart', 'steno.steering.generate'].includes(c));
    expect(rowMenus.sort()).toEqual([...Object.keys(SPEC_MENUS), ...Object.keys(TASK_MENUS)].sort());
  });

  it('each spec menu matches a spec row exactly when the spec offers its action', () => {
    fc.assert(fc.property(anySpec, s => {
      const value = new SpecNode(ROOT, tree(), s).contextValue;
      const actions = specActions(s);
      for (const [command, action] of Object.entries(SPEC_MENUS)) expect(menu(command)(value), command).toBe(actions.includes(action));
      if (actions.length > 0) expect(value).toBe(specContext(s));
    }));
  });

  it('each task menu matches a task row exactly when the task offers its action', () => {
    fc.assert(fc.property(anySpec, fc.boolean(), fc.boolean(), (s, done, leaf) => {
      const value = taskContext(s, done, leaf);
      const actions = taskActions(s, done, leaf);
      for (const [command, action] of Object.entries(TASK_MENUS)) expect(menu(command)(value), command).toBe(actions.includes(action));
    }));
  });

  it('gives a parent task plain task.open, so only its subtasks can run', () => {
    const parent = task('T1', { children: [task('T1.1')] });
    const [node] = taskNodes(spec({ taskItems: [parent] }), [parent]);
    expect(node.contextValue).toBe('task.open');
    expect(node.children[0].contextValue).toBe('task.open.run');
  });

  it('offers "Generate steering" inline on a project folder of the Steering view', async () => {
    const steer = menus.find(m => m.command === 'steno.steering.generate')!;
    expect(steer.group).toBe('inline');
    expect(steer.when).toContain('view == steno.steering');
    const pool = await pooled({ path: '/work/a', tree: setUp() }, { path: '/work/b', tree: setUp() });
    const [folderNode] = await new SteeringTreeProvider(pool).getChildren();
    expect(menu('steno.steering.generate')(folderNode.contextValue)).toBe(true);
  });
});
