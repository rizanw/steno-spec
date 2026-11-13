// Keeps the Client's Diagnostics equal to the project's list: each sync sends only the files whose list changed, and an
// empty list to each file that had findings and has none now (the only rule that clears a file).
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DiagnosticSeverity, type Diagnostic as LspDiagnostic } from 'vscode-languageserver/node';
import type { Diagnostic } from '@steno/core';

export interface Publisher { sync(next: Diagnostic[]): void }

/** `send` receives a file URI and that file's whole list; `root` resolves the root-relative `file` of each Diagnostic. */
export function createPublisher(send: (uri: string, items: Diagnostic[]) => void, root: string): Publisher {
  let last = new Map<string, string>();   // uri -> the list last sent, serialized
  return {
    sync(next) {
      const byUri = new Map<string, Diagnostic[]>();
      for (const d of next) {
        const uri = pathToFileURL(resolve(root, d.file)).href;
        const list = byUri.get(uri);
        if (list) list.push(d); else byUri.set(uri, [d]);
      }
      const sent = new Map<string, string>();
      for (const [uri, items] of byUri) {
        const key = JSON.stringify(items);
        sent.set(uri, key);
        if (last.get(uri) !== key) send(uri, items);
      }
      for (const uri of last.keys()) if (!byUri.has(uri)) send(uri, []);
      last = sent;
    },
  };
}

/** A protocol diagnostic: source `steno`, the rule as `code`, and the whole (1-based) line as range. */
export function toLspDiagnostic(d: Diagnostic): LspDiagnostic {
  return {
    range: { start: { line: d.line - 1, character: 0 }, end: { line: d.line, character: 0 } },
    severity: d.severity === 'error' ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
    source: 'steno', code: d.rule, message: d.message,
  };
}
