// Folders added to and removed from the window start and stop their own servers (R1.1, R1.2, R3.4).
import * as assert from 'node:assert/strict';
import { basename } from 'node:path';
import * as vscode from 'vscode';
import { env, find, samePath, test, tree, waitFor } from './harness.js';

test('a folder added gets its own server in the tree, and a folder removed leaves it (R1.1, R1.2)', async () => {
  const alpha = basename(env('STENO_E2E_ALPHA'));
  const beta = vscode.Uri.file(env('STENO_E2E_BETA'));
  await waitFor('the alpha tree to load', async () => find(await tree(), 'Login'));

  const at = vscode.workspace.workspaceFolders?.length ?? 0;
  assert.equal(vscode.workspace.updateWorkspaceFolders(at, 0, { uri: beta }), true);
  // two shown folders: each gets a folder node, with its own Specs under it
  const two = await waitFor('two folder nodes, beta holding Billing', async () => {
    const now = await tree();
    return now.length === 2 && find(now[1].children, 'Billing') ? now : undefined;
  });
  assert.deepEqual(two.map(i => [i.label, i.contextValue]), [[alpha, 'folder.project'], ['beta', 'folder.project']]);
  assert.ok(find(two[0].children, 'Login'));

  const index = vscode.workspace.workspaceFolders!.findIndex(f => samePath(f.uri, beta));
  assert.equal(vscode.workspace.updateWorkspaceFolders(index, 1), true);
  // back to one shown folder, whose items sit at the root again
  const one = await waitFor('the beta folder to leave the tree', async () => {
    const now = await tree();
    return !find(now, 'beta') && !find(now, 'Billing') && now.some(i => i.label === 'Login') ? now : undefined;
  });
  assert.equal(one.some(i => i.contextValue?.startsWith('folder')), false);
});
