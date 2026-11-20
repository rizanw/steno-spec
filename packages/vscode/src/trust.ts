// Handing work to an agent, picking an agent and setting steno up all run programs or write files, so they check
// workspace trust first. This is the only place we read it. The menus still show these actions in Restricted Mode;
// clicking one explains why it can't run instead of the action silently disappearing.
import * as vscode from 'vscode';

const MANAGE = 'Manage Workspace Trust';

/** Returns `true` if the workspace is trusted. Otherwise tells the user "{what} needs a trusted workspace" and returns `false`. */
export async function guard(what: string): Promise<boolean> {
  if (vscode.workspace.isTrusted) return true;
  const choice = await vscode.window.showWarningMessage(`${what} needs a trusted workspace`, MANAGE);
  if (choice === MANAGE) await vscode.commands.executeCommand('workbench.trust.manage');
  return false;
}
