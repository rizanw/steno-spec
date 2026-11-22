import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..');
const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const manifest = json(join(root, 'orca-plugin.json'));

describe('orca-plugin.json', () => {
  it('carries the same version as the package and the repository', () => {
    expect(manifest.version).toBe(json(join(root, 'package.json')).version);
    expect(manifest.version).toBe(json(join(root, '..', '..', 'package.json')).version);
  });

  // Orca's validator refuses an engines range below the newest field the manifest uses (workspace:write is
  // 1.4.248), and the host methods the worker calls are older than that.
  it('declares the oldest Orca that has every method and capability the plugin uses', () => {
    expect(manifest.engines.orca).toBe('>=1.4.248');
  });

  it('runs a worker behind one html panel', () => {
    expect(manifest).toMatchObject({ manifestVersion: 2, execution: 'trusted-worker', main: 'dist/worker.mjs' });
    expect(manifest.contributes.panels).toEqual([expect.objectContaining({ id: 'steno', ui: 'html', entry: 'dist/panel.html' })]);
  });

  // Without the event listed, Orca never delivers worktree switches to the worker and the panel keeps showing
  // the first worktree.
  it('subscribes the worker to worktree switches', () => {
    expect(manifest.contributes.events).toContainEqual({ on: 'workspace.changed' });
  });

  it('asks only for the capabilities the panel needs', () => {
    expect(manifest.capabilities.map((c: { kind: string }) => c.kind).sort())
      .toEqual(['agent:launch', 'notifications:show', 'workspace:read', 'workspace:write']);
  });
});
