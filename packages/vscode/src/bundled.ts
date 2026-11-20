// The only two programs the extension ever starts. Both ship inside the `.vsix`, so nothing here reads PATH,
// node_modules or a setting: in a Restricted Mode workspace the extension runs exactly what it shipped with.
import * as vscode from 'vscode';

export interface Bundled {
  /** absolute path to the bundled steno language server */
  server: string;
  /** absolute path to the bundled steno CLI */
  cli: string;
}

/** The bundled server and CLI, as absolute paths inside the installed extension. */
export function bundled(ctx: vscode.ExtensionContext): Bundled {
  const at = (file: string) => vscode.Uri.joinPath(ctx.extensionUri, 'dist', file).fsPath;
  return { server: at('steno-lsp.mjs'), cli: at('steno-cli.mjs') };
}
