// The spec tree: loaded from the folder's server, and redrawn when a state change lands.
import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { demoDoc, find, replace, steering, test, tree, waitFor } from './harness.js';

test('the tree loads the folder\'s Spec with its documents and tasks', async () => {
  const items = await waitFor('the Login spec in the tree', async () => {
    const now = await tree();
    return find(now, 'Login') ? now : undefined;
  });
  // one shown folder: its items sit at the root, with no folder node above them
  const spec = items.find(i => i.label === 'Login');
  assert.ok(spec, 'the Spec is a root item');
  assert.equal(spec.description, '1 task left');
  assert.deepEqual(spec.children.map(c => c.label), ['Requirements', 'Design', 'Tasks']);
  assert.equal(spec.contextValue, 'spec.execute', 'a Spec in execute offers "Run next task"');
  assert.equal(find(items, 'Add the session store')?.contextValue, 'task.done');
  // an open task without subtasks of a Spec in execute offers "Run"; its parent only "Mark done"
  assert.equal(find(items, 'Add logout')?.contextValue, 'task.open.run');
  assert.equal(find(items, 'Sessions')?.contextValue, 'task.open');
  // steering has a view of its own, so the Specs view holds only Specs
  assert.ok(items.every(i => i.contextValue?.startsWith('spec')), 'only Specs at the root');
  // no steering file and no AGENTS.md yet: the Steering view is empty and shows its "Generate steering" message
  assert.deepEqual(await steering(), []);
});

test('a state change made by editing tasks.md and saving refreshes the tree', async () => {
  await waitFor('the tree to load', async () => find(await tree(), 'Add logout'));
  const document = await vscode.workspace.openTextDocument(demoDoc('tasks.md'));
  await replace(document, '- [ ] 1.2 Add logout', '- [x] 1.2 Add logout');
  const saved = Date.now();
  assert.equal(await document.save(), true);
  const items = await waitFor('T1.2 to show as done', async () => {
    const now = await tree();
    return find(now, 'Add logout')?.contextValue === 'task.done' ? now : undefined;
  });
  console.log(`       tree refreshed ${Date.now() - saved} ms after the save`);
  assert.equal(find(items, 'Login')?.description, 'all tasks done');
});

test('a spec document opens in the Markdown Editor, and a task in the Text Editor at its line', async () => {
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  const uri = demoDoc('design.md');
  await vscode.commands.executeCommand('steno.open', uri);
  const tab = await waitFor('the document to open', () => vscode.window.tabGroups.activeTabGroup.activeTab);
  assert.ok(tab.input instanceof vscode.TabInputCustom, 'a document opens in a custom editor');
  assert.equal(tab.input.viewType, 'vscode.markdown.editor');
  assert.equal(tab.input.uri.toString(), uri.toString());
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  // a task's line only means something in the Text Editor
  await vscode.commands.executeCommand('steno.open', demoDoc('tasks.md'), 3);
  const editor = await waitFor('the Text Editor', () => vscode.window.activeTextEditor);
  assert.equal(editor.selection.active.line, 2);
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');
});
