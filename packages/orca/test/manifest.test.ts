import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { imageProblem, MAX_IMAGE_BYTES, MAX_SCREENSHOTS } from '../scripts/catalog.mjs';

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

  // Orca's release entry silently leaves out an image it would refuse, so a bad one would vanish from the listing
  // rather than fail the release. Catching it here fails the pull request instead.
  it("lists only cover and screenshot images Orca takes", () => {
    type Image = { path: string; alt: string; caption?: string };
    const images: { kind: 'cover' | 'screenshot'; image: Image }[] = [
      ...(manifest.cover ? [{ kind: 'cover' as const, image: manifest.cover as Image }] : []),
      ...((manifest.screenshots ?? []) as Image[]).map(image => ({ kind: 'screenshot' as const, image })),
    ];
    expect(manifest.screenshots?.length ?? 0).toBeLessThanOrEqual(MAX_SCREENSHOTS);
    let total = 0;
    for (const { kind, image } of images) {
      const bytes = readFileSync(join(root, image.path));
      total += bytes.length;
      expect(imageProblem(kind, bytes), image.path).toBeNull();
      expect(image.alt.length, image.path).toBeGreaterThan(0);
      expect(image.alt.length, image.path).toBeLessThanOrEqual(160);
      expect(image.caption?.length ?? 0, image.path).toBeLessThanOrEqual(120);
    }
    expect(total).toBeLessThanOrEqual(MAX_IMAGE_BYTES);
  });

  it('asks only for the capabilities the panel needs', () => {
    expect(manifest.capabilities.map((c: { kind: string }) => c.kind).sort())
      .toEqual(['agent:launch', 'agent:read', 'notifications:show', 'storage:own', 'terminal:send', 'workspace:read', 'workspace:write']);
  });
});
