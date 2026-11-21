import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: 'paseo', include: ['packages/paseo/test/**/*.test.ts', 'test/**/*.test.ts'] },
});
