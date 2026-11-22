// "Set up steno": make a folder of this window a steno project and install the steno skills for the coding agents
// the user picks. The bundled CLI's `init` does the work; this file only chooses the folder and the agents, and
// reports what `init` did.
import { existsSync } from 'node:fs';
import { listAgents, parentProject, setUp as install, type CliOutcome, type Installed } from '@steno/core/host';
import * as vscode from 'vscode';
import { bundledCli } from './new-spec.js';
import { showRefusal, writeLog } from './refusal.js';
import type { FolderServer, ServerPool } from './servers.js';
import { guard } from './trust.js';

export const SET_UP_COMMAND = 'steno.setUp';

/** How long set-up waits for the folder servers' first trees. A folder still silent after that is not offered. */
const SET_UP_WAIT_MS = 10_000;

/** The command that installs the steno CLI itself, which the success message names and can copy. */
export const INSTALL_COMMAND = 'npm install -g steno-spec';

export const COPY_INSTALL = 'Copy install command';
export const OPEN_PARENT = 'Open that folder';

/** The title every pick of the flow carries. */
const TITLE = 'Set up steno';

/**
 * The folder to set up: the active editor's folder when it still needs set-up, else the only folder that
 * does, else `undefined`, and the caller asks.
 */
export function pickSetUpFolder(candidates: string[], fromEditor?: string): string | undefined {
  if (fromEditor !== undefined && candidates.includes(fromEditor)) return fromEditor;
  return candidates.length === 1 ? candidates[0] : undefined;
}

/** The message a finished set-up shows: what was installed, where or for whom, and how to get the CLI. */
function setUpMessage(folder: string, result: Installed, labels: string[]): string {
  const target = labels.length ? `for ${labels.join(', ')}` : 'in .agents/skills';
  const lines = [
    `steno set up in ${folder}: ${result.skills.length} skills ${target}.`,
    `To use steno in a terminal, install it with ${INSTALL_COMMAND}`,
    ...(result.warnings ?? []).map(warning => `Warning: ${warning}`),
  ];
  return lines.join(' ');
}

/** Whether a server has said what its folder is, or never will. */
const answered = (s: FolderServer) => s.state === 'stopped' || s.tree !== undefined;

/**
 * Wait until every folder server has sent its first tree or stopped, or until `ms` passes. On a cold start the
 * servers have only just been started when the command runs.
 */
function waitForTrees(pool: ServerPool, ms: number): Promise<void> {
  if (pool.all().every(answered)) return Promise.resolve();
  return new Promise(resolve => {
    const done = () => { clearTimeout(timer); listener.dispose(); resolve(); };
    const timer = setTimeout(done, ms);
    const listener = pool.onDidChange(() => { if (pool.all().every(answered)) done(); });
  });
}

/** The folders that are not steno projects yet: their server answered with a tree that says so. */
function setUpCandidates(pool: ServerPool): FolderServer[] {
  return pool.all().filter(s => s.tree?.notSetUp === true);
}

/** The folder to set up: the hints first, a quick pick only when they do not settle it. */
async function chooseFolder(pool: ServerPool, candidates: FolderServer[]): Promise<FolderServer | undefined> {
  const editor = vscode.window.activeTextEditor?.document.uri;
  const fromEditor = editor ? pool.get(editor)?.folder.uri.fsPath : undefined;
  const chosen = pickSetUpFolder(candidates.map(s => s.folder.uri.fsPath), fromEditor);
  if (chosen !== undefined) return candidates.find(s => s.folder.uri.fsPath === chosen);
  const items = candidates.map(s => ({ label: s.folder.name, description: s.folder.uri.fsPath, server: s }));
  const picked = await vscode.window.showQuickPick(items, { title: TITLE, placeHolder: 'Which folder should steno set up?' });
  return picked?.server;
}

/** Show a failed CLI run and log its standard error; gives the value of one that worked. */
async function settle<T>(server: FolderServer, outcome: CliOutcome<T>): Promise<T | undefined> {
  if (outcome.ok) return outcome.value;
  writeLog(server, outcome.log);
  await showRefusal(outcome.error, server.folder);
  return undefined;
}

/**
 * Set a folder of this window up as a steno project. Nothing runs in Restricted Mode, and dismissing either
 * pick ends the flow before `init` runs. A folder inside another steno project is not set up: the message
 * offers to open that project instead.
 */
export async function setUp(pool: ServerPool, cli: string, waitMs: number = SET_UP_WAIT_MS): Promise<void> {
  if (!(await guard('Setting steno up'))) return;
  await waitForTrees(pool, waitMs);
  const candidates = setUpCandidates(pool);
  if (candidates.length === 0) {
    await vscode.window.showInformationMessage('No folder here needs set-up');
    return;
  }
  const server = await chooseFolder(pool, candidates);
  if (!server) return;
  const folder = server.folder;

  const parent = parentProject(folder.uri.fsPath, existsSync);
  if (parent !== undefined) {
    const choice = await vscode.window.showInformationMessage(
      `${folder.name} is inside the steno project ${parent}, so it was not set up. Open that project instead.`, OPEN_PARENT);
    if (choice === OPEN_PARENT) await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(parent));
    return;
  }

  const run = bundledCli(cli);
  const agents = await settle(server, await listAgents(run, folder.uri.fsPath));
  if (!agents) return;
  const items = agents.map(agent => ({ label: agent.label, description: agent.key, agent }));
  const picked = await vscode.window.showQuickPick(items, {
    title: TITLE, placeHolder: 'Install the steno skills for which coding agents? None installs them in .agents/skills only',
    canPickMany: true,
  });
  if (!picked) return;

  const keys = picked.map(item => item.agent.key);
  const result = await settle(server, await install(run, folder.uri.fsPath, keys, existsSync));
  if (!result) return;
  // the server notices the new `.steno` itself; asking now just shows the tree sooner
  server.fetcher.request();

  const message = setUpMessage(folder.name, result, picked.map(item => item.agent.label));
  const choice = result.warnings?.length
    ? await vscode.window.showWarningMessage(message, COPY_INSTALL)
    : await vscode.window.showInformationMessage(message, COPY_INSTALL);
  if (choice === COPY_INSTALL) await vscode.env.clipboard.writeText(INSTALL_COMMAND);
}

/** `steno.setUp`: from the empty view's button and from the command palette. */
export function registerSetUp(pool: ServerPool, cli: string): vscode.Disposable {
  return vscode.commands.registerCommand(SET_UP_COMMAND, () => setUp(pool, cli));
}
