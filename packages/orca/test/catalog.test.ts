import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { addRelease, imageInfo, imageProblem, releaseEntry } from '../scripts/catalog.mjs';

// An image of one grey, built here so the fixture holds no binary file. The default is a 128 px square, the smallest
// icon Orca accepts.
const png = (width = 128, height = 128, grey = 0x80) => {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]), out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 0;
  const rows = Buffer.concat(Array.from({ length: height }, () => Buffer.concat([Buffer.from([0]), Buffer.alloc(width, grey)])));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
};

// Only the headers of a JPEG and a WebP, which is all imageInfo reads: a JPEG's app segment then its frame, and a
// WebP's first chunk in each of its three layouts.
const jpeg = (width: number, height: number) => {
  const app = Buffer.from([0xff, 0xe0, 0x00, 0x04, 0x00, 0x00]), frame = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, 0, 0, 0, 0]);
  frame.writeUInt16BE(height, 5); frame.writeUInt16BE(width, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app, frame]);
};
const webp = (chunk: 'VP8X' | 'VP8 ' | 'VP8L', width: number, height: number) => {
  const b = Buffer.alloc(32); b.write('RIFF', 0, 'latin1'); b.write('WEBP', 8, 'latin1'); b.write(chunk, 12, 'latin1');
  if (chunk === 'VP8X') { b.writeUIntLE(width - 1, 24, 3); b.writeUIntLE(height - 1, 27, 3); }
  else if (chunk === 'VP8 ') { b.writeUInt16LE(width, 26); b.writeUInt16LE(height, 28); }
  else b.writeUInt32LE((width - 1) | ((height - 1) << 14), 21);
  return b;
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

  // `orca plugin release-entry --json` printed these for the same images committed at packages/orca/images: the
  // path from the repository's root, and no caption or theme, which only the manifest carries.
  it('names the cover and screenshots at their path in the repository', () => {
    const dir = project();
    mkdirSync(join(dir, 'images'));
    writeFileSync(join(dir, 'images', 'cover.png'), png(1600, 1000, 0x40));
    writeFileSync(join(dir, 'images', 'panel.png'), png(1280, 800, 0x60));
    writeFileSync(join(dir, 'orca-plugin.json'), JSON.stringify({
      ...manifest, cover: { path: 'images/cover.png', alt: 'The fixture panel' },
      screenshots: [{ path: 'images/panel.png', alt: 'The panel in a dark theme', caption: 'Specs and tasks', theme: 'dark' }],
    }));
    expect(releaseEntry(dir, commit).images).toEqual({
      cover: { path: 'packages/orca/images/cover.png', alt: 'The fixture panel', sha256: 'd1ecb2891104a51fb636efa4f4cbc1bb855027e1271f921108577cb91c72b013', width: 1600, height: 1000 },
      screenshots: [{ path: 'packages/orca/images/panel.png', alt: 'The panel in a dark theme', sha256: 'ae00d115bdf3d236f126962c798d8bbf6225f806485552092c6f888fde773dbf', width: 1280, height: 800 }],
    });
  });

  it('leaves out a screenshot Orca would refuse, and one that is missing', () => {
    const dir = project();
    mkdirSync(join(dir, 'images'));
    writeFileSync(join(dir, 'images', 'small.png'), png(640, 400));
    writeFileSync(join(dir, 'orca-plugin.json'), JSON.stringify({
      ...manifest, screenshots: [{ path: 'images/small.png', alt: 'Too small' }, { path: 'images/gone.png', alt: 'Missing' }],
    }));
    expect(releaseEntry(dir, commit)).not.toHaveProperty('images');
  });
});

describe('imageProblem', () => {
  it("takes images inside Orca's limits", () => {
    expect(imageProblem('icon', png())).toBeNull();
    expect(imageProblem('cover', png(800, 500))).toBeNull();
    expect(imageProblem('screenshot', png(1280, 800))).toBeNull();
  });

  // the messages are Orca's, as `orca plugin validate` prints them
  it('refuses an image too small, the wrong shape or the wrong format', () => {
    expect(imageProblem('screenshot', png(640, 400))).toBe('screenshot must be at least 1280×800');
    expect(imageProblem('icon', png(256, 128))).toBe('icon must be square');
    expect(imageProblem('icon', jpeg(128, 128))).toBe('icon must be PNG or WEBP');
    expect(imageProblem('cover', Buffer.from('not an image'))).toBe('cover must be PNG or JPEG or WEBP');
  });
});

describe('imageInfo', () => {
  it('reads the size of a PNG, a JPEG and each kind of WebP', () => {
    expect(imageInfo(png(1280, 800))).toEqual({ format: 'png', width: 1280, height: 800 });
    expect(imageInfo(jpeg(1600, 1000))).toEqual({ format: 'jpeg', width: 1600, height: 1000 });
    for (const kind of ['VP8X', 'VP8 ', 'VP8L'] as const) expect(imageInfo(webp(kind, 1280, 800))).toEqual({ format: 'webp', width: 1280, height: 800 });
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
