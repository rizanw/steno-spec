// Setting up a plain folder from the command: `.steno` and the skills appear, and the folder joins the tree without a reload.
import * as assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { env, find, samePath, test, tree, waitFor } from './harness.js';

test('set-up turns a plain folder into a project that the tree shows at once', async () => {
  const gamma = env('STENO_E2E_GAMMA');
  const uri = vscode.Uri.file(gamma);
  await waitFor('the alpha tree to load', async () => find(await tree(), 'Login'));

  const at = vscode.workspace.workspaceFolders?.length ?? 0;
  // the extension starts the folder's server when this event reaches it, so set-up must not run before
  const added = new Promise<void>(resolve => {
    const listener = vscode.workspace.onDidChangeWorkspaceFolders(() => { listener.dispose(); resolve(); });
  });
  assert.equal(vscode.workspace.updateWorkspaceFolders(at, 0, { uri }), true);
  await added;
  try {
    // gamma is the only folder that needs set-up, so the agent pick is the only question; the success
    // message stays open, so the command is not awaited
    void vscode.commands.executeCommand('steno.setUp');
    // accept the agent pick with nothing selected, once it shows: an empty selection installs in .agents/skills
    await waitFor('init to create .steno in gamma', async () => {
      await vscode.commands.executeCommand('workbench.action.acceptSelectedQuickOpenItem');
      return existsSync(join(gamma, '.steno', 'config.yaml'));
    });
    // init writes the config before it copies the skills, so the skills can still be on their way
    await waitFor('init to copy the skills into gamma', () => existsSync(join(gamma, '.agents', 'skills', 'steno-spec', 'SKILL.md')));
    assert.equal(existsSync(join(gamma, '.claude')), false);

    const shown = await waitFor('gamma to join the tree as a project', async () => {
      const now = await tree();
      const node = now.find(i => i.label === 'gamma');
      return node?.contextValue === 'folder.project' ? now : undefined;
    });
    assert.ok(find(shown, 'Login'));
  } finally {
    const index = vscode.workspace.workspaceFolders!.findIndex(f => samePath(f.uri, uri));
    if (index >= 0) vscode.workspace.updateWorkspaceFolders(index, 1);
    await waitFor('gamma to leave the tree', async () => !(await tree()).some(i => i.label === 'gamma'));
    await vscode.commands.executeCommand('workbench.action.closeQuickOpen');
  }
});
