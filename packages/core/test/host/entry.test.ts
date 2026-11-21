// The host entry point is bundled into editors, so everything it reaches must stay inside this package and
// free of dependencies: a stray `yaml` or `node:fs` import would ship a parser or a disk reader to every host.
// It reads the built files because the import graph that matters is the one a bundler follows.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PACKAGE = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ENTRY = join(PACKAGE, 'dist', 'host', 'index.js');
const ALLOWED = new Set(['node:path']);
// The interface entry is bundled for a browser, where no Node module exists at all.
const UI_SUBPATH = './host/ui';

/** The module specifiers of every static import, re-export and dynamic import in a built file. */
function specifiers(code: string): string[] {
  const found: string[] = [];
  const patterns = [/\b(?:import|export)\s[^'"]*?\sfrom\s*['"]([^'"]+)['"]/g, /\bimport\s*['"]([^'"]+)['"]/g, /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g];
  for (const pattern of patterns) for (const match of code.matchAll(pattern)) found.push(match[1]);
  return found;
}

/** Follows relative imports from `entry` and lists each import that leaves the package or names anything but an allowed built-in. */
function outsideImports(entry: string, root: string, allowed: ReadonlySet<string> = ALLOWED): string[] {
  const seen = new Set<string>();
  const bad: string[] = [];
  const visit = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const spec of specifiers(readFileSync(file, 'utf8'))) {
      const from = relative(root, file);
      if (!spec.startsWith('.')) {
        if (!allowed.has(spec)) bad.push(`${from} imports ${spec}`);
        continue;
      }
      const target = resolve(dirname(file), spec);
      if (!target.startsWith(root + sep)) bad.push(`${from} imports ${spec}, outside the package`);
      else if (!existsSync(target)) bad.push(`${from} imports ${spec}, which does not exist`);
      else visit(target);
    }
  };
  visit(entry);
  return bad;
}

describe('host entry point', () => {
  it('reaches nothing outside the package but node:path', () => {
    expect(existsSync(ENTRY), `${ENTRY} is missing: run pnpm build first`).toBe(true);
    expect(outsideImports(ENTRY, PACKAGE)).toEqual([]);
  });

  it('offers the interface entry as a subpath that reaches no Node module', async () => {
    const exports = JSON.parse(readFileSync(join(PACKAGE, 'package.json'), 'utf8')).exports as Record<string, { default: string; types: string }>;
    const ui = exports[UI_SUBPATH];
    expect(ui, `package.json has no ${UI_SUBPATH} export`).toBeDefined();
    const file = join(PACKAGE, ui.default);
    expect(existsSync(file), `${file} is missing: run pnpm build first`).toBe(true);
    expect(existsSync(join(PACKAGE, ui.types))).toBe(true);
    expect(outsideImports(file, PACKAGE, new Set())).toEqual([]);
    const mod = await import(pathToFileURL(file).href);
    for (const name of ['REQUESTS', 'TREE_CHANGED', 'reopenWording', 'reopenedMessage', 'specsDir', 'steeringDir', 'documentPath', 'callForm', 'render', 'skillCall']) {
      expect(mod, name).toHaveProperty(name);
    }
    // nothing from the process rules or the CLI runs, which are for the host's Node side
    for (const name of ['parentProject', 'findOnPath', 'newSpec', 'TreeFetcher']) expect(mod, name).not.toHaveProperty(name);
  });

  it('reads static, side-effect and dynamic imports alike', () => {
    const code = `import { a } from './a.js';\nexport * from "./b.js";\nimport 'yaml';\nconst c = await import('node:fs');\nexport { d } from './d.js';`;
    expect(specifiers(code).sort()).toEqual(['./a.js', './b.js', './d.js', 'node:fs', 'yaml']);
  });
});
