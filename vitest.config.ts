import { defineConfig } from 'vitest/config';

// One project per package, so a package can bring its own aliases (packages/vscode stubs the `vscode` module)
// while root `pnpm test` still runs every package's unit tests in one go.
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'core', include: ['packages/core/test/**/*.test.ts'] } },
      { test: { name: 'cli', include: ['packages/cli/test/**/*.test.ts'] } },
      'packages/vscode/vitest.config.ts',
    ],
  },
});
