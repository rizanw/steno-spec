// A read-only view of the spec tree for the end-to-end tests. VS Code gives no extension a way to read
// another view's items, so in a test run only, the tree's items are offered as plain data on a command.
// Registered only when VS Code runs the extension under a test runner (`ExtensionMode.Test`): an installed
// extension never has it, so it adds nothing another extension could reach.
import * as vscode from 'vscode';
import type { SpecTreeProvider, SteeringTreeProvider } from './tree.js';

export const PROBE_COMMAND = 'steno.test.tree';
export const STEERING_PROBE_COMMAND = 'steno.test.steering';

/** Either view's provider, as far as reading its items goes. */
interface Provider<N> { getChildren(node?: N): N[] | Promise<N[]> }

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
async function snapshot<N extends vscode.TreeItem>(provider: Provider<N>, node?: N): Promise<ProbeItem[]> {
  const children = await provider.getChildren(node);
  return Promise.all(children.map(async child => ({
    label: label(child),
    description: typeof child.description === 'string' ? child.description : undefined,
    contextValue: child.contextValue,
    children: await snapshot(provider, child),
  })));
}

/** `steno.test.tree` and `steno.test.steering`, only in a test run; anywhere else nothing is registered. */
export function registerProbe(mode: vscode.ExtensionMode, specs: SpecTreeProvider, steering: SteeringTreeProvider): vscode.Disposable[] {
  if (mode !== vscode.ExtensionMode.Test) return [];
  return [
    vscode.commands.registerCommand(PROBE_COMMAND, () => snapshot(specs)),
    vscode.commands.registerCommand(STEERING_PROBE_COMMAND, () => snapshot(steering)),
  ];
}
