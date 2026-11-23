import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { CliExit } from '@steno/core/host';
import { createSpec, setUpChoices, setUpWorktree, specRequest } from '../src/worker/create.js';
import type { Active } from '../src/worker/worktree.js';

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'steno-orca-create-'));
  for (const [path, text] of Object.entries(files)) {
    const file = join(root, ...path.split('/'));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
  }
  return root;
}

function fakeOrca() {
  const calls: { method: string; params: unknown }[] = [];
  const logged: string[] = [];
  const orca = {
    host: {
      call: async (method: string, params: unknown) => {
        calls.push({ method, params });
        if (method === 'agent.launch') return { terminalId: 't1' };
        if (method === 'agents.list') return { agents: [{ terminalId: 't1', title: null, agent: 'claude', state: 'waiting', stateStartedAt: 0 }] };
        if (method === 'terminal.sendText') return { accepted: true };
        return {};
      },
    },
    log: (line: string) => { logged.push(line); },
  };
  return { orca: orca as never, calls, logged };
}

/** A CLI that records its arguments and ends as `exit` says. */
function fakeCli(exit: CliExit) {
  const runs: { args: string[]; cwd: string }[] = [];
  return { runs, run: async (args: string[], cwd: string) => { runs.push({ args, cwd }); return exit; } };
}

const active = (folder: string, tree: object = {}): Active => ({ workspaceId: 'ws1', folder, server: { folder, tree } as never });
const answers = { kind: 'feature', name: 'csv-export', title: ' Export ', description: '', writer: 'self' };
const refusalOut = (message: string) => JSON.stringify({ protocolVersion: 1, code: 'failed', message });

describe('new spec', () => {
  it('reads the form answers as a request, leaving out blank optional fields', () => {
    expect(specRequest(answers)).toEqual({ kind: 'feature', name: 'csv-export', title: 'Export', writer: 'self' });
    expect(specRequest({ kind: 'bugfix', name: 'x', writer: 'agent', description: 'Slow login' })).toEqual({ kind: 'bugfix', name: 'x', writer: 'agent', description: 'Slow login' });
  });

  it('runs steno new in the worktree and opens the first document it created', async () => {
    const folder = project({ 'specs/csv-export/requirements.md': '# R\n' });
    const { orca, calls } = fakeOrca();
    const { run, runs } = fakeCli({ code: 0, stdout: JSON.stringify({ protocolVersion: 1, spec: 'csv-export', phase: 'requirements', created: ['requirements.md', 'spec.yaml'] }), stderr: '' });
    expect(await createSpec(orca, active(folder, { specsDir: 'specs' }), run, answers)).toEqual({ done: true });
    expect(runs).toEqual([{ args: ['--root', folder, '--json', 'new', '--title=Export', '--', 'csv-export'], cwd: folder }]);
    expect(calls).toEqual([{ method: 'editor.open', params: { workspaceId: 'ws1', path: 'specs/csv-export/requirements.md' } }]);
  });

  it('starts the chosen agent on the new spec with no second pick', async () => {
    const folder = project({ '.steno/specs/csv-export/requirements.md': '# R\n' });
    const { orca, calls } = fakeOrca();
    const { run } = fakeCli({ code: 0, stdout: JSON.stringify({ protocolVersion: 1, spec: 'csv-export', phase: 'requirements', created: ['requirements.md'] }), stderr: '' });
    expect(await createSpec(orca, active(folder), run, { ...answers, writer: 'agent', agent: 'claude' })).toEqual({ done: true });
    expect(calls.slice(0, 2)).toEqual([expect.objectContaining({ method: 'editor.open' }), { method: 'agent.launch', params: { workspaceId: 'ws1', agent: 'claude' } }]);
    await vi.waitFor(() => expect(calls.at(-1)).toEqual({ method: 'terminal.sendText', params: { terminalId: 't1', text: '/steno-spec csv-export', enter: false } }));
  });

  it('returns a refused name for the panel to draw, opening nothing and notifying nothing', async () => {
    const { orca, calls, logged } = fakeOrca();
    const { run } = fakeCli({ code: 1, stdout: refusalOut('spec name must be a kebab-case slug, got "Bad Name"'), stderr: '' });
    expect(await createSpec(orca, active('/nowhere'), run, { ...answers, name: 'Bad Name' })).toEqual({ refusal: { protocolVersion: 1, code: 'failed', message: 'spec name must be a kebab-case slug, got "Bad Name"' } });
    expect(calls).toEqual([]);
    expect(logged).toEqual([]);
  });

  it('shows a crashed run\'s own message and writes its standard error to the plugin log', async () => {
    const { orca, calls, logged } = fakeOrca();
    const { run } = fakeCli({ code: 3, stdout: '', stderr: 'TypeError: boom\n    at main (cli.mjs:1:1)\n' });
    expect(await createSpec(orca, active('/nowhere'), run, answers)).toEqual({ done: true });
    expect(calls).toEqual([{ method: 'notifications.show', params: { title: 'New Spec failed', body: 'steno exited with code 3: TypeError: boom' } }]);
    expect(logged).toEqual(['steno: steno exited with code 3: TypeError: boom\nTypeError: boom\n    at main (cli.mjs:1:1)\n']);
  });

  it('notifies when the CLI cannot start at all', async () => {
    const { orca, calls } = fakeOrca();
    const run = async () => { throw new Error('spawn ENOENT'); };
    expect(await createSpec(orca, active('/nowhere'), run, answers)).toEqual({ done: true });
    expect(calls).toEqual([{ method: 'notifications.show', params: { title: 'New Spec failed', body: 'steno could not start: spawn ENOENT' } }]);
  });
});

