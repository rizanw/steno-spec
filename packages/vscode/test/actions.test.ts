// Approve, mark done and reopen: offered on the right nodes, sent to the folder's server, refusals shown.
import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { Uri, answers, commands, folder, handlers, openDocument, recorded, resetRecorded } from './vscode-stub.js';
import type { OutlineItem, SpecTree, TreeSpec } from '../src/protocol.js';
import { ServerPool, type CreateClient } from '../src/servers.js';
import { SpecNode, TaskNode } from '../src/tree.js';
import {
  APPROVE_COMMAND, DONE_LENS_COMMAND, MARK_DONE_COMMAND, REOPEN_COMMAND, canApprove, registerActions,
} from '../src/actions.js';

beforeEach(() => resetRecorded());

const ROOT = Uri.file('/work/app');
const TASKS = Uri.joinPath(ROOT, '.steno', 'specs', 'auth', 'tasks.md');
const vsUri = (u: Uri) => u as unknown as import('vscode').Uri;

function tree(): SpecTree {
  return { protocolVersion: 1, specs: [], steering: [] };
}

function spec(over: Partial<TreeSpec> = {}): TreeSpec {
  return { name: 'auth', title: 'Auth', kind: 'feature', mode: 'gated', phase: 'requirements', ...over };
}

function item(id: string, done: boolean): OutlineItem {
  return { kind: 'task', id, title: `task ${id}`, line: 5, endLine: 5, children: [], done };
}

/** A pool with one running folder whose client records each request and answers with `answer`. */
async function pooled(answer: (method: string, params: unknown, call: number) => unknown = () => ({ protocolVersion: 1, spec: 'auth', phase: 'design' })) {
  const sent: { method: string; params: unknown }[] = [];
  const create: CreateClient = () => ({
    start: async () => {},
    stop: async () => {},
    sendRequest: async <T>(method: string, params?: unknown) => {
      sent.push({ method, params });
      const out = answer(method, params, sent.length);
      if (out instanceof Error) throw out;
      return out as T;
    },
    onNotification: () => ({ dispose: () => {} }),
  });
  const pool = new ServerPool('/ext/dist/steno-lsp.mjs', create);
  await pool.start(folder('/work/app'));
  registerActions(pool);
  // the pool asks for the first tree on start; only the state changes matter here
  await new Promise(resolve => setImmediate(resolve));
  sent.length = 0;
  return { pool, sent };
}

const PHASES = ['brief', 'requirements', 'design', 'tasks', 'execute', 'done'] as const;

describe('canApprove', () => {
  it('Approve is offered on exactly the approvable Specs', () => {
    const anySpec = fc.record({
      name: fc.constant('s'),
      mode: fc.option(fc.constantFrom('gated', 'quick'), { nil: undefined }),
      phase: fc.option(fc.constantFrom(...PHASES), { nil: undefined }),
      unsupported: fc.option(fc.constant(true as const), { nil: undefined }),
      unreadable: fc.option(fc.constant(true as const), { nil: undefined }),
    });
    fc.assert(fc.property(anySpec, s => {
      const expected = !s.unsupported && !s.unreadable && s.mode === 'gated'
        && ['brief', 'requirements', 'design', 'tasks'].includes(s.phase ?? '');
      expect(canApprove(s as TreeSpec)).toBe(expected);
      // the tree's context value follows the same rule: only a value ending in `.approvable` carries the inline "Approve"
      const node = new SpecNode(vsUri(ROOT), tree(), s as TreeSpec);
      expect(/^spec\..*\.approvable$/.test(node.contextValue ?? '')).toBe(expected);
    }));
  });
});

describe('approve', () => {
  it('sends steno/approve with the current phase and shows the phase that follows', async () => {
    const { sent } = await pooled();
    await commands.executeCommand(APPROVE_COMMAND, new SpecNode(vsUri(ROOT), tree(), spec()));
    expect(sent).toEqual([{ method: 'steno/approve', params: { spec: 'auth', phase: 'requirements' } }]);
    expect(recorded.info).toEqual(['auth: requirements approved — now in design']);
  });

  it('does nothing unless its argument is a SpecNode, so no other caller can approve', async () => {
    const { sent } = await pooled();
    const forged = { kind: 'spec', folder: ROOT, spec: spec(), tree: tree() };
    await commands.executeCommand(APPROVE_COMMAND, forged);
    await commands.executeCommand(APPROVE_COMMAND);
    expect(sent).toEqual([]);
  });

  it('sends nothing for a Spec that cannot be approved', async () => {
    const { sent } = await pooled();
    await commands.executeCommand(APPROVE_COMMAND, new SpecNode(vsUri(ROOT), tree(), spec({ phase: 'execute' })));
    expect(sent).toEqual([]);
  });

  it('shows a refusal, and "Save and retry" sends the approval again', async () => {
    const file = '/work/app/.steno/specs/auth/requirements.md';
    const refusal = Object.assign(new Error('unsaved'), { data: { protocolVersion: 1, code: 'unsaved-edits', message: 'unsaved', file } });
    const { sent } = await pooled((_m, _p, call) => call === 1 ? refusal : { protocolVersion: 1, spec: 'auth', phase: 'design' });
    openDocument(Uri.file(file));
    answers.message = 'Save and retry';
    await commands.executeCommand(APPROVE_COMMAND, new SpecNode(vsUri(ROOT), tree(), spec()));
    expect(recorded.saved).toEqual([`file://${file}`]);
    expect(sent.map(s => s.method)).toEqual(['steno/approve', 'steno/approve']);
    expect(recorded.info).toEqual(['auth: requirements approved — now in design']);
  });

  it('tells the user the server is stopped instead of sending', async () => {
    const { pool, sent } = await pooled();
    pool.all()[0].state = 'stopped';
    await commands.executeCommand(APPROVE_COMMAND, new SpecNode(vsUri(ROOT), tree(), spec()));
    expect(sent).toEqual([]);
    expect(recorded.error).toEqual(['steno server for app is stopped, so nothing changed']);
  });
});

