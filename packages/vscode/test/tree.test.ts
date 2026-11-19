// The node builders: one folder's spec tree as tree items.
import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { canApprove } from '../src/actions.js';
import { ExtensionMode, Uri, commands, folder, handlers, recorded, resetRecorded } from './vscode-stub.js';
import { PROBE_COMMAND, registerProbe, type ProbeItem } from '../src/probe.js';
import type { OutlineItem, SpecTree, TreeSpec } from '../src/protocol.js';
import { ServerPool, type CreateClient, type FolderServer, type StenoClient } from '../src/servers.js';
import {
  DocNode, FileNode, HAS_PROJECT, RESTART_COMMAND, SpecNode, SpecTreeProvider, StoppedNode,
  SteeringGroupNode, TaskNode, VIEW_ID, folderItems, registerSpecTree, runnable, shown, specChildren, specContext,
  taskContext, taskNodes, unusable, watchTree, type Node,
} from '../src/tree.js';

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
  it('shows the title and phase · mode · done/total (R3.1)', () => {
    const node = new SpecNode(ROOT, tree(), spec());
    expect(node.label).toBe('Auth');
    expect(node.description).toBe('execute · gated · 1/4');
    expect(node.contextValue).toBe('spec.execute');
    expect(node.unusable).toBe(false);
  });

  it('falls back to the folder name when the spec has no title', () => {
    expect(new SpecNode(ROOT, tree(), spec({ title: undefined })).label).toBe('auth');
  });

  it('marks an Unusable spec with the reason and offers no action (R3.5)', () => {
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
  it('lists the documents in the server order, tasks under tasks.md (R3.1)', () => {
    const children = specChildren(ROOT, tree(), spec());
    expect(children.map(c => c.label)).toEqual(['requirements.md', 'design.md', 'tasks.md']);
    const docs = children as DocNode[];
    expect(docs[0].children).toEqual([]);
    expect(docs[2].children.map(t => t.taskId)).toEqual(['T1', 'T2', 'T3']);
  });

  it('opens each document at line 1 under specsDir/name (R3.8)', () => {
    const doc = specChildren(ROOT, tree(), spec())[0] as DocNode;
    expect(doc.command?.command).toBe('steno.open');
    expect(String(doc.command?.arguments?.[0])).toBe('file:///work/app/.steno/specs/auth/requirements.md');
    expect(doc.command?.arguments?.[1]).toBe(1);
  });

  it('honours a non-default specsDir', () => {
    const doc = specChildren(ROOT, tree({ specsDir: 'docs/specs' }), spec())[0] as DocNode;
    expect(String(doc.command?.arguments?.[0])).toBe('file:///work/app/docs/specs/auth/requirements.md');
  });

  it('gives an Unusable spec only its files (R3.5)', () => {
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
  it('marks done, open, optional and next (R3.2)', () => {
    const nodes = taskNodes(spec(), spec().taskItems!);
    expect(nodes.map(n => (n.iconPath as { id: string }).id)).toEqual(['pass', 'arrow-right', 'circle-large-outline']);
    expect(nodes.map(n => n.description)).toEqual(['', 'next', 'optional']);
  });

  it('opens a task at its own line when given the tasks.md URI (R3.8)', () => {
    const uri = Uri.file('/work/app/.steno/specs/auth/tasks.md') as unknown as import('vscode').Uri;
    const node = taskNodes(spec(), [task('T1', { line: 42 })], uri)[0];
    expect(node.command?.arguments?.[1]).toBe(42);
  });
});

describe('SteeringGroupNode', () => {
  it('lists each steering file with its inclusion mode (R3.3)', () => {
    const group = new SteeringGroupNode(ROOT, tree({
      steering: [{ path: '.steno/steering/tech.md', inclusion: 'always' }, { path: '.steno/steering/api.md', inclusion: 'fileMatch' }],
    }));
    expect(group.label).toBe('Steering');
    expect(group.children.map(c => c.label)).toEqual(['.steno/steering/tech.md', '.steno/steering/api.md']);
    expect(group.children.map(c => c.description)).toEqual(['always', 'fileMatch']);
    expect(String(group.children[0].command?.arguments?.[0])).toBe('file:///work/app/.steno/steering/tech.md');
  });

  it('marks an unreadable steering file with the same icon and its reason (R3.5)', () => {
    const group = new SteeringGroupNode(ROOT, tree({ steering: [{ path: 's/bad.md', unreadable: true, reason: 'EACCES' }] }));
    const node = group.children[0];
    expect((node.iconPath as { id: string }).id).toBe('warning');
    expect(node.description).toBe('unreadable');
    expect(node.tooltip).toBe('EACCES');
    expect(node.contextValue).toBeUndefined();
  });
});

describe('StoppedNode', () => {
  it('names the folder and carries the restart context value (R1.4)', () => {
    const node = new StoppedNode(folder('/work/app') as unknown as import('vscode').WorkspaceFolder);
    expect(node.label).toBe('steno server stopped');
    expect(node.description).toBe('app');
    expect(node.contextValue).toBe('stopped');
  });
});

// --- Property 3: task nodes mirror the task list (D-prop-3) ---------------------------------

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

describe('Property 3: task nodes mirror the task list', () => {
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
  it('always ends a set-up folder with the Steering group, even with no steering file yet (R1.6)', async () => {
    const pool = await pooled({ path: '/work/a', tree: tree({ specs: [spec()] }) });
    const items = folderItems(pool.all()[0]);
    expect(items.map(n => n.kind)).toEqual(['spec', 'steering-group']);
    expect(items[1].contextValue).toBe('steering');
    expect((items[1] as SteeringGroupNode).children).toEqual([]);
  });
});

describe('SpecTreeProvider', () => {
  it('shows nothing for a folder whose server has not answered yet (R3.4)', async () => {
    const pool = await pooled({ path: '/work/a' });
    expect(new SpecTreeProvider(pool).getChildren()).toEqual([]);
  });

  it('hides a folder that is not a steno project (R3.4)', async () => {
    const pool = await pooled({ path: '/work/a', tree: tree({ notSetUp: true, specsDir: undefined }) });
    expect(new SpecTreeProvider(pool).getChildren()).toEqual([]);
    expect(shown(pool.all())).toEqual([]);
  });

  it('puts one shown folder’s items at the root, Steering last (R3.3, R3.4)', async () => {
    const pool = await pooled({ path: '/work/a', tree: setUp() }, { path: '/work/b', tree: tree({ notSetUp: true }) });
    const roots = new SpecTreeProvider(pool).getChildren();
    expect(roots.map(n => n.kind)).toEqual(['spec', 'steering-group']);
    expect(roots.map(n => n.label)).toEqual(['Auth', 'Steering']);
  });

  it('groups two shown folders under one FolderNode each (R3.4)', async () => {
    const pool = await pooled({ path: '/work/a', tree: setUp() }, { path: '/work/b', tree: setUp() });
    const provider = new SpecTreeProvider(pool);
    const roots = provider.getChildren();
    expect(roots.map(n => n.kind)).toEqual(['folder', 'folder']);
    expect(roots.map(n => n.label)).toEqual(['a', 'b']);
    expect(roots[0].contextValue).toBe('folder.project');
    // the same object every time, so a refresh can name the subtree the view already holds
    expect(provider.getChildren()[0]).toBe(roots[0]);
    expect(provider.getChildren(roots[0]).map(n => n.label)).toEqual(['Auth', 'Steering']);
  });

  it('shows a stopped folder stopped instead of its specs (R1.4)', async () => {
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
    expect(docs.map(n => n.label)).toEqual(['requirements.md', 'design.md', 'tasks.md']);
    const tasks = provider.getChildren(docs[2]);
    expect(tasks.map(n => (n as TaskNode).taskId)).toEqual(['T1', 'T2', 'T3']);
    expect(provider.getChildren(tasks[0])).toEqual([]);
  });
});

describe('the view commands', () => {
  it('registers the view and opens a document at a 1-based line (R3.8)', async () => {
    const pool = await pooled({ path: '/work/a', tree: setUp() });
    const { provider } = registerSpecTree(pool);
    expect(recorded.views[VIEW_ID]).toBe(provider);
    await commands.executeCommand('steno.open', Uri.file('/work/a/.steno/specs/auth/tasks.md'), 7);
    expect(recorded.opened).toEqual([{ uri: 'file:///work/a/.steno/specs/auth/tasks.md', line: 7 }]);
  });

  it('restarts the stopped folder from its inline action (R1.4)', async () => {
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

  it('redraws the whole tree when the set of shown folders changes (R3.6)', async () => {
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

  it('redraws the whole tree while one folder is shown, whose items sit at the root (R3.4, R3.6)', async () => {
    const pool = await pooled({ path: '/work/a', tree: setUp() });
    const { fired } = watching(pool);
    pool.setTree(pool.all()[0], setUp());
    expect(fired).toEqual([undefined]);
  });

  it('redraws the whole tree when a folder is removed (R3.6)', async () => {
    const pool = await pooled({ path: '/work/a', tree: setUp() }, { path: '/work/b', tree: setUp() });
    const { fired } = watching(pool);
    await pool.stop(pool.all()[1].folder);
    expect(fired).toEqual([undefined]);
  });

  it('sets steno.hasProject from the folders that have answered (R3.7)', async () => {
    const pool = await pooled({ path: '/work/a' });
    watching(pool);
    expect(recorded.context[HAS_PROJECT]).toBe(false);
    pool.setTree(pool.all()[0], tree({ notSetUp: true }));
    expect(recorded.context[HAS_PROJECT]).toBe(false);
    pool.setTree(pool.all()[0], setUp());
    expect(recorded.context[HAS_PROJECT]).toBe(true);
  });
});

// --- the end-to-end probe ----------------------------------------------------------------------

describe('the test-run tree probe', () => {
  it('offers the whole tree as plain data, in a test run only (R5.3)', async () => {
    const pool = await pooled({ path: '/work/a', tree: setUp() });
    const provider = new SpecTreeProvider(pool);
    expect(registerProbe(ExtensionMode.Production, provider)).toEqual([]);
    expect(handlers.has(PROBE_COMMAND)).toBe(false);
    registerProbe(ExtensionMode.Test, provider);
    const items = (await commands.executeCommand(PROBE_COMMAND)) as ProbeItem[];
    expect(items.map(i => i.label)).toEqual(['Auth', 'Steering']);
    expect(items[0]).toMatchObject({ description: 'execute · gated · 1/4', contextValue: 'spec.execute' });
    const tasks = items[0].children.find(c => c.label === 'tasks.md')!.children;
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

  it('Property 3: each menu matches a Spec exactly in the phases its criterion names, never an Unusable one', () => {
    const write = menu('steno.spec.write');
    const review = menu('steno.spec.review');
    const runNext = menu('steno.spec.runNext');
    const approve = menu('steno.spec.approve');
    fc.assert(fc.property(anySpec, s => {
      const value = new SpecNode(ROOT, tree(), s).contextValue;
      const usable = !unusable(s);
      const inPhase = (...phases: string[]) => usable && phases.includes(s.phase ?? '');
      expect(write(value)).toBe(inPhase('brief', 'requirements', 'design', 'tasks'));
      expect(review(value)).toBe(inPhase('requirements', 'design', 'tasks', 'done'));
      expect(runNext(value)).toBe(inPhase('execute'));
      expect(approve(value)).toBe(canApprove(s));
      if (usable) expect(value).toBe(specContext(s));
    }));
  });

  it('Property 3: "Run" matches an open task without subtasks of a usable Spec in execute, "Mark done" every open task (R1.1)', () => {
    const run = menu('steno.task.run');
    const markDone = menu('steno.task.markDone');
    const reopen = menu('steno.task.reopen');
    fc.assert(fc.property(anySpec, fc.boolean(), fc.boolean(), (s, done, leaf) => {
      const value = taskContext(s, done, leaf);
      expect(run(value)).toBe(!done && leaf && !unusable(s) && s.phase === 'execute');
      expect(markDone(value)).toBe(!done);
      expect(reopen(value)).toBe(done);
    }));
  });

  it('gives a parent task plain task.open, so only its subtasks can run', () => {
    const parent = task('T1', { children: [task('T1.1')] });
    const [node] = taskNodes(spec({ taskItems: [parent] }), [parent]);
    expect(node.contextValue).toBe('task.open');
    expect(node.children[0].contextValue).toBe('task.open.run');
  });

  it('offers "Generate steering" inline on the Steering group (R1.6)', () => {
    const steer = menus.find(m => m.command === 'steno.steering.generate')!;
    expect(steer.group).toBe('inline');
    expect(menu('steno.steering.generate')(new SteeringGroupNode(ROOT, tree()).contextValue)).toBe(true);
  });

  it('runnable follows the tree: an open leaf task of a Spec in execute, nothing it does not know', () => {
    const t = tree({ specs: [spec({ taskItems: [task('T1', { done: true }), task('T2', { children: [task('T2.1')] })] })] });
    expect(runnable(t, 'auth', 'T2.1')).toBe(true);
    expect(runnable(t, 'auth', 'T2')).toBe(false);
    expect(runnable(t, 'auth', 'T1')).toBe(false);
    expect(runnable(t, 'auth', 'T9')).toBe(false);
    expect(runnable(t, 'other', 'T2.1')).toBe(false);
    expect(runnable(undefined, 'auth', 'T2.1')).toBe(false);
    expect(runnable(tree({ specs: [spec({ phase: 'tasks', taskItems: [task('T1')] })] }), 'auth', 'T1')).toBe(false);
  });
});
