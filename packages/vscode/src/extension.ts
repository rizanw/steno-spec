// The extension's entry point: one bundled server per workspace folder, stopped again on deactivate.
import type * as vscode from 'vscode';
import { registerActions } from './actions.js';
import { bundled } from './bundled.js';
import { Chooser, hostProbe, registerChooser } from './chooser.js';
import { registerHandoffs } from './handoff.js';
import { registerNewSpec } from './new-spec.js';
import { registerProbe } from './probe.js';
import { ServerPool, trackFolders } from './servers.js';
import { registerSetUp } from './setup.js';
import { registerSpecTree } from './tree.js';

let pool: ServerPool | undefined;

// returns nothing: the extension exposes no API, so no other extension can reach a state change
export function activate(ctx: vscode.ExtensionContext): void {
  const { server, cli } = bundled(ctx);
  pool = new ServerPool(server);
  const tree = registerSpecTree(pool);
  const probe = hostProbe();
  const chooser = new Chooser(ctx.workspaceState, probe, pool);
  const deps = { chooser, probe };
  ctx.subscriptions.push(
    ...tree.disposables, ...registerActions(pool), registerNewSpec(pool, cli, deps), registerSetUp(pool, cli), trackFolders(pool),
    chooser, registerChooser(chooser), ...registerHandoffs(pool, deps),
    ...registerProbe(ctx.extensionMode, tree.provider));
}

export function deactivate(): Promise<void> | undefined {
  const stopping = pool?.dispose();
  pool = undefined;
  return stopping;
}