describe('mark done and reopen', () => {
  const taskNode = (done: boolean) => new TaskNode(spec({ phase: 'execute' }), item('T1', done), [], false, vsUri(TASKS));

  it('gives open and done tasks the context values their menu items match', () => {
    // an open task of a Spec in `execute` also offers "Run", so its value is `task.open.run`; "Mark done" matches both
    expect(taskNode(false).contextValue).toBe('task.open.run');
    expect(new TaskNode(spec({ phase: 'tasks' }), item('T1', false), [], false, vsUri(TASKS)).contextValue).toBe('task.open');
    expect(taskNode(true).contextValue).toBe('task.done');
  });

  it('marks an open task done through the server', async () => {
    const { sent } = await pooled();
    await commands.executeCommand(MARK_DONE_COMMAND, taskNode(false));
    expect(sent).toEqual([{ method: 'steno/taskDone', params: { spec: 'auth', task: 'T1' } }]);
  });

  it('asks in a modal before it reopens, and sends nothing when the user says no', async () => {
    const { sent } = await pooled();
    await commands.executeCommand(REOPEN_COMMAND, taskNode(true));
    expect(recorded.modal).toEqual(['Reopen T1 of auth?']);
    expect(sent).toEqual([]);
    answers.message = 'Reopen';
    await commands.executeCommand(REOPEN_COMMAND, taskNode(true));
    expect(sent).toEqual([{ method: 'steno/taskReopen', params: { spec: 'auth', task: 'T1' } }]);
  });

  it('shows the findings of a refused change', async () => {
    const refusal = Object.assign(new Error('x'), { data: { protocolVersion: 1, code: 'not-found', message: 'unknown task T1' } });
    await pooled(() => refusal);
    await commands.executeCommand(MARK_DONE_COMMAND, taskNode(false));
    expect(recorded.error).toEqual(['unknown task T1']);
  });
});

describe('the done lens', () => {
  it('reopens the task in the folder that holds the document, after the same confirmation', async () => {
    const { sent } = await pooled();
    answers.message = 'Reopen';
    await commands.executeCommand(DONE_LENS_COMMAND, { spec: 'auth', task: 'T2', optional: false, uri: TASKS });
    expect(recorded.modal).toEqual(['Reopen T2 of auth?']);
    expect(sent).toEqual([{ method: 'steno/taskReopen', params: { spec: 'auth', task: 'T2' } }]);
  });

  it('ignores a lens without the URI the middleware adds', async () => {
    const { sent } = await pooled();
    answers.message = 'Reopen';
    await commands.executeCommand(DONE_LENS_COMMAND, { spec: 'auth', task: 'T2', optional: false });
    expect(recorded.modal).toEqual([]);
    expect(sent).toEqual([]);
  });
});

describe('the manifest', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const ACTIONS = [APPROVE_COMMAND, MARK_DONE_COMMAND, REOPEN_COMMAND, DONE_LENS_COMMAND];

  it('keeps every action out of the command palette', () => {
    const hidden = manifest.contributes.menus.commandPalette
      .filter((m: { when: string }) => m.when === 'false').map((m: { command: string }) => m.command);
    for (const command of ACTIONS) expect(hidden).toContain(command);
  });

  it('hangs each inline action off its own context value', () => {
    const inline = Object.fromEntries(manifest.contributes.menus['view/item/context']
      .map((m: { command: string; when: string }) => [m.command, m.when]));
    expect(inline[APPROVE_COMMAND]).toBe('view == steno.specs && viewItem =~ /^spec\\..*\\.approvable$/');
    expect(inline[MARK_DONE_COMMAND]).toBe('view == steno.specs && viewItem =~ /^task\\.open/');
    expect(inline[REOPEN_COMMAND]).toBe('view == steno.specs && viewItem == task.done');
  });

  it('registers a handler for every action it contributes', () => {
    resetRecorded();
    registerActions(new ServerPool('/x'));
    for (const command of ACTIONS) expect(handlers.has(command)).toBe(true);
  });
});
