// The extension's entry point: one bundled server per workspace folder, stopped again on deactivate.
import type * as vscode from 'vscode';
import { bundled } from './bundled.js';
import { ServerPool, trackFolders } from './servers.js';
import { registerSpecTree } from './tree.js';

let pool: ServerPool | undefined;

// returns nothing: the extension exposes no API, so no other extension can reach a state change (R5.3)
export function activate(ctx: vscode.ExtensionContext): void {
  pool = new ServerPool(bundled(ctx).server);
  ctx.subscriptions.push(...registerSpecTree(pool).disposables, trackFolders(pool));
}

export function deactivate(): Promise<void> | undefined {
  const stopping = pool?.dispose();
  pool = undefined;
  return stopping;
}
