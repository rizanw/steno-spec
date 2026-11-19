// Builds the published `steno-spec` package: bin/steno.js and bin/lsp.js (core inlined), the self-contained
// bundles bin/steno-lsp.mjs and bin/steno-cli.mjs, and a copy of the skills, so the tarball needs no workspace packages.
import { build } from 'esbuild';
import { cpSync, rmSync, chmodSync, copyFileSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
// the release version, compiled into every build so each one reports it wherever the files are placed
const define = { __STENO_VERSION__: JSON.stringify(JSON.parse(readFileSync(join(here, 'package.json'), 'utf8')).version) };

await build({
  entryPoints: [join(here, 'src', 'main.ts')],
  outfile: join(here, 'bin', 'steno.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  define,
  // Third-party packages stay real dependencies; only @steno/core is inlined.
  external: ['commander', 'picomatch', 'yaml', 'vscode-languageserver', 'vscode-languageserver-textdocument'],
});
chmodSync(join(here, 'bin', 'steno.js'), 0o755);

// The language server is its own file, loaded by `steno lsp` alone, so other commands never load the protocol library.
await build({
  entryPoints: [join(here, 'src', 'lsp', 'server.ts')],
  outfile: join(here, 'bin', 'lsp.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  define,
  external: ['commander', 'picomatch', 'yaml', 'vscode-languageserver', 'vscode-languageserver-textdocument'],
});

// The server bundle: the same server with every dependency inlined, for a Client to copy into its own package.
// `.mjs` so Node runs it as an ES module whatever package.json sits near it; the protocol library is CommonJS
// and requires Node built-ins, so the banner gives the module a `require`.
await build({
  entryPoints: [join(here, 'src', 'lsp', 'bundle.ts')],
  outfile: join(here, 'bin', 'steno-lsp.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  define,
  banner: { js: "import { createRequire as __stenoCreateRequire } from 'node:module'; const require = __stenoCreateRequire(import.meta.url);" },
});

// The CLI bundle: the same CLI with every dependency inlined, for a Client to copy into its own package.
// `.mjs` and the `require` banner for the same reasons as the server bundle.
await build({
  entryPoints: [join(here, 'src', 'main.ts')],
  outfile: join(here, 'bin', 'steno-cli.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  define,
  banner: { js: "import { createRequire as __stenoCreateRequire } from 'node:module'; const require = __stenoCreateRequire(import.meta.url);" },
});

rmSync(join(here, 'skills'), { recursive: true, force: true });
cpSync(join(here, '..', 'skills', 'skills'), join(here, 'skills'), { recursive: true });

// On pack, ship the repo README, LICENSE and JSON contract with the package.
if (process.argv.includes('--readme')) {
  if (existsSync(join(root, 'LICENSE'))) copyFileSync(join(root, 'LICENSE'), join(here, 'LICENSE'));
  // npm does not render mermaid: swap each diagram for the text version kept in the comment after it.
  const readme = readFileSync(join(root, 'README.md'), 'utf8')
    .replace(/```mermaid\r?\n[\s\S]*?\r?\n```\r?\n<!-- npm-text\r?\n([\s\S]*?)\r?\n-->/g, '$1');
  writeFileSync(join(here, 'README.md'), absoluteLinks(readme));
  // the JSON contract ships with the release it describes
  writeFileSync(join(here, 'JSON-CONTRACT.md'), absoluteLinks(readFileSync(join(root, 'docs', 'json-contract.md'), 'utf8')));
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
