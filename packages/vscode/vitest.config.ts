import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// `vscode` is supplied by the extension host, never installed, so unit tests resolve it to a stub.
// Only `*.test.ts` is collected: the `.e2e.ts` files run inside VS Code under @vscode/test-electron.
export default defineConfig({
  test: {
    name: 'vscode',
    include: ['packages/vscode/test/**/*.test.ts', 'test/**/*.test.ts'],
    alias: {
      vscode: fileURLToPath(new URL('./test/vscode-stub.ts', import.meta.url)),
      'vscode-languageclient/node': fileURLToPath(new URL('./test/languageclient-stub.ts', import.meta.url)),
    },
  },
});
