// Builds the `.vsix` payload: dist/extension.js (CommonJS, `vscode` external), the release's server and CLI
// bundles copied from packages/cli/bin, the skills `init` installs, and the repo LICENSE beside the manifest.
import { build } from 'esbuild';
import { copyFileSync, cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const dist = join(here, 'dist');

// CommonJS: the extension host loads `main` with require, and `vscode` is supplied by the host, never bundled.
await build({
  entryPoints: [join(here, 'src', 'extension.ts')],
  outfile: join(dist, 'extension.js'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node24',
  external: ['vscode'],
});

// The bundled server and CLI: built by packages/cli, which runs first because it is a devDependency of this package.
mkdirSync(dist, { recursive: true });
for (const file of ['steno-lsp.mjs', 'steno-cli.mjs']) {
  copyFileSync(join(root, 'packages', 'cli', 'bin', file), join(dist, file));
}
copyFileSync(join(root, 'LICENSE'), join(here, 'LICENSE'));

// Ship the skills that `steno init` installs. The bundled CLI looks for a `skills/` folder next to `dist/` first,
// so setting up a project from inside VS Code works without the @steno/skills package.
const skills = join(here, 'skills');
rmSync(skills, { recursive: true, force: true });
cpSync(join(root, 'packages', 'skills', 'skills'), skills, { recursive: true });

// The artwork the manifest points at: brand art lives in assets/, so it is copied in rather than kept
// twice. `icon.png` is the marketplace listing icon, `steno.svg` the activity bar and view glyph.
const media = join(here, 'media');
mkdirSync(media, { recursive: true });
copyFileSync(join(root, 'assets', 'steno.png'), join(media, 'icon.png'));
copyFileSync(join(root, 'assets', 'steno-mono.svg'), join(media, 'steno.svg'));
