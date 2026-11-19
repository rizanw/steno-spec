// Every refusal the user sees: one function reads the Structured_Error, wherever it came from, and shows it
// the way its code asks for (R5.5, R5.6). A request to a stopped server gets its own message with "Restart".
import * as vscode from 'vscode';
import type { StructuredError } from './protocol.js';
import type { FolderServer, ServerPool } from './servers.js';
import { OPEN_COMMAND } from './tree.js';

/** The choice that saves the file and runs the refused change again (R5.5). */
export const SAVE_AND_RETRY = 'Save and retry';

/** The choice that starts a stopped server again (R1.4). */
export const RESTART = 'Restart';

/** Whether a value has the shape of a Structured_Error: a string `code` and a string `message`. */
function isStructured(value: unknown): value is StructuredError {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.code === 'string' && typeof v.message === 'string';
}

/**
 * The Structured_Error a refusal carries: the `data` of a `ResponseError` from the server, or the error itself
 * when it is one already, as the CLI's parsed standard output is. Anything else has none.
 */
export function structuredError(err: unknown): StructuredError | undefined {
  if (isStructured(err) && !(err instanceof Error)) return err;
  const data = (err as { data?: unknown } | null | undefined)?.data;
  return isStructured(data) ? data : undefined;
}

/** A file the server named, as a URI: an absolute path as it is, a relative one under the folder. */
export function fileUri(folder: vscode.WorkspaceFolder, file: string): vscode.Uri {
  if (file.startsWith('/') || /^[A-Za-z]:[\\/]/.test(file) || file.startsWith('\\\\')) return vscode.Uri.file(file);
  return vscode.Uri.joinPath(folder.uri, ...file.split(/[\\/]/).filter(Boolean));
}

/** A file's path as the user knows it: relative to the folder when it sits inside it. */
function shownPath(folder: vscode.WorkspaceFolder, uri: vscode.Uri): string {
  const root = folder.uri.fsPath.replace(/[\\/]+$/, '');
  const path = uri.fsPath;
  if (path.startsWith(root + '/') || path.startsWith(root + '\\')) return path.slice(root.length + 1).split('\\').join('/');
  return path;
}

/** Two URIs that name the same file; Windows paths compare without regard to case. */
function sameFile(a: vscode.Uri, b: vscode.Uri): boolean {
  if (a.toString() === b.toString()) return true;
  const norm = (u: vscode.Uri) => u.fsPath.split('\\').join('/');
  return /^[A-Za-z]:/.test(a.fsPath) ? norm(a).toLowerCase() === norm(b).toLowerCase() : norm(a) === norm(b);
}

/**
 * Show a refused State_Change. `unsaved-edits` names the file and offers "Save and retry", which saves the
 * open document and calls `retry` once (R5.5). `lint-blocked` lists each finding as `file:line` in a quick
 * pick, and the chosen one opens at its line (R5.6). Any other code, and any error that carries no
 * Structured_Error, shows its message as an error notification (R5.6).
 */
export async function showRefusal(
  err: unknown,
  folder: vscode.WorkspaceFolder,
  retry?: () => Promise<unknown>,
): Promise<void> {
  const refusal = structuredError(err);
  if (!refusal) {
    await vscode.window.showErrorMessage(err instanceof Error ? err.message : String(err));
    return;
  }
  if (refusal.code === 'unsaved-edits' && refusal.file) {
    const uri = fileUri(folder, refusal.file);
    const offer = retry ? [SAVE_AND_RETRY] : [];
    const choice = await vscode.window.showErrorMessage(`${shownPath(folder, uri)} has unsaved edits`, ...offer);
    if (choice !== SAVE_AND_RETRY || !retry) return;
    const document = vscode.workspace.textDocuments.find(d => sameFile(d.uri, uri));
    if (document && !(await document.save())) return;
    await retry();
    return;
  }
  if (refusal.code === 'lint-blocked' && refusal.findings?.length) {
    const items = refusal.findings.map(finding => ({
      label: `${finding.file}:${finding.line}`,
      detail: `${finding.rule}: ${finding.message}`,
      finding,
    }));
    const chosen = await vscode.window.showQuickPick(items, { title: refusal.message, placeHolder: 'Open a finding' });
    if (chosen) await vscode.commands.executeCommand(OPEN_COMMAND, fileUri(folder, chosen.finding.file), chosen.finding.line);
    return;
  }
  await vscode.window.showErrorMessage(refusal.message);
}

/** A request went to a stopped server: say so, and offer the same Restart as the tree (R1.4). */
export async function showStopped(pool: ServerPool, server: FolderServer): Promise<void> {
  const choice = await vscode.window.showErrorMessage(`steno server for ${server.folder.name} is stopped`, RESTART);
  if (choice === RESTART) await pool.restart(server);
}
