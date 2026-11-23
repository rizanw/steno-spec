// Checks what `pnpm build` left in dist/, the files Orca installs as they are. Run the build first.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { contentHash } from '../scripts/content-hash.mjs';

const here = join(import.meta.dirname, '..');
const dist = join(here, 'dist');
const skills = join(here, '..', 'skills', 'skills');
const manifest = JSON.parse(readFileSync(join(here, 'orca-plugin.json'), 'utf8'));

const filesUnder = (dir: string) => readdirSync(dir, { recursive: true, withFileTypes: true }).filter(e => e.isFile())
  .map(e => relative(dir, join(e.parentPath, e.name)).split(sep).join('/')).sort();

describe('dist/', () => {
  it('holds the worker, the panel and both programs', () => {
    for (const file of ['worker.mjs', 'panel.html', 'panel.js', 'panel.css', 'vendor/steno-lsp.mjs', 'vendor/steno-cli.mjs']) expect(existsSync(join(dist, file)), file).toBe(true);
  });

  it('carries every file a manifest field names', () => {
    const paths = [manifest.main, manifest.icon, ...manifest.contributes.panels.map((p: { entry: string }) => p.entry)];
    for (const path of paths) expect(existsSync(join(here, path)), path).toBe(true);
  });

  // Orca refuses a plugin icon that is not a square PNG of at least 128 px and at most 256 KB.
  it('carries the steno mark as an icon Orca accepts', () => {
    const png = readFileSync(join(here, manifest.icon));
    expect(png.subarray(1, 4).toString('latin1')).toBe('PNG');
    const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
    expect(width).toBe(height);
    expect(width).toBeGreaterThanOrEqual(128);
    expect(png.length).toBeLessThanOrEqual(256 * 1024);
    expect(png.equals(readFileSync(join(here, '..', '..', 'assets', 'steno.png')))).toBe(true);
  });

  it('carries the skills exactly as packages/skills has them', () => {
    const files = filesUnder(skills);
    expect(filesUnder(join(dist, 'skills'))).toEqual(files);
    for (const file of files) expect(readFileSync(join(dist, 'skills', file), 'utf8')).toBe(readFileSync(join(skills, file), 'utf8'));
  });

  it('copies the programs the CLI package built, unchanged', () => {
    for (const program of ['steno-lsp.mjs', 'steno-cli.mjs']) {
      expect(readFileSync(join(dist, 'vendor', program), 'utf8')).toBe(readFileSync(join(here, '..', 'cli', 'bin', program), 'utf8'));
    }
  });

  // Orca loads only the plugin's own files into the panel's page, so everything it runs must be in panel.js itself.
  it('builds a page that loads only its own script and styles, with nothing left to import', () => {
    const page = readFileSync(join(dist, 'panel.html'), 'utf8');
    const loaded = [...page.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]).sort();
    expect(loaded).toEqual(['./panel.css', './panel.js']);
    const script = readFileSync(join(dist, 'panel.js'), 'utf8');
    expect(script).not.toMatch(/(?:^|[;\s])import\s*[\w{*"']|import\(/m);
    expect(script).not.toMatch(/\bfrom\s*["']/);
  });

  it('gives the worker the default export Orca calls', async () => {
    const worker = await import(pathToFileURL(join(dist, 'worker.mjs')).href);
    expect(typeof worker.default).toBe('function');
  });
});

// Orca refuses a catalog release whose files hash differently, so the expected value comes from Orca itself:
// `orca plugin inspect <dir> --json` on these files. The names cover Orca's ordering: upper case before lower,
// a folder before a longer name it prefixes, nested and non-ASCII paths, an empty file and a skipped top `.git`.
describe('contentHash', () => {
  const fixture: Record<string, string> = {
    'orca-plugin.json': '{\n  "manifestVersion": 2,\n  "id": "fixture",\n  "name": "fixture",\n  "version": "1.0.0",\n  "engines": { "orca": ">=1.4.248" },\n  "execution": "trusted-worker",\n  "main": "worker.mjs"\n}\n',
    'worker.mjs': 'export default function activate() {}\n',
    'B.txt': 'upper\n', 'a.txt': 'lower\n', 'empty': '', 'a/z.txt': 'nested\n', 'a-b/x.txt': 'dash\n', 'Z/\u00e9.md': 'caf\u00e9\n',
    '.git/HEAD': 'ref: x\n',
  };
  const project = (files: Record<string, string>) => {
    const dir = mkdtempSync(join(tmpdir(), 'steno-orca-hash-'));
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(join(dir, path, '..'), { recursive: true });
      writeFileSync(join(dir, path), text);
    }
    return dir;
  };

  it('matches the hash Orca computed for the same files', () => {
    expect(contentHash(project(fixture))).toBe('0c6a9568a7f02058058893cd7c1627ff35fcb778ec03b9c91f861add38f2cfd1');
  });

  it('changes when a file is renamed, though no byte changed', () => {
    const { 'B.txt': upper, ...rest } = fixture;
    expect(contentHash(project({ ...rest, 'C.txt': upper }))).not.toBe(contentHash(project(fixture)));
  });
});
