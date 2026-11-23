// The `contentHash` a catalog release carries, computed the way Orca hashes a plugin it installs: Orca refuses a
// release whose files hash differently. Ported from Orca's own hashPluginTree; `orca plugin inspect <dir>` prints the
// same value, and test/bundle.test.ts pins one Orca computed. Run it on the plugin folder exactly as the release
// commit holds it (`git archive`), not on a working copy: node_modules and other untracked files would change it.
//
//   node scripts/content-hash.mjs <dir>
import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Every file under `dir`, depth first, each folder's entries in UTF-16 order; Orca skips only the top `.git`. */
const files = (root, dir = root, found = []) => {
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : +(a.name > b.name));
  for (const entry of entries) {
    if (dir === root && entry.name === '.git') continue;
    const path = join(dir, entry.name), stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error(`Orca refuses a symlink in a plugin: ${relative(root, path)}`);
    if (stat.isDirectory()) files(root, path, found);
    else if (stat.isFile()) found.push(path);
    else throw new Error(`Orca refuses this kind of entry in a plugin: ${relative(root, path)}`);
  }
  return found;
};

const length = n => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b; };

/** SHA-256 over a version tag, then for each file its path's byte length, the path, its size and its bytes. */
export function contentHash(dir) {
  const hash = createHash('sha256').update('orca-plugin-tree-v1\0');
  for (const path of files(dir)) {
    const name = relative(dir, path).split(sep).join('/'), bytes = readFileSync(path);
    hash.update(length(Buffer.byteLength(name, 'utf8'))).update(name, 'utf8').update(length(bytes.length)).update(bytes);
  }
  return hash.digest('hex');
}

// realpath on both sides: a temp folder reached through a symlink (macOS /var) would otherwise never match
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  if (!process.argv[2]) throw new Error('usage: node scripts/content-hash.mjs <dir>');
  console.log(contentHash(resolve(process.argv[2])));
}
