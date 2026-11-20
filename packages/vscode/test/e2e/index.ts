// The entry point @vscode/test-electron loads in the extension host: activate the extension, load every
// `*.e2e.js` beside this file in name order, and run what they registered.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { runAll } from './harness.js';

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension('rzndwb.steno-vscode');
  if (!extension) throw new Error('the extension rzndwb.steno-vscode is not loaded');
  await extension.activate();
  for (const file of readdirSync(__dirname).filter(f => f.endsWith('.e2e.js')).sort()) require(join(__dirname, file));
  await runAll();
}
