import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PluginServerContext } from '@getpaseo/plugin/server';
import contribute from '../index.server';
import * as contracts from '../shared/contracts';
import { ChangeOutcome, PanelSnapshot } from '../shared/contracts';
import { applyChange, STOPPED_MESSAGE } from '../server/changes';
import { createPool } from '../server/pool';
import { streamPanel } from '../server/snapshot';

const example = fileURLToPath(new URL('../../../examples/link-shortener', import.meta.url));

/** A copy of the example project's specs and instructions in a temp folder. */
function project(): string {
  const dir = mkdtempSync(join(tmpdir(), 'steno-paseo-server-'));
  cpSync(join(example, '.steno'), join(dir, '.steno'), { recursive: true });
  cpSync(join(example, 'AGENTS.md'), join(dir, 'AGENTS.md'));
  return dir;
}

type Handler = (input: unknown, context: unknown) => unknown;

/** The plugin started against a fake Paseo that knows one workspace, `ws`, in `directory`. */
function plugin(directory: string) {
  const handlers = new Map<string, Handler>();
  const host = { handle: (contract: { name: string }, handler: Handler) => { handlers.set(contract.name, handler); } };
  const dispose = contribute(host as unknown as PluginServerContext) as () => void;
  const paseo = { workspaces: { ref: () => ({ directory: undefined, refresh: async () => ({ workspaceDirectory: directory }) }) } };
  const subscribe = () => {
    const events: PanelSnapshot[] = [];
    const stop = new AbortController();
    const closed = handlers.get('steno.panel')!({ workspaceId: 'ws' }, {
      paseo, signal: stop.signal, push: async (event: unknown) => { events.push(PanelSnapshot.parse(event)); },
    }) as Promise<void>;
    return { events, stop: async () => { stop.abort(); await closed; } };
  };
  const rpc = async (name: string, input: Record<string, unknown>) => handlers.get(name)!({ workspaceId: 'ws', ...input }, { paseo });
  return { subscribe, rpc, dispose, names: () => [...handlers.keys()] };
}

/** The example's spec moved back to its tasks phase, with the tasks approval undone, so it can be approved again. */
function inTasksPhase(dir: string): void {
  const yaml = join(dir, '.steno', 'specs', 'link-expiry', 'spec.yaml');
  writeFileSync(yaml, readFileSync(yaml, 'utf8').replace('phase: done', 'phase: tasks').replace(/^ {2}tasks:.*\n/m, ''));
}
const tasksFile = (dir: string) => join(dir, '.steno', 'specs', 'link-expiry', 'tasks.md');

const until = async (check: () => boolean, ms = 10_000) => {
  const end = Date.now() + ms;
  while (!check() && Date.now() < end) await new Promise(r => setTimeout(r, 20));
  expect(check()).toBe(true);
};
const row = (snapshot: PanelSnapshot, key: string) => snapshot.specRows.find(r => r.key === key);

let logs: string[];
let dispose: (() => void) | undefined;
beforeEach(() => {
  logs = [];
  vi.spyOn(console, 'log').mockImplementation((line: unknown) => { logs.push(String(line)); });
});
afterEach(() => { dispose?.(); vi.restoreAllMocks(); });

describe('the panel stream', () => {
  it('pushes the tree first, a changed tasks.md within 2 s, the current state on resubscribe, and logs each push', async () => {
    const dir = project();
    const p = plugin(dir);
    dispose = p.dispose;

    const first = p.subscribe();
    await until(() => first.events.length > 0);
    const opening = first.events[0];
    expect(opening.server).toBe('running');
    expect(row(opening, 'spec:link-expiry')).toBeDefined();
    expect(row(opening, 'task:link-expiry/T2.4')!.icon).toBe('finished');
    expect(opening.steeringRows.map(r => r.key)).toContain('instruction:AGENTS.md');

    const tasks = join(dir, '.steno', 'specs', 'link-expiry', 'tasks.md');
    const edited = Date.now();
    writeFileSync(tasks, readFileSync(tasks, 'utf8').replace('- [x] 2.4', '- [ ] 2.4'));
    await until(() => row(first.events.at(-1)!, 'task:link-expiry/T2.4')!.icon !== 'finished', 2_000);
    expect(Date.now() - edited).toBeLessThan(2_000);
    await first.stop();

    const second = p.subscribe();
    await until(() => second.events.length > 0);
    expect(row(second.events[0], 'task:link-expiry/T2.4')!.icon).not.toBe('finished');
    await second.stop();

    const pushes = logs.filter(line => line.startsWith('steno: panel ws:'));
    expect(pushes).toHaveLength(first.events.length + second.events.length);
    expect(pushes[0]).toMatch(/^steno: panel ws: \d+ rows, server running$/);
  }, 30_000);

  it('sends nothing before the server has a tree, however soon a change arrives', async () => {
    const pool = createPool({ log: () => {} });
    const events: PanelSnapshot[] = [];
    const stop = new AbortController();
    // a check that answers at once and a 1 ms window both signal long before the server is up
    await streamPanel(pool, { workspaceId: 'ws', directory: project(), signal: stop.signal, push: async s => { events.push(s); } },
      { throttleMs: 1, log: () => {}, checkAgentSteno: async () => ({ found: false, matches: false }) });
    stop.abort();
    pool.dispose();
    expect(events[0].server).toBe('running');
    expect(row(events[0], 'spec:link-expiry')).toBeDefined();
  }, 30_000);

  it('gathers a burst of changes into one push', async () => {
    const dir = project();
    const p = plugin(dir);
    dispose = p.dispose;
    const sub = p.subscribe();
    // the agents' `steno` check answers with a push of its own; it must not land inside the burst counted here
    await until(() => sub.events.length > 0 && !(sub.events.at(-1)!.agentSteno.matches && !sub.events.at(-1)!.agentSteno.found));
    const before = sub.events.length;
    for (const name of ['CLAUDE.md', 'GEMINI.md', '.cursorrules']) writeFileSync(join(dir, name), '# rules');
    await until(() => sub.events.at(-1)!.steeringRows.some(r => r.key === 'instruction:.cursorrules'));
    await new Promise(r => setTimeout(r, 400));
    expect(sub.events.length - before).toBeLessThanOrEqual(2);
    await sub.stop();
  }, 30_000);
});

