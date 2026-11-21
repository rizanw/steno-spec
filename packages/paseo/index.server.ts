import type { PluginServerContext } from '@getpaseo/plugin/server';
import { tmpdir } from 'node:os';
import { createMessageConnection, StreamMessageReader, StreamMessageWriter } from './server/vendor/host.mjs';
import { runProgram, runToEnd, unpack } from './server/programs';
import { createPool } from './server/pool';
import { streamPanel, workspaceDirectory } from './server/snapshot';
import { call, change, intent, listAgents, newSpec, panel, readFile, restart, setUp } from './shared/contracts';
import { checkAgentSteno } from './server/agent-steno';
import { buildCall } from './server/calls';
import { applyChange } from './server/changes';
import * as cli from './server/cli';
import { createIntents } from './server/intent';
import { readListed } from './server/read';

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
    // the server may exit before this is written; a failed write only means it is already gone
    connection.sendNotification('exit').catch(() => {});
    return `${result.serverInfo?.name ?? 'unnamed'} ${result.serverInfo?.version ?? ''}`.trim();
  } finally {
    connection.dispose();
    child.kill();
  }
}

export default function contribute(server: PluginServerContext) {
  const pool = createPool();
  const intents = createIntents();
  // the subscription stays open until its signal aborts, so the handler's promise settles only then
  server.handle(panel, async ({ workspaceId }, { paseo, push, signal }) => {
    const directory = await workspaceDirectory(paseo, workspaceId);
    await streamPanel(pool, { workspaceId, directory, push, signal }, { intents, checkAgentSteno: () => checkAgentSteno() });
    if (!signal.aborted) await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }));
  });
  server.handle(restart, async ({ workspaceId }, { paseo }) => {
    pool.restart(await workspaceDirectory(paseo, workspaceId));
    return {};
  });
  server.handle(readFile, async ({ workspaceId, path }, { paseo }) =>
    readListed(pool.serverFor(await workspaceDirectory(paseo, workspaceId)), path));
  server.handle(change, async ({ workspaceId, ...req }, { paseo }) =>
    applyChange(pool.serverFor(await workspaceDirectory(paseo, workspaceId)), req));
  server.handle(call, ({ handoff, provider }) => buildCall(handoff, provider));
  server.handle(newSpec, async ({ workspaceId, ...req }, { paseo }) => cli.newSpec(await workspaceDirectory(paseo, workspaceId), req));
  server.handle(listAgents, async ({ workspaceId }, { paseo }) => cli.listAgents(await workspaceDirectory(paseo, workspaceId)));
  server.handle(setUp, async ({ workspaceId, agents }, { paseo }) => cli.setUp(await workspaceDirectory(paseo, workspaceId), agents));
  server.handle(intent, ({ workspaceId, action }) => { intents.set(workspaceId, action); return {}; });

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
  return () => pool.dispose();
}
