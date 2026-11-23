import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildTree, loadProject, PROTOCOL_VERSION, type Diagnostic, type SpecTree } from '@steno/core';
import { panelRows } from '@steno/core/host';
import type { AgentSteno, FolderServer, ServerState } from '@steno/host';
import { buildSnapshot } from '../src/worker/snapshot.js';

const STATE = 'name: a\ntitle: Alpha\nkind: feature\nmode: gated\nphase: execute\ncreated: 2026-01-01\n';
const AGENT: AgentSteno = { found: true, matches: true, bundled: '0.1.4' };

function project(files: Record<string, string>, root = mkdtempSync(join(tmpdir(), 'steno-orca-snap-'))): string {
  for (const [path, text] of Object.entries(files)) {
    const file = join(root, ...path.split('/'));
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, text);
  }
  return root;
}

/** A server that answers with the tree steno builds for the folder on disk. */
function server(folder: string, extra: { state?: ServerState; diagnostics?: Map<string, Diagnostic[]>; tree?: SpecTree } = {}): FolderServer {
  return {
    folder, state: extra.state ?? 'running', tree: extra.tree ?? buildTree(loadProject(folder)), diagnostics: extra.diagnostics ?? new Map(),
    onChange: () => () => {}, hold: () => () => {}, request: () => Promise.reject(new Error('not used')), settled: () => Promise.resolve(),
  };
}

const keys = (rows: { key: string }[]) => rows.map(r => r.key);

describe('the panel snapshot', () => {
  it('lists the specs with their documents and tasks, then steering and the instruction files', async () => {
    const folder = project({
      '.steno/config.yaml': '', '.steno/specs/a/spec.yaml': STATE, '.steno/specs/a/tasks.md': '# T\n\n- [ ] 1. One\n',
      '.steno/steering/tech.md': '# Tech\n', 'AGENTS.md': '', '.cursorrules': '',
    });
    const snap = await buildSnapshot({ workspaceId: 'w', folder, server: server(folder) }, AGENT);
    expect(snap.specRows.map(r => r.kind)).toEqual(['header', 'spec', 'document', 'task']);
    expect(snap.steeringRows.map(r => r.path ?? r.key)).toEqual(['steering', 'AGENTS.md', '.steno/steering/tech.md', '.cursorrules']);
    expect(snap).toMatchObject({ server: 'running', agentSteno: AGENT });
    expect(snap.refusal).toBeUndefined();
  });

  it('draws the rows the other hosts draw for the same tree and diagnostics', async () => {
    const folder = project({ '.steno/config.yaml': '', '.steno/specs/a/spec.yaml': STATE, '.steno/specs/a/requirements.md': '# R\n' });
    const diagnostics = new Map<string, Diagnostic[]>([['.steno/specs/a/requirements.md', [{ severity: 'error', rule: 'x', message: 'm', line: 1 } as Diagnostic]]]);
    const s = server(folder, { diagnostics });
    const snap = await buildSnapshot({ workspaceId: 'w', folder, server: s }, AGENT);
    expect({ specRows: snap.specRows, steeringRows: snap.steeringRows })
      .toEqual(panelRows({ tree: s.tree!, diagnostics, instructions: { root: [], agent: [] } }));
  });

  it('shows one notice per missing kind: no specs and no steering', async () => {
    const folder = project({ '.steno/config.yaml': '' });
    const snap = await buildSnapshot({ workspaceId: 'w', folder, server: server(folder) }, AGENT);
    expect(snap.specRows.find(r => r.kind === 'notice')).toMatchObject({ key: 'notice:no-specs', primary: 'newSpec' });
    expect(snap.steeringRows.find(r => r.kind === 'notice')).toMatchObject({ key: 'notice:no-steering', primary: 'steer' });
  });

  it('offers Set Up for a folder outside any steno project', async () => {
    const folder = project({ 'README.md': '' });
    const snap = await buildSnapshot({ workspaceId: 'w', folder, server: server(folder) }, AGENT);
    expect(snap.specRows).toEqual([expect.objectContaining({ key: 'notice:not-set-up', primary: 'setUp' })]);
    expect(snap.steeringRows).toEqual([]);
  });

  it('names the enclosing project and shows its tree, read only, under the notice', async () => {
    const outer = project({ '.steno/config.yaml': '', '.steno/specs/a/spec.yaml': STATE, '.steno/specs/a/requirements.md': '# R\n' });
    const folder = project({ 'README.md': '' }, join(outer, 'sub'));
    const snap = await buildSnapshot({ workspaceId: 'w', folder, server: server(folder), enclosing: server(outer) }, AGENT);
    const [notice, ...inside] = snap.specRows;
    expect(notice).toMatchObject({ key: 'notice:inside', label: `Inside the steno project ${outer}` });
    expect(keys(inside)).toEqual(['inside:specs', 'inside:spec:a', 'inside:doc:a/requirements.md', 'inside:steering', 'inside:notice:no-steering']);
    expect(inside.find(r => r.key === 'inside:specs')).toMatchObject({ parent: 'notice:inside', depth: 1 });
    expect(inside.every(r => r.key.startsWith('inside:') && r.actions.length === 0 && r.primary === undefined)).toBe(true);
  });

  it('carries a stopped server and a refusal from the last request', async () => {
    const folder = project({ '.steno/config.yaml': '' });
    const refusal = { protocolVersion: PROTOCOL_VERSION, code: 'lint-errors', message: 'fix the lint errors first' };
    const snap = await buildSnapshot({ workspaceId: 'w', folder, server: server(folder, { state: 'stopped' }) }, AGENT, { data: refusal });
    expect(snap.server).toBe('stopped');
    expect(snap.refusal).toEqual(refusal);
    expect((await buildSnapshot({ workspaceId: 'w', folder, server: server(folder) }, AGENT, new Error('ENOENT'))).refusal).toBeUndefined();
  });

  it('has no rows before the server answers with a tree', async () => {
    const folder = project({});
    const s = { ...server(folder, { state: 'starting' }), tree: undefined };
    const snap = await buildSnapshot({ workspaceId: 'w', folder, server: s }, AGENT);
    expect(snap).toMatchObject({ specRows: [], steeringRows: [], server: 'starting' });
  });
});