describe('reading a file', () => {
  it('serves a document the panel lists and refuses any other path', async () => {
    const dir = project();
    writeFileSync(join(dir, 'secret.txt'), 'not for the panel');
    const p = plugin(dir);
    dispose = p.dispose;
    const read = await p.rpc('steno.read', { path: '.steno/specs/link-expiry/tasks.md' }) as { text: string };
    expect(read.text).toBe(readFileSync(tasksFile(dir), 'utf8'));
    expect(((await p.rpc('steno.read', { path: 'AGENTS.md' })) as { text: string }).text).toContain('#');
    for (const path of ['secret.txt', '.steno/specs/link-expiry/../../../secret.txt', '.steno/specs/link-expiry/spec.yaml']) {
      await expect(p.rpc('steno.read', { path })).rejects.toThrow(/not a steno file/);
    }
  }, 30_000);
});

describe('changing a spec', () => {
  it('approves a stage, marks a task done and returns a lint block with its problems', async () => {
    const dir = project();
    inTasksPhase(dir);
    writeFileSync(tasksFile(dir), readFileSync(tasksFile(dir), 'utf8').replace('- [x] 2.4', '- [ ] 2.4'));
    const p = plugin(dir);
    dispose = p.dispose;
    const change = async (input: Record<string, unknown>) => ChangeOutcome.parse(await p.rpc('steno.change', input));

    const done = await change({ kind: 'done', spec: 'link-expiry', task: 'T2.4' });
    expect(done).toMatchObject({ ok: true, result: { task: 'T2.4', done: true } });
    expect(readFileSync(tasksFile(dir), 'utf8')).toContain('- [x] 2.4');

    const original = readFileSync(tasksFile(dir), 'utf8');
    writeFileSync(tasksFile(dir), original.replace('_Requirements: 3.1, 2.4, 1.3_', '_Requirements: 9.9_'));
    const blocked = await change({ kind: 'approve', spec: 'link-expiry', phase: 'tasks' });
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.error.code).toBe('lint-blocked');
    expect(blocked.error.findings).toContainEqual(expect.objectContaining({ file: '.steno/specs/link-expiry/tasks.md', rule: 'tasks/unknown-req' }));

    writeFileSync(tasksFile(dir), original);
    const approved = await change({ kind: 'approve', spec: 'link-expiry', phase: 'tasks' });
    expect(approved).toMatchObject({ ok: true, result: { approved: 'tasks', phase: 'done' } });
  }, 30_000);

  it('refuses while the server is stopped and sends nothing', async () => {
    let starts = 0;
    const pool = createPool({ start: () => { starts++; throw new Error('cannot start'); }, log: () => {} });
    const server = pool.serverFor(project());
    expect(server.state).toBe('stopped');
    const before = starts;
    const outcome = await applyChange(server, { kind: 'done', spec: 'link-expiry', task: 'T2.4' });
    expect(outcome).toEqual({ ok: false, error: expect.objectContaining({ code: 'failed', message: STOPPED_MESSAGE }) });
    expect(starts).toBe(before);
    pool.dispose();
  });
});

describe('every contract', () => {
  /** The RPC and subscription contracts, found by their `steno.` names among the module's exports. */
  type Contract = { name: string; output?: { parse(v: unknown): unknown } };
  const all = (Object.values(contracts) as unknown[]).filter((c): c is Contract =>
    typeof c === 'object' && c !== null && typeof (c as { name?: unknown }).name === 'string' && (c as Contract).name.startsWith('steno.'));
  /** Each contract's output schema, so the answers below are checked as Paseo would check them. */
  const output = (name: string) => all.find(c => c.name === name)!.output!;

  it('has a handler on the server', () => {
    const dir = project();
    const p = plugin(dir);
    dispose = p.dispose;
    expect(p.names().sort()).toEqual(all.map(c => c.name).sort());
  });

  it('answers the calls the other tests reach only below the handler', async () => {
    const dir = project();
    const p = plugin(dir);
    dispose = p.dispose;
    const ask = async (name: string, input: Record<string, unknown>) => output(name).parse(await p.rpc(name, input));

    expect(await ask('steno.call', { handoff: { kind: 'run', spec: 'link-expiry', task: 'T2.4' }, provider: 'codex' }))
      .toMatchObject({ ok: true, text: '$steno-run T2.4 link-expiry' });
    expect(await ask('steno.list-agents', {})).toMatchObject({ agents: expect.arrayContaining([expect.objectContaining({ key: 'claude' })]) });
    expect(await ask('steno.new-spec', { kind: 'feature', name: 'search', writer: 'agent' })).toEqual({ ok: true, spec: 'search', phase: 'requirements' });
    expect(await ask('steno.set-up', { agents: [] })).toMatchObject({ ok: true });
    expect(await ask('steno.restart', {})).toEqual({});

    const sub = p.subscribe();
    await until(() => sub.events.length > 0 && sub.events.at(-1)!.server === 'running');
    expect(await ask('steno.intent', { action: 'approve' })).toEqual({});
    await until(() => sub.events.some(e => e.intent === 'approve'));
    expect(sub.events.filter(e => e.intent === 'approve')).toHaveLength(1);
    await sub.stop();
  }, 30_000);
});
