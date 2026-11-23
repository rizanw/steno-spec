// The worker against the real language server that `pnpm build` copies to dist/vendor, on a copy of the example
// project: each row action goes through the same handlers Orca calls, and the files on disk say what changed.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { createPool } from '@steno/host';
import type { Post, Snapshot } from '../src/shared/messages.js';
import { dispatch, liveHandlers } from '../src/worker.js';
import { bundledCli } from '../src/worker/create.js';

const here = fileURLToPath(new URL('..', import.meta.url));
const example = join(here, '..', '..', 'examples', 'link-shortener');
const SPEC = join('.steno', 'specs', 'link-expiry');

/**
 * The example's spec with one task open, by default back in its tasks phase so the task can be marked done and the
 * tasks approved; in its execute phase the task can be handed to an agent.
 */
function project(phase: 'tasks' | 'execute' = 'tasks'): string {
  const dir = mkdtempSync(join(tmpdir(), 'steno-orca-live-'));
  cpSync(join(example, '.steno'), join(dir, '.steno'), { recursive: true });
  const yaml = join(dir, SPEC, 'spec.yaml');
  const text = readFileSync(yaml, 'utf8').replace('phase: done', `phase: ${phase}`);
  writeFileSync(yaml, phase === 'tasks' ? text.replace(/^ {2}tasks:.*\n/m, '') : text);
  const tasks = join(dir, SPEC, 'tasks.md');
  writeFileSync(tasks, readFileSync(tasks, 'utf8').replace('- [x] 2.4', '- [ ] 2.4'));
  return dir;
}

/** An Orca with one focused workspace in `dir`, recording what the worker posts and asks of it. */
function orcaFor(dir: string) {
  const posts: Snapshot[] = [];
  const calls: { method: string; params: unknown }[] = [];
  const terminals: string[] = [];
  const store = new Map<string, unknown>();
  const orca = {
    events: { on: () => ({ dispose() {} }) },
    host: {
      call: async (method: string, params: unknown) => {
        if (method === 'workspace.readContext') return { workspaceId: 'w1' };
        if (method === 'workspace.list') return { workspaces: [{ id: 'w1', path: dir }], truncated: false };
        calls.push({ method, params });
        if (method === 'storage.get') return { value: store.get((params as { key: string }).key) ?? null };
        if (method === 'storage.set') { store.set((params as { key: string }).key, (params as { value: unknown }).value); return { ok: true }; }
        if (method === 'agent.launch') { terminals.push(`t${terminals.length + 1}`); return { terminalId: terminals.at(-1) }; }
        // each launched agent shows up running in its terminal at once
        if (method === 'agents.list') return { agents: terminals.map(terminalId => ({ terminalId, title: null, agent: 'claude', state: 'waiting', stateStartedAt: 0 })) };
        if (method === 'terminal.sendText') return { accepted: true };
        return {};
      },
    },
    panels: { handle() { return { dispose() {} }; }, post: (_: string, payload: Post) => { posts.push(payload.snapshot); } },
    log() {},
  };
  return { orca: orca as never, posts, calls };
}

const until = async (check: () => boolean, ms = 15_000) => {
  const end = Date.now() + ms;
  while (!check() && Date.now() < end) await new Promise(r => setTimeout(r, 25));
  expect(check()).toBe(true);
};
const rowIn = (posts: Snapshot[], key: string) => posts.at(-1)?.specRows.find(r => r.key === key);

let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); cleanup = undefined; });

