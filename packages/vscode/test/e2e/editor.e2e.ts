// The editor features, served by the real bundled server on the editor's own runtime.
import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { demoDoc, replace, samePath, test, waitFor } from './harness.js';

const DONE_LENS = 'steno.task.done';
const RUN_LENS = 'steno.task.run';

/** This document's diagnostics that carry the lint rule `code`. */
function withCode(uri: vscode.Uri, code: string): vscode.Diagnostic[] {
  return vscode.languages.getDiagnostics(uri).filter(d => String(typeof d.code === 'object' ? d.code.value : d.code) === code);
}

test('an unsaved edit shows its Diagnostic, and reverting it clears it', async () => {
  const uri = demoDoc('design.md');
  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(document);
  // the design cites a criterion the requirements do not have
  await replace(document, '_Satisfies: 1.1, 1.2_', '_Satisfies: 1.1, 1.2, 9.9_');
  assert.equal(document.isDirty, true);
  const found = await waitFor('the design/unknown-req diagnostic', () => withCode(uri, 'design/unknown-req')[0]);
  assert.equal(found.range.start.line, 6, 'the diagnostic sits on the section heading, "## Sessions {#D-session}"');
  assert.equal(found.severity, vscode.DiagnosticSeverity.Error);
  await vscode.commands.executeCommand('workbench.action.files.revert');
  await waitFor('the diagnostic to clear after the revert', () => withCode(uri, 'design/unknown-req').length === 0);
});

test('a done task carries the done lens and every open task the run lens, each with the document URI', async () => {
  const uri = demoDoc('tasks.md');
  await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri));
  const lenses = await waitFor('the done lens on T1.1', async () => {
    const all = await vscode.commands.executeCommand<vscode.CodeLens[]>('vscode.executeCodeLensProvider', uri);
    return all?.some(l => l.command?.command === DONE_LENS) ? all : undefined;
  });
  const done = lenses.filter(l => l.command?.command === DONE_LENS);
  assert.deepEqual(done.map(l => l.range.start.line), [3], 'one done lens, above "- [x] 1.1" (line 4)');
  const [args] = done[0].command!.arguments as [{ uri: vscode.Uri | string }];
  assert.ok(samePath(vscode.Uri.parse(String(args.uri)), uri), 'the middleware adds the document URI');
  const run = lenses.filter(l => l.command?.command === RUN_LENS);
  assert.deepEqual(run.map(l => l.range.start.line), [2, 5], 'run lenses above the parent "- [ ] 1." (line 3) and "- [ ] 1.2" (line 6)');
  const [runArgs] = run[1].command!.arguments as [{ uri: vscode.Uri | string; task: string }];
  assert.ok(samePath(vscode.Uri.parse(String(runArgs.uri)), uri), 'the middleware adds the document URI to the run lens too');
});

test('the outline of tasks.md lists its tasks', async () => {
  const uri = demoDoc('tasks.md');
  await vscode.workspace.openTextDocument(uri);
  const names = await waitFor('the document symbols of tasks.md', async () => {
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', uri);
    const flat: string[] = [];
    const walk = (list: vscode.DocumentSymbol[]) => { for (const s of list) { flat.push(s.name); walk(s.children ?? []); } };
    walk(symbols ?? []);
    return flat.some(n => n.includes('Add logout')) ? flat : undefined;
  });
  assert.ok(names.some(n => n.includes('Add the session store')), names.join(', '));
});
