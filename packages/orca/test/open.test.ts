import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PanelRow } from '@steno/core/host';
import { openRow, rowFile } from '../src/worker/open.js';
import type { Active } from '../src/worker/worktree.js';

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'steno-orca-open-'));
  for (const [path, text] of Object.entries(files)) {
    const file = join(root, ...path.split('/'));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text);
  }
  return root;
}

function fakeOrca() {
  const calls: { method: string; params: unknown }[] = [];
  const orca = { host: { call: async (method: string, params: unknown) => { calls.push({ method, params }); return {}; } } };
  return { orca: orca as never, calls };
}

const active = (folder: string, tree: object = {}): Active => ({ workspaceId: 'ws1', folder, server: { folder, tree } as never });

const row = (fields: Partial<PanelRow>): PanelRow => ({ key: 'doc:a/design.md', depth: 2, kind: 'document', label: 'x', actions: ['open'], ...fields });

describe('open', () => {
  it('opens a document row by its folder-relative path in the active workspace', async () => {
    const folder = project({ '.steno/specs/a/design.md': '# Design\n' });
    const { orca, calls } = fakeOrca();
    const result = await openRow(orca, active(folder), row({ path: '.steno/specs/a/design.md' }));
    expect(result).toEqual({ done: true });
    expect(calls).toEqual([{ method: 'editor.open', params: { workspaceId: 'ws1', path: '.steno/specs/a/design.md' } }]);
  });

  it('opens a task row at its spec tasks.md, under the specs folder the tree names', () => {
    const task = row({ key: 'task:a/T1', kind: 'task', target: { spec: 'a', task: 'T1' } });
    expect(rowFile(task, undefined)).toBe('.steno/specs/a/tasks.md');
    expect(rowFile(task, { specsDir: 'specs' })).toBe('specs/a/tasks.md');
  });

  it('names a missing file in a notification and opens nothing', async () => {
    const folder = project({});
    const { orca, calls } = fakeOrca();
    await openRow(orca, active(folder), row({ key: 'steering:tech.md', kind: 'steering', path: '.steno/steering/tech.md' }));
    expect(calls).toHaveLength(1);
    expect(calls[0]!.method).toBe('notifications.show');
    expect((calls[0]!.params as { title: string }).title).toContain('.steno/steering/tech.md');
  });

  it('opens nothing for a row from the enclosing project or a row with no file', async () => {
    const folder = project({ '.steno/specs/a/design.md': '' });
    const { orca, calls } = fakeOrca();
    expect(await openRow(orca, active(folder), row({ key: 'inside:doc:a/design.md', path: '.steno/specs/a/design.md' }))).toHaveProperty('nothing');
    expect(await openRow(orca, active(folder), row({ key: 'spec:a', kind: 'spec' }))).toHaveProperty('nothing');
    expect(await openRow(orca, active(folder), undefined)).toHaveProperty('nothing');
    expect(calls).toEqual([]);
  });
});
