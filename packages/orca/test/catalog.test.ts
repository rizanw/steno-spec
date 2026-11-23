import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { addRelease, releaseEntry } from '../scripts/catalog.mjs';

// A 128 px square of one grey: the smallest icon Orca accepts, built here so the fixture holds no binary file.
const png = () => {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]), out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(128, 0); header.writeUInt32BE(128, 4); header[8] = 8; header[9] = 0;
  const rows = Buffer.concat(Array.from({ length: 128 }, () => Buffer.concat([Buffer.from([0]), Buffer.alloc(128, 0x80)])));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
};

const manifest = {
  manifestVersion: 2, id: 'fixture', name: 'Fixture', version: '1.2.0', description: 'A fixture plugin.',
  engines: { orca: '>=1.4.248' }, execution: 'trusted-worker', main: 'worker.mjs', icon: 'icon.png',
  contributes: { panels: [{ id: 'main', title: 'Fixture panel', icon: 'file-text', entry: 'panel.html', ui: 'html' }], events: [{ on: 'workspace.changed' }] },
  capabilities: [{ kind: 'workspace:read' }, { kind: 'storage:own' }, { kind: 'workspace:read' }],
};

const project = () => {
  const dir = mkdtempSync(join(tmpdir(), 'steno-orca-catalog-'));
  writeFileSync(join(dir, 'orca-plugin.json'), JSON.stringify(manifest, null, 2) + '\n');
  writeFileSync(join(dir, 'worker.mjs'), 'export default function activate() {}\n');
  writeFileSync(join(dir, 'panel.html'), '<!doctype html><title>Fixture</title>\n');
  writeFileSync(join(dir, 'icon.png'), png());
  return dir;
};

const commit = '0123456789abcdef0123456789abcdef01234567';
const release = (version: string) => ({ version, commit });
const plugin = { id: 'acme.fixture', repository: 'acme/plugins', description: 'A fixture plugin.' };
const empty = { catalogVersion: 2, name: 'acme', owner: 'acme', plugins: [] as unknown[] };

describe('releaseEntry', () => {
  // `orca plugin release-entry --json` printed this for the same files committed at packages/orca, apart from the
  // icon path, which names the copy of the icon on main.
  it('builds the entry Orca prints for the same files', () => {
    expect(releaseEntry(project(), commit, { path: 'art/icon.png', bytes: png() })).toEqual({
      version: '1.2.0', commit,
      contentHash: '89e387e10871c442ddf4a28d5947a9a0fe293bc0f0864b9855c738b8411827dd',
      execution: 'trusted-worker', minimumOrca: '1.4.248', name: 'Fixture',
      contributes: [{ kind: 'panels', name: 'Fixture panel' }, { kind: 'events', name: 'workspace.changed' }],
      capabilities: ['workspace:read', 'storage:own'],
      images: { icon: { path: 'art/icon.png', alt: 'Fixture', sha256: '96f5319e006cd162e19180b7bc9402243c8b293937db5b6dd1732afbe9624119', width: 128, height: 128 } },
    });
  });

  it('leaves the icon out when it is not given', () => {
    expect(releaseEntry(project(), commit)).not.toHaveProperty('images');
  });
});

describe('addRelease', () => {
  it('adds the plugin with its source on main and its first release', () => {
    expect(addRelease(empty, release('1.0.0'), plugin).plugins).toEqual([{
      id: 'acme.fixture', source: { kind: 'git', url: 'https://github.com/acme/plugins.git', ref: 'main', path: 'packages/orca' },
      description: 'A fixture plugin.', releases: [release('1.0.0')],
    }]);
  });

  it('lists a new release first and keeps the older ones', () => {
    const once = addRelease(empty, release('1.0.0'), plugin);
    const twice = addRelease(once, release('1.2.0'), plugin) as { plugins: { releases: unknown[] }[] };
    expect(twice.plugins[0].releases).toEqual([release('1.2.0'), release('1.0.0')]);
  });

  it('leaves the catalog as it is when the version is already listed', () => {
    const once = addRelease(empty, release('1.0.0'), plugin);
    expect(addRelease(once, { ...release('1.0.0'), commit: 'f'.repeat(40) }, plugin)).toBe(once);
  });

  it('keeps no more than the 32 releases Orca reads', () => {
    let catalog = empty;
    for (let minor = 0; minor < 34; minor += 2) for (const patch of [0, 1]) catalog = addRelease(catalog, release(`1.${minor}.${patch}`), plugin);
    const releases = (catalog as { plugins: { releases: { version: string }[] }[] }).plugins[0].releases;
    expect(releases).toHaveLength(32);
    expect(releases[0].version).toBe('1.32.1');
  });

  it('leaves other plugins in the catalog alone', () => {
    const other = { id: 'acme.other', releases: [release('9.0.0')] };
    const next = addRelease({ ...empty, plugins: [other] }, release('1.0.0'), plugin);
    expect(next.plugins[0]).toBe(other);
    expect(next.plugins).toHaveLength(2);
  });
});