describe('the worker with the bundled language server', () => {
  it('opens a task row, marks it done, shows a lint block, approves and reopens only once confirmed', async () => {
    const dir = project();
    const pool = createPool({ source: { files: join(here, 'dist', 'vendor') }, log: () => {} });
    const { orca, posts, calls } = orcaFor(dir);
    const live = liveHandlers(orca, pool, bundledCli({ files: join(here, 'dist', 'vendor') }));
    cleanup = () => { live.dispose(); pool.dispose(); };
    const act = (key: string, action: 'open' | 'done' | 'approve' | 'reopenSpec') => dispatch(live.handlers, { type: 'steno.act', key, action });
    const notices = () => calls.filter(c => c.method === 'notifications.show').map(c => (c.params as { title: string }).title);
    const tasksFile = join(dir, SPEC, 'tasks.md');
    await until(() => rowIn(posts, 'task:link-expiry/T2.4')?.actions.includes('done') === true);

    // a task row opens its spec's tasks.md, at the top since Orca takes no line
    expect(await act('task:link-expiry/T2.4', 'open')).toEqual({ done: true });
    expect(calls.at(-1)).toEqual({ method: 'editor.open', params: { workspaceId: 'w1', path: '.steno/specs/link-expiry/tasks.md' } });

    expect(await act('task:link-expiry/T2.4', 'done')).toEqual({ done: true });
    expect(readFileSync(tasksFile, 'utf8')).toContain('- [x] 2.4');
    expect(notices().at(-1)).toBe('T2.4 of link-expiry is done.');

    // a lint error blocks the approval: the refusal names each problem's file and line, here and in the next snapshot
    const original = readFileSync(tasksFile, 'utf8');
    writeFileSync(tasksFile, original.replace('_Requirements: 3.1, 2.4, 1.3_', '_Requirements: 9.9_'));
    await until(() => rowIn(posts, 'doc:link-expiry/tasks.md')?.problems?.errors !== 0);
    const blocked = await act('doc:link-expiry/tasks.md', 'approve');
    expect(blocked).toMatchObject({ refusal: { code: 'lint-blocked' } });
    if (!('refusal' in blocked)) return;
    expect(blocked.refusal.findings).toContainEqual(expect.objectContaining({ file: '.steno/specs/link-expiry/tasks.md', rule: 'tasks/unknown-req', line: expect.any(Number) }));
    await until(() => posts.at(-1)?.refusal?.code === 'lint-blocked');

    writeFileSync(tasksFile, original);
    await until(() => rowIn(posts, 'doc:link-expiry/tasks.md')?.problems?.errors === 0);
    expect(await act('doc:link-expiry/tasks.md', 'approve')).toEqual({ done: true });
    expect(notices().at(-1)).toBe('link-expiry: tasks approved, now in done');
    await until(() => posts.at(-1)?.refusal === undefined && rowIn(posts, 'spec:link-expiry')?.actions.includes('reopenSpec') === true);

    // reopening waits for the panel's Confirm and changes nothing before it
    const yaml = join(dir, SPEC, 'spec.yaml');
    expect(await act('spec:link-expiry', 'reopenSpec')).toEqual({ form: 'reopenConfirm', key: 'spec:link-expiry' });
    expect(readFileSync(yaml, 'utf8')).toContain('phase: done');
    expect(await dispatch(live.handlers, { type: 'steno.submit', form: 'reopenConfirm', key: 'spec:link-expiry', answers: {} })).toEqual({ done: true });
    expect(readFileSync(yaml, 'utf8')).toContain('phase: execute');
    expect(notices().at(-1)).toMatch(/link-expiry is open again/);
  }, 60_000);

  it('creates a spec with the bundled CLI, opens its first document and draws it', async () => {
    const dir = project();
    const pool = createPool({ source: { files: join(here, 'dist', 'vendor') }, log: () => {} });
    const { orca, posts, calls } = orcaFor(dir);
    const live = liveHandlers(orca, pool, bundledCli({ files: join(here, 'dist', 'vendor') }));
    cleanup = () => { live.dispose(); pool.dispose(); };
    await until(() => rowIn(posts, 'spec:link-expiry') !== undefined);
    const submit = (name: string) => dispatch(live.handlers, { type: 'steno.submit', form: 'newSpec', answers: { kind: 'feature', name, title: 'Export', writer: 'self' } });

    expect(await submit('csv-export')).toEqual({ done: true });
    expect(calls.at(-1)).toEqual({ method: 'editor.open', params: { workspaceId: 'w1', path: '.steno/specs/csv-export/requirements.md' } });
    await until(() => rowIn(posts, 'spec:csv-export') !== undefined);

    // a name steno will not take is its refusal, drawn by the panel, and nothing opens
    const opened = calls.length;
    expect(await submit('Not A Slug')).toMatchObject({ refusal: { message: expect.stringContaining('kebab-case') } });
    expect(calls.length).toBe(opened);
  }, 60_000);

  it('hands a task to the agent picked, starts the writer of a new spec with no second pick, then offers both as running', async () => {
    const dir = project('execute');
    const pool = createPool({ source: { files: join(here, 'dist', 'vendor') }, log: () => {} });
    const { orca, posts, calls } = orcaFor(dir);
    const live = liveHandlers(orca, pool, bundledCli({ files: join(here, 'dist', 'vendor') }));
    cleanup = () => { live.dispose(); pool.dispose(); };
    const launches = () => calls.filter(c => c.method === 'agent.launch').map(c => c.params);
    const typed = () => calls.filter(c => c.method === 'terminal.sendText').map(c => c.params);
    await until(() => rowIn(posts, 'task:link-expiry/T2.4')?.actions.includes('run') === true);

    // the pick comes first and nothing starts until it is submitted
    expect(await dispatch(live.handlers, { type: 'steno.act', key: 'task:link-expiry/T2.4', action: 'run' }))
      .toMatchObject({ form: 'agentPick', key: 'task:link-expiry/T2.4', choices: expect.arrayContaining(['claude']) });
    expect(launches()).toEqual([]);
    expect(await dispatch(live.handlers, { type: 'steno.submit', form: 'agentPick', key: 'task:link-expiry/T2.4', answers: { action: 'run', agent: 'claude' } }))
      .toEqual({ done: true });
    expect(launches()).toEqual([{ workspaceId: 'w1', agent: 'claude' }]);
    await until(() => typed().length === 1);
    expect(typed()).toEqual([{ terminalId: 't1', text: expect.stringMatching(/steno-run.*T2\.4.*link-expiry/), enter: false }]);

    expect(await dispatch(live.handlers, { type: 'steno.submit', form: 'newSpec', answers: { kind: 'feature', name: 'csv-export', writer: 'agent', agent: 'claude' } }))
      .toEqual({ done: true });
    expect(launches()).toHaveLength(2);
    await until(() => typed().length === 2);
    expect(typed().at(-1)).toEqual({ terminalId: 't2', text: expect.stringMatching(/steno-spec.*csv-export/), enter: false });

    // the agents started above are running now, so the next pick offers them first and typing into one starts nothing
    const pick = await dispatch(live.handlers, { type: 'steno.act', key: 'task:link-expiry/T2.4', action: 'run' });
    // the first pick saved claude as this worktree's agent, so the pick offers only the running claudes and a new one
    expect(pick).toMatchObject({ form: 'agentPick', choices: ['claude'], running: [{ terminalId: 't1', agent: 'claude' }, { terminalId: 't2', agent: 'claude' }] });
    expect(await dispatch(live.handlers, { type: 'steno.submit', form: 'agentPick', key: 'task:link-expiry/T2.4', answers: { action: 'run', terminal: 't1', agent: 'claude' } }))
      .toEqual({ done: true });
    expect(launches()).toHaveLength(2);
    expect(typed().at(-1)).toEqual({ terminalId: 't1', text: expect.stringMatching(/steno-run.*T2\.4.*link-expiry/), enter: false });
  }, 60_000);

  it('refuses Set Up inside another project, and sets a fresh folder up for the agents picked', async () => {
    const pool = createPool({ source: { files: join(here, 'dist', 'vendor') }, log: () => {} });
    const setUpIn = (dir: string) => {
      const { orca, posts, calls } = orcaFor(dir);
      const live = liveHandlers(orca, pool, bundledCli({ files: join(here, 'dist', 'vendor') }));
      return { live, posts, calls };
    };
    const inner = join(project(), 'packages', 'api');
    mkdirSync(inner, { recursive: true });
    const nested = setUpIn(inner);
    const fresh = mkdtempSync(join(tmpdir(), 'steno-orca-setup-'));
    const blank = setUpIn(fresh);
    cleanup = () => { nested.live.dispose(); blank.live.dispose(); pool.dispose(); };
    await until(() => nested.posts.length > 0 && blank.posts.length > 0);

    expect(await dispatch(nested.live.handlers, { type: 'steno.act', key: 'notice:not-set-up', action: 'setUp' }))
      .toMatchObject({ refusal: { message: expect.stringContaining('inside the steno project') } });
    expect(existsSync(join(inner, '.steno'))).toBe(false);

    expect(await dispatch(blank.live.handlers, { type: 'steno.act', key: 'notice:not-set-up', action: 'setUp' }))
      .toMatchObject({ form: 'setUp', choices: expect.arrayContaining(['claude']) });
    expect(existsSync(join(fresh, '.steno'))).toBe(false);
    expect(await dispatch(blank.live.handlers, { type: 'steno.submit', form: 'setUp', answers: { agents: 'claude' } })).toEqual({ done: true });
    expect(existsSync(join(fresh, '.steno'))).toBe(true);
    const report = blank.calls.filter(c => c.method === 'notifications.show').at(-1)?.params as { title: string; body: string };
    expect(report.title).toBe('steno is set up');
    expect(report.body).toMatch(/steno-run/);
    expect(report.body).toMatch(/claude/);
  }, 60_000);
});
