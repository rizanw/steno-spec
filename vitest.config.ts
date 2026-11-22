import { defineConfig } from 'vitest/config';

// One project per package, so a package can bring its own aliases (packages/vscode stubs the `vscode` module)
// while root `pnpm test` still runs every package's unit tests in one go.
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'core', include: ['packages/core/test/**/*.test.ts'] } },
      { test: { name: 'host', include: ['packages/host/test/**/*.test.ts'] } },
      // The CLI tests start real node processes, several per test. Starting one takes about a second on the
      // Windows CI runner, so vitest's default 5 s limit fails tests there that pass everywhere else.
      { test: { name: 'cli', include: ['packages/cli/test/**/*.test.ts'], testTimeout: 20_000 } },
      'packages/vscode/vitest.config.ts',
      'packages/paseo/vitest.config.ts',
    ],
  },
});
