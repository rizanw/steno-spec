import type { Command } from 'commander';
import { StenoError } from '@steno/core';

/** `steno lsp`: the language server on stdin/stdout. Only this command loads the protocol library (bin/lsp.js). */
export function register(program: Command): void {
  program.command('lsp')
    .description('run the steno language server over standard input and output (for editors)')
    .action(async () => {
      // the server serves the root the editor names; it never searches upwards
      if (program.opts().root !== undefined) throw new StenoError('invalid-request', '--root does not apply to steno lsp; the editor names the root', { field: 'root' });
      // built at run time so the bundler leaves bin/lsp.js as its own file instead of inlining it
      const server = './lsp.js';
      const { startServer } = await import(new URL(server, import.meta.url).href) as typeof import('../lsp/server.js');
      startServer(process.stdin, process.stdout);
    });
}
