// Builds the published `steno-spec` package: one bundled entry point (core inlined)
// plus a copy of the skills, so the tarball needs no workspace packages.
import { build } from 'esbuild';
import { cpSync, rmSync, chmodSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

await build({
  entryPoints: [join(here, 'src', 'main.ts')],
  outfile: join(here, 'bin', 'steno.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  // Third-party packages stay real dependencies; only @steno/core is inlined.
  external: ['commander', 'picomatch', 'yaml'],
});
chmodSync(join(here, 'bin', 'steno.js'), 0o755);

rmSync(join(here, 'skills'), { recursive: true, force: true });
cpSync(join(here, '..', 'skills', 'skills'), join(here, 'skills'), { recursive: true });

// On pack, ship the repo README and LICENSE with the package.
if (process.argv.includes('--readme')) {
  if (existsSync(join(root, 'LICENSE'))) copyFileSync(join(root, 'LICENSE'), join(here, 'LICENSE'));
  // npm does not render mermaid: swap each diagram for the text version kept in the comment after it.
  const readme = readFileSync(join(root, 'README.md'), 'utf8')
    .replace(/```mermaid\r?\n[\s\S]*?\r?\n```\r?\n<!-- npm-text\r?\n([\s\S]*?)\r?\n-->/g, '$1');
  writeFileSync(join(here, 'README.md'), readme);
}
