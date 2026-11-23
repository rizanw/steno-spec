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

/** A PNG's size from its header, or null when the bytes are not a PNG. */
const pngSize = bytes => bytes.subarray(1, 4).toString('latin1') === 'PNG' ? { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) } : null;

/**
 * The catalog release for the plugin files in `dir`, committed as `commit`. `icon` is the listing's icon, a file in
 * the catalog's own repository at the path given: Orca fetches it from main, which never holds dist/.
 */
export function releaseEntry(dir, commit, icon) {
  const manifest = JSON.parse(readFileSync(join(dir, 'orca-plugin.json'), 'utf8'));
  const capabilities = [...new Set((manifest.capabilities ?? []).map(c => c.kind))];
  const size = icon && pngSize(icon.bytes);
  return {
    version: manifest.version, commit, contentHash: contentHash(dir), execution: manifest.execution,
    minimumOrca: manifest.engines.orca.replace(/^>=/, ''), name: manifest.name, contributes: summary(manifest.contributes ?? {}),
    ...(capabilities.length ? { capabilities } : {}),
    ...(size ? { images: { icon: { path: icon.path, alt: manifest.name ?? 'Plugin icon', sha256: createHash('sha256').update(icon.bytes).digest('hex'), ...size } } } : {}),
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
