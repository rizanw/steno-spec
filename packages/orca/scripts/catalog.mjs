// Lists a release of the plugin in orca-catalog.json, the catalog Orca reads from this repository's main branch.
// The release entry is the one `orca plugin release-entry` prints, built the same way so CI needs no Orca install:
// Orca refuses an install whose commit, file hash, version, execution, Orca range, contributions or capabilities
// differ from what the entry says. test/catalog.test.ts pins an entry Orca printed.
//
//   node scripts/catalog.mjs <orca-catalog.json> <plugin dir> <commit> <owner/repo>
//
// <plugin dir> is packages/orca exactly as <commit> holds it (`git archive`). The catalog is rewritten in place,
// unless it already lists this version; it must sit at the root of a checkout of main, which holds the icon.
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentHash } from './content-hash.mjs';

/** Where the plugin sits in the repository. */
export const PLUGIN_PATH = 'packages/orca';
/** The listing's icon on main: the same file build.mjs copies into dist/icon.png. */
export const ICON_PATH = 'assets/steno.png';
// Orca reads only the first 32 releases of an entry, and its validator refuses more.
const RELEASE_LIMIT = 32;

// The listing's summary of what the plugin adds, in Orca's kind order. Only the kinds this plugin can use are here.
const summary = contributes => [
  ...(contributes.panels ?? []).map(p => ({ kind: 'panels', name: p.title })),
  ...(contributes.commands ?? []).map(c => ({ kind: 'commands', name: c.title })),
  ...(contributes.events ?? []).map(e => ({ kind: 'events', name: e.on })),
  ...(contributes.hooks ?? []).map(h => ({ kind: 'hooks', name: h.event })),
];

/**
 * Orca's limits on the listing's images. `orca plugin validate` refuses a manifest image outside them, and Orca's
 * release entry leaves such an image out, so this script does the same.
 */
