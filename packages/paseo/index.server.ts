import type { PluginServerContext } from '@getpaseo/plugin/server';
import { tmpdir } from 'node:os';
import { createMessageConnection, StreamMessageReader, StreamMessageWriter } from './server/vendor/host.mjs';
import { runProgram, runToEnd, unpack } from './server/programs';

/** Start the language server, ask for its name with `initialize`, and shut it down. */
async function probeServer(): Promise<string> {
  const child = runProgram('steno-lsp.mjs', [], { cwd: tmpdir(), stdio: ['pipe', 'pipe', 'inherit'] });
  const connection = createMessageConnection(new StreamMessageReader(child.stdout!), new StreamMessageWriter(child.stdin!));
  connection.listen();
  try {
    const result = await connection.sendRequest<{ serverInfo?: { name: string; version?: string } }>('initialize', {
      processId: process.pid, rootUri: null, capabilities: {},
    });
    await connection.sendRequest('shutdown');
    connection.sendNotification('exit');
    return `${result.serverInfo?.name ?? 'unnamed'} ${result.serverInfo?.version ?? ''}`.trim();
  } finally {
    connection.dispose();
    child.kill();
  }
}

export default function contribute(_server: PluginServerContext) {
  // One log line per bundled program at start-up, so `paseo plugin logs steno` shows whether the plugin can run both.
  try {
    console.log(`steno: programs in ${unpack()}`);
    runToEnd('steno-cli.mjs', ['--version']).then(
      r => console.log(`steno: cli started: ${r.stdout.trim() || `exit ${r.code} ${r.stderr.trim()}`}`),
      err => console.error(`steno: cli failed: ${err}`));
    probeServer().then(v => console.log(`steno: language server started: ${v}`), err => console.error(`steno: language server failed: ${err}`));
  } catch (err) {
    console.error(`steno: could not unpack the bundled programs: ${err}`);
  }
  return () => {};
}
