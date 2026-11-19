// The spec tree: loaded from the folder's server, and redrawn when a State_Change lands.
import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { demoDoc, find, replace, test, tree, waitFor } from './harness.js';

test('the tree loads the folder\'s Spec with its documents and tasks', async () => {
  const items = await waitFor('the Login spec in the tree', async () => {
    const now = await tree();
    return find(now, 'Login') ? now : undefined;
  });
  // one shown folder: its items sit at the root, with no folder node above them
  const spec = items.find(i => i.label === 'Login');
  assert.ok(spec, 'the Spec is a root item');
  assert.equal(spec.description, 'execute · quick · 1/2');
  assert.deepEqual(spec.children.map(c => c.label), ['requirements.md', 'design.md', 'tasks.md']);
  assert.equal(spec.contextValue, 'spec.execute', 'a Spec in execute offers "Run next task"');
  assert.equal(find(items, 'Add the session store')?.contextValue, 'task.done');
  // an open task without subtasks of a Spec in execute offers "Run"; its parent only "Mark done"
  assert.equal(find(items, 'Add logout')?.contextValue, 'task.open.run');
  assert.equal(find(items, 'Sessions')?.contextValue, 'task.open');
  // the Steering group shows with no steering file yet, so "Generate steering" has somewhere to hang
  assert.equal(items.at(-1)?.contextValue, 'steering');
});

test('a State_Change made by editing tasks.md and saving refreshes the tree (R3.6)', async () => {
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
  assert.equal(find(items, 'Login')?.description, 'execute · quick · 2/2');
});
