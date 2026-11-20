// Which Steno_Project a command acts on: the tree item's folder, the active editor's, the only one, or the
// user's pick. Shared by "New spec" and "Generate steering", which both start from a project rather than a Spec.
import * as vscode from 'vscode';
import { pickProject } from './pick.js';
import type { FolderServer, ServerPool } from './servers.js';
import { FolderNode } from './tree.js';

/** The folders that are Steno_Projects right now: a running server whose tree says the folder is set up. */
export function projectServers(pool: ServerPool): FolderServer[] {
  return pool.all().filter(s => s.state !== 'stopped' && s.tree !== undefined && s.tree.notSetUp !== true);
}

/**
 * The project to act on: the hints first, and a quick pick only when neither settled it (R5.8).
 * `undefined` means the user escaped the pick.
 */
export async function chooseProject(pool: ServerPool, servers: FolderServer[], node: unknown, title: string): Promise<FolderServer | undefined> {
  const paths = servers.map(s => s.folder.uri.fsPath);
  const fromItem = node instanceof FolderNode ? node.folder.uri.fsPath : undefined;
  const editor = vscode.window.activeTextEditor?.document.uri;
  // a file outside every project is no hint at all; `pickProject` keeps only a path that is in the list
  const fromEditor = editor ? pool.get(editor)?.folder.uri.fsPath : undefined;
  const chosen = pickProject(paths, fromItem, fromEditor);
  if (chosen !== undefined) return servers.find(s => s.folder.uri.fsPath === chosen);
  const items = servers.map(s => ({ label: s.folder.name, description: s.folder.uri.fsPath, server: s }));
  const picked = await vscode.window.showQuickPick(items, { title, placeHolder: 'Which steno project?' });
  return picked?.server;
}
