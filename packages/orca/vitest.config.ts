import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// the version build.mjs compiles into the worker, so the tests see the same bundled version
const cli = JSON.parse(readFileSync(new URL('../cli/package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  define: { __STENO_VERSION__: JSON.stringify(cli.version) },
  test: { name: 'orca', include: ['packages/orca/test/**/*.test.ts', 'test/**/*.test.ts'] },
});