describe('set up', () => {
  it('refuses a worktree inside another steno project, naming it, without asking the CLI for agents', async () => {
    const outer = project({ '.steno/config.yaml': '' });
    const inner = join(outer, 'worktrees', 'b');
    mkdirSync(inner, { recursive: true });
    const { orca } = fakeOrca();
    const { run, runs } = fakeCli({ code: 0, stdout: '{}', stderr: '' });
    const result = await setUpChoices(orca, active(inner), run);
    expect(result).toMatchObject({ refusal: { code: 'failed', file: outer, message: expect.stringContaining(outer) } });
    expect(runs).toEqual([]);
  });

  it('answers with the agents the CLI can set up, by key', async () => {
    const folder = project({});
    const { orca } = fakeOrca();
    const { run, runs } = fakeCli({ code: 0, stdout: JSON.stringify({ agents: [{ key: 'claude', label: 'Claude Code' }, { key: 'codex', label: 'Codex' }] }), stderr: '' });
    expect(await setUpChoices(orca, active(folder), run)).toEqual({ form: 'setUp', choices: ['claude', 'codex'] });
    expect(runs[0]?.args).toEqual(['--root', folder, '--json', 'init', '--list-agents']);
  });

  it('installs for the agents picked and reports the skills and agent folders', async () => {
    const folder = project({});
    const { orca, calls } = fakeOrca();
    const installed = { root: folder, skills: ['steno-spec', 'steno-run'], agents: { claude: '.claude/skills' } };
    const { run, runs } = fakeCli({ code: 0, stdout: JSON.stringify(installed), stderr: '' });
    expect(await setUpWorktree(orca, active(folder), run, { agents: 'claude, codex' })).toEqual({ done: true });
    expect(runs[0]?.args).toEqual(['--root', folder, '--json', 'init', '--agent=claude,codex']);
    expect(calls).toEqual([{ method: 'notifications.show', params: { title: 'steno is set up', body: 'Skills: steno-spec, steno-run. Agents: claude (.claude/skills).' } }]);
  });

  it('installs the shared skills folder alone when no agent is picked', async () => {
    const folder = project({});
    const { orca, calls } = fakeOrca();
    const { run, runs } = fakeCli({ code: 0, stdout: JSON.stringify({ root: folder, skills: ['steno-run'], agents: {} }), stderr: '' });
    await setUpWorktree(orca, active(folder), run, { agents: '' });
    expect(runs[0]?.args.at(-1)).toBe('--agent=');
    expect((calls[0]?.params as { body: string }).body).toBe('Skills: steno-run. Agents: the shared skills folder only.');
  });
});
