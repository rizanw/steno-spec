// The server bundle entry point: bin/steno-lsp.mjs, one file with every dependency inlined, which a Client can copy and run with Node.
import { startServer } from './server.js';

startServer(process.stdin, process.stdout);
