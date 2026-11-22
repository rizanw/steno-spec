// Generates dist/, which is what Orca installs: the worker and the panel, the language server and CLI the worker runs,
// and the skills `steno init` installs. Orca runs no build and installs no npm dependencies, so everything the plugin
// needs at run time is bundled or copied here. Orca keeps the plugin's files on disk, so the programs stay plain files
// beside the worker rather than text embedded in it.
import { build } from 'esbuild';
import { builtinModules } from 'node:module';
import { copyFileSync, cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(here, '..', '..');
const dist = join(here, 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'vendor'), { recursive: true });

// vscode-jsonrpc, which @steno/host pulls in, is CommonJS and requires Node built-ins, so the bundle gets a `require`.
await build({
  entryPoints: [join(here, 'src', 'worker.ts')],
  outfile: join(dist, 'worker.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  banner: { js: "import { createRequire as __stenoCreateRequire } from 'node:module'; const require = __stenoCreateRequire(import.meta.url);" },
});

// The panel is a page Orca shows in its sidebar (an html panel). Orca loads only the plugin's own files there, so
// Preact and the icons are bundled into panel.js and its CSS into panel.css beside it. Node's modules do not exist in
// that page: an import of one stops the build here, rather than leaving a panel that fails only once Orca loads it.
const builtins = new Set([...builtinModules, ...builtinModules.map(m => `node:${m}`)]);
await build({
  entryPoints: [join(here, 'src', 'panel', 'panel.tsx')],
  outfile: join(dist, 'panel.js'),
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: 'es2022',
  jsx: 'automatic',
  jsxImportSource: 'preact',
  minify: true,
  legalComments: 'none',
  plugins: [{
    name: 'no-node',
    setup(b) {
      b.onResolve({ filter: /.*/ }, args => builtins.has(args.path)
        ? { errors: [{ text: `the panel imports the Node module "${args.path}" (from ${relative(root, args.importer)})` }] }
        : undefined);
    },
  }],
});
copyFileSync(join(here, 'src', 'panel', 'panel.html'), join(dist, 'panel.html'));

// The programs are built by packages/cli, which runs first because it is a devDependency of this package.
for (const program of ['steno-lsp.mjs', 'steno-cli.mjs']) copyFileSync(join(root, 'packages', 'cli', 'bin', program), join(dist, 'vendor', program));
cpSync(join(root, 'packages', 'skills', 'skills'), join(dist, 'skills'), { recursive: true });

// The icon beside the plugin's name in Orca's plugin list and catalog. Brand art lives in assets/, so it is copied in
// rather than kept twice. The panel tab cannot use it: Orca takes only one of its built-in icon names there.
copyFileSync(join(root, 'assets', 'steno.png'), join(dist, 'icon.png'));
