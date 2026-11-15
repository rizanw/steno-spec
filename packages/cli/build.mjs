// Builds the published `steno-spec` package: one bundled entry point (core inlined)
// plus a copy of the skills, so the tarball needs no workspace packages.
import { build } from 'esbuild';
import { cpSync, rmSync, chmodSync, copyFileSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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
  writeFileSync(join(here, 'README.md'), absoluteLinks(readme));
}

// npm resolves relative README links against npmjs.com, so point them at the repo instead:
// images at raw.githubusercontent.com, everything else at the GitHub file view.
function absoluteLinks(md) {
  const { repository } = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'));
  const slug = repository.url.match(/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/)[1];
  const toUrl = (path) => {
    path = path.replace(/^\.\//, '');
    if (/\.(svg|png|jpe?g|gif|webp)$/i.test(path)) {
      // raw.githubusercontent.com serves SVG as text/plain unless asked to sanitize it.
      return `https://raw.githubusercontent.com/${slug}/main/${path}${path.endsWith('.svg') ? '?sanitize=true' : ''}`;
    }
    const file = path.replace(/#.*$/, '');
    const isDir = existsSync(join(root, file)) && statSync(join(root, file)).isDirectory();
    return `https://github.com/${slug}/${isDir ? 'tree' : 'blob'}/main/${path}`;
  };
  const relative = /^(?![a-z][a-z0-9+.-]*:|#|\/)/i; // not a URL, anchor or absolute path
  return md
    .replace(/(\]\()([^)\s]+)(\))/g, (m, a, path, b) => (relative.test(path) ? a + toUrl(path) + b : m))
    .replace(/((?:src|href)=")([^"]+)(")/g, (m, a, path, b) => (relative.test(path) ? a + toUrl(path) + b : m));
}
