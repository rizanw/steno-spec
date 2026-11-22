import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: 'orca', include: ['packages/orca/test/**/*.test.ts', 'test/**/*.test.ts'] },
});
