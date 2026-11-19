// A read-only view of the spec tree for the end-to-end tests. VS Code gives no extension a way to read
// another view's items, so in a test run only, the tree's items are offered as plain data on a command.
// Registered only when VS Code runs the extension under a test runner (`ExtensionMode.Test`): an installed
// extension never has it, so it adds nothing another extension could reach (R5.3).
import * as vscode from 'vscode';
import type { Node, SpecTreeProvider } from './tree.js';

export const PROBE_COMMAND = 'steno.test.tree';

/** One tree item as plain data: what the view would show, and what its menus would match. */
export interface ProbeItem {
  label: string;
  description?: string;
  contextValue?: string;
  children: ProbeItem[];
}

function label(node: vscode.TreeItem): string {
  // a string, or a TreeItemLabel with highlights
  const l = node.label as string | { label: string } | undefined;
  return typeof l === 'string' ? l : l?.label ?? '';
}

/** The whole tree from the root down, as the provider builds it right now. */
export function snapshot(provider: SpecTreeProvider, node?: Node): ProbeItem[] {
  return provider.getChildren(node).map(child => ({
    label: label(child),
    description: typeof child.description === 'string' ? child.description : undefined,
    contextValue: child.contextValue,
    children: snapshot(provider, child),
  }));
}

/** `steno.test.tree`, only in a test run; anywhere else nothing is registered. */
export function registerProbe(mode: vscode.ExtensionMode, provider: SpecTreeProvider): vscode.Disposable[] {
  if (mode !== vscode.ExtensionMode.Test) return [];
  return [vscode.commands.registerCommand(PROBE_COMMAND, () => snapshot(provider))];
}
