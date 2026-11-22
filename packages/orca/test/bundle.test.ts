// Checks what `pnpm build` left in dist/, the files Orca installs as they are. Run the build first.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

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