export const IMAGE_RULES = {
  icon: { formats: ['png', 'webp'], maxBytes: 256 * 1024, minWidth: 128, minHeight: 128, square: true },
  cover: { formats: ['png', 'jpeg', 'webp'], maxBytes: 1024 * 1024, minWidth: 800, minHeight: 500 },
  screenshot: { formats: ['png', 'jpeg', 'webp'], maxBytes: 1536 * 1024, minWidth: 1280, minHeight: 800 },
};
export const MAX_SCREENSHOTS = 6;
/** All of a listing's images together. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

/** An image's format and size from its header, or null when the bytes are not a PNG, JPEG or WebP. */
export function imageInfo(bytes) {
  const text = (from, to) => bytes.subarray(from, to).toString('latin1');
  if (text(1, 4) === 'PNG') return { format: 'png', width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    // a JPEG's size is in its start-of-frame segment, after any number of others
    for (let at = 2; at + 9 <= bytes.length && bytes[at] === 0xff; at += 2 + bytes.readUInt16BE(at + 2))
      if (SOF.has(bytes[at + 1])) return { format: 'jpeg', width: bytes.readUInt16BE(at + 7), height: bytes.readUInt16BE(at + 5) };
    return null;
  }
  if (text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP') {
    const chunk = text(12, 16);
    if (chunk === 'VP8X') return { format: 'webp', width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
    if (chunk === 'VP8 ') return { format: 'webp', width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') { const b = bytes.readUInt32LE(21); return { format: 'webp', width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 }; }
  }
  return null;
}

/** Why Orca refuses `bytes` as a `kind` image (icon, cover or screenshot), in Orca's words, or null when it takes them. */
export function imageProblem(kind, bytes) {
  const rule = IMAGE_RULES[kind], info = imageInfo(bytes);
  if (!info || !rule.formats.includes(info.format)) return `${kind} must be ${rule.formats.map(f => f.toUpperCase()).join(' or ')}`;
  if (bytes.length > rule.maxBytes) return `${kind} must be at most ${Math.round(rule.maxBytes / 1024)} KB`;
  if (info.width < rule.minWidth || info.height < rule.minHeight) return `${kind} must be at least ${rule.minWidth}×${rule.minHeight}`;
  if (rule.square && info.width !== info.height) return `${kind} must be square`;
  return null;
}

/** A listing image as a catalog names it, or null for one Orca would refuse. `path` is from the repository's root. */
const listingImage = (kind, path, alt, bytes) => {
  if (!bytes || imageProblem(kind, bytes)) return null;
  const { width, height } = imageInfo(bytes);
  return { path, alt, sha256: createHash('sha256').update(bytes).digest('hex'), width, height };
};

const readOrNull = path => { try { return readFileSync(path); } catch { return null; } };

/**
 * The catalog release for the plugin files in `dir`, committed as `commit`. `icon` is the listing's icon, a file in
 * the catalog's own repository at the path given: Orca fetches it from main, which never holds dist/. The manifest's
 * cover and screenshots are committed in the plugin folder, so they are named at their path in the repository.
 */
export function releaseEntry(dir, commit, icon) {
  const manifest = JSON.parse(readFileSync(join(dir, 'orca-plugin.json'), 'utf8'));
  const capabilities = [...new Set((manifest.capabilities ?? []).map(c => c.kind))];
  const own = (kind, image) => listingImage(kind, `${PLUGIN_PATH}/${image.path}`, image.alt, readOrNull(join(dir, image.path)));
  const images = {
    icon: icon && listingImage('icon', icon.path, manifest.name ?? 'Plugin icon', icon.bytes),
    cover: manifest.cover && own('cover', manifest.cover),
    screenshots: (manifest.screenshots ?? []).map(s => own('screenshot', s)).filter(Boolean),
  };
  if (!images.screenshots.length) delete images.screenshots;
  for (const key of ['icon', 'cover']) if (!images[key]) delete images[key];
  return {
    version: manifest.version, commit, contentHash: contentHash(dir), execution: manifest.execution,
    minimumOrca: manifest.engines.orca.replace(/^>=/, ''), name: manifest.name, contributes: summary(manifest.contributes ?? {}),
    ...(capabilities.length ? { capabilities } : {}),
    ...(Object.keys(images).length ? { images } : {}),
  };
}

/** The catalog with `release` listed first under the plugin's entry; the same object when that version is listed. */
export function addRelease(catalog, release, { id, repository, description }) {
  const plugins = catalog.plugins ?? [], at = plugins.findIndex(p => p.id === id);
  if (at >= 0 && plugins[at].releases.some(r => r.version === release.version)) return catalog;
  const entry = at >= 0
    ? { ...plugins[at], releases: [release, ...plugins[at].releases].slice(0, RELEASE_LIMIT) }
    : { id, source: { kind: 'git', url: `https://github.com/${repository}.git`, ref: 'main', path: PLUGIN_PATH }, ...(description ? { description } : {}), releases: [release] };
  return { ...catalog, plugins: at >= 0 ? plugins.map((p, i) => i === at ? entry : p) : [...plugins, entry] };
}

// realpath on both sides: a temp folder reached through a symlink (macOS /var) would otherwise never match
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const [file, dir, commit, repository] = process.argv.slice(2);
  if (!repository) throw new Error('usage: node scripts/catalog.mjs <orca-catalog.json> <plugin dir> <commit> <owner/repo>');
  const manifest = JSON.parse(readFileSync(join(dir, 'orca-plugin.json'), 'utf8'));
  // Orca installs a catalog plugin under <repository owner>.<manifest id>, whatever the manifest says.
  const id = `${repository.split('/')[0].toLowerCase()}.${manifest.id}`;
  const icon = { path: ICON_PATH, bytes: readFileSync(join(dirname(resolve(file)), ICON_PATH)) };
  const catalog = JSON.parse(readFileSync(file, 'utf8')), release = releaseEntry(resolve(dir), commit, icon);
  const next = addRelease(catalog, release, { id, repository, description: manifest.description });
  if (next === catalog) console.log(`${file} already lists ${id} ${release.version}`);
  else { writeFileSync(file, JSON.stringify(next, null, 2) + '\n'); console.log(`listed ${id} ${release.version} at ${commit}`); }
}
