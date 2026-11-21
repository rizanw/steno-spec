// "Set up steno": make a folder of this window a steno project and install the steno skills for the coding agents
// the user picks. The bundled CLI's `init` does the work; this file only chooses the folder and the agents, and
// reports what `init` did.
import { existsSync } from 'node:fs';
import { parentProject } from '@steno/core/host';
import * as vscode from 'vscode';
import { refused, runCli } from './new-spec.js';
import type { StructuredError } from './protocol.js';
import { showRefusal } from './refusal.js';
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

/**
 * The arguments for `steno init`. The agent keys travel as one comma list, an empty one when the user
 * picked none, which installs the skills in `.agents/skills` only. The explicit `--root` makes `init` use
 * that folder as given, even inside another steno project.
 */
export function initArgs(root: string, agents: string[]): string[] {
  return ['init', '-a', agents.join(','), '--root', root, '--json'];
}

/** What `steno init --json` reports. */
export interface InitResult { root: string; skills: string[]; agents: Record<string, string>; warnings?: string[] }

/** One agent `init` can set skills up for, as `init --list-agents --json` names it. */
export interface InitAgent { key: string; label: string }

const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

/**
 * `init`'s answer, when it has every field the extension reads with the right type, else `undefined`.
 * This answer is not part of the versioned contract, so a missing field counts as a failed set-up.
 */
export function initResult(value: unknown): InitResult | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const v = value as Record<string, unknown>;
  if (typeof v.root !== 'string' || !isStrings(v.skills)) return undefined;
  if (typeof v.agents !== 'object' || v.agents === null || Array.isArray(v.agents)) return undefined;
  if (!Object.values(v.agents).every(dir => typeof dir === 'string')) return undefined;
  if (v.warnings !== undefined && !isStrings(v.warnings)) return undefined;
  return value as InitResult;
}

/** The agent list of `init --list-agents --json`, or `undefined` when it is not one. */
export function initAgents(value: unknown): InitAgent[] | undefined {
  const agents = (value as { agents?: unknown } | null | undefined)?.agents;
  if (!Array.isArray(agents)) return undefined;
  const ok = agents.every(a => typeof a === 'object' && a !== null
    && typeof (a as InitAgent).key === 'string' && typeof (a as InitAgent).label === 'string');
  return ok ? agents.map(({ key, label }: InitAgent) => ({ key, label })) : undefined;
}

/** The message a finished set-up shows: what was installed, where or for whom, and how to get the CLI. */
function setUpMessage(folder: string, result: InitResult, labels: string[]): string {
  const target = labels.length ? `for ${labels.join(', ')}` : 'in .agents/skills';
  const lines = [
    `steno set up in ${folder}: ${result.skills.length} skills ${target}.`,
    `To use steno in a terminal, install it with ${INSTALL_COMMAND}`,
    ...(result.warnings ?? []).map(warning => `Warning: ${warning}`),
  ];
  return lines.join(' ');
}

/** Whether a server has said what its folder is, or never will. */
const settled = (s: FolderServer) => s.state === 'stopped' || s.tree !== undefined;

/**
 * Wait until every folder server has sent its first tree or stopped, or until `ms` passes. On a cold start the
 * servers have only just been started when the command runs.
 */
function waitForTrees(pool: ServerPool, ms: number): Promise<void> {
  if (pool.all().every(settled)) return Promise.resolve();
  return new Promise(resolve => {
    const done = () => { clearTimeout(timer); listener.dispose(); resolve(); };
    const timer = setTimeout(done, ms);
    const listener = pool.onDidChange(() => { if (pool.all().every(settled)) done(); });
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

/** Run the CLI and check its answer; a refusal, a crash or an unreadable answer is shown and gives `undefined`. */
async function ask<T>(cli: string, args: string[], folder: vscode.WorkspaceFolder, check: (value: unknown) => T | undefined): Promise<T | undefined> {
  let answer: unknown;
  try {
    answer = await runCli<unknown>(cli, args);
  } catch (err) {
    await showRefusal(err, folder);
    return undefined;
  }
  if (refused(answer)) { await showRefusal(answer as StructuredError, folder); return undefined; }
  const value = check(answer);
  if (value === undefined) await showRefusal(new Error(`steno ${args[0]} gave an answer the extension cannot read`), folder);
  return value;
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

  const agents = await ask(cli, ['init', '--list-agents', '--json'], folder, initAgents);
  if (!agents) return;
  const items = agents.map(agent => ({ label: agent.label, description: agent.key, agent }));
  const picked = await vscode.window.showQuickPick(items, {
    title: TITLE, placeHolder: 'Install the steno skills for which coding agents? None installs them in .agents/skills only',
    canPickMany: true,
  });
  if (!picked) return;

  const keys = picked.map(item => item.agent.key);
  const result = await ask(cli, initArgs(folder.uri.fsPath, keys), folder, initResult);
  if (!result) return;
  // the server notices the new `.steno` itself; asking now just shows the tree sooner
  server.refresher.request();

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
