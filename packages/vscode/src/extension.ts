// The extension's entry point: one bundled server per workspace folder, stopped again on deactivate.
import type * as vscode from 'vscode';
import { registerActions } from './actions.js';
import { bundled } from './bundled.js';
import { Chooser, hostProbe, registerChooser } from './chooser.js';
import { registerNewSpec } from './new-spec.js';
import { registerProbe } from './probe.js';
import { ServerPool, trackFolders } from './servers.js';
import { registerSpecTree } from './tree.js';

let pool: ServerPool | undefined;

// returns nothing: the extension exposes no API, so no other extension can reach a state change (R5.3)
export function activate(ctx: vscode.ExtensionContext): void {
  const { server, cli } = bundled(ctx);
  pool = new ServerPool(server);
  const tree = registerSpecTree(pool);
  const chooser = new Chooser(ctx.workspaceState, hostProbe(), pool);
  ctx.subscriptions.push(
    ...tree.disposables, ...registerActions(pool), registerNewSpec(pool, cli), trackFolders(pool),
    chooser, registerChooser(chooser),
    ...registerProbe(ctx.extensionMode, tree.provider));
}

export function deactivate(): Promise<void> | undefined {
  const stopping = pool?.dispose();
  pool = undefined;
  return stopping;
}
