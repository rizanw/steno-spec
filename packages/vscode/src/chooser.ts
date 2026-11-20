// Remembers which coding agent this workspace hands work to, and shows it in the status bar whenever one of the
// open folders is a steno project. Clicking the status bar item lets the user pick a different agent.
import { existsSync } from 'node:fs';
import * as vscode from 'vscode';
import { ADAPTERS, detected, type AgentAdapter, type Probe } from './agents.js';
import type { ServerPool } from './servers.js';
import { hasProject } from './tree.js';
import { guard } from './trust.js';

/** Where the chosen agent's id is stored in workspaceState. */
export const AGENT_KEY = 'steno.agent';
export const CHOOSE_COMMAND = 'steno.agent.choose';

/** The agents to offer: only the installed ones, in table order, with the clipboard always last. */
export function pickerItems(adapters: readonly AgentAdapter[], isDetected: (a: AgentAdapter) => boolean): AgentAdapter[] {
  const clipboard = adapters.filter(a => a.via === 'clipboard');
  return [...adapters.filter(a => a.via !== 'clipboard' && isDetected(a)), ...clipboard.slice(0, 1)];
}

/**
 * The real editor and machine, for detecting agents. PATH is read fresh each time, so we only look at it when the
 * picker actually opens, which happens after the workspace trust check.
 */
export function hostProbe(): Probe {
  return {
    hasExtension: id => vscode.extensions.getExtension(id) !== undefined,
    get env() { return { path: process.env.PATH ?? '', pathExt: process.env.PATHEXT, windows: process.platform === 'win32' }; },
    exists: existsSync,
  };
}

export class Chooser implements vscode.Disposable {
  private readonly item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  private readonly watch: vscode.Disposable;

  constructor(private readonly state: vscode.Memento, private readonly probe: Probe, private readonly pool: ServerPool) {
    this.item.name = 'steno agent';
    this.item.tooltip = 'The coding agent steno hands work to: click to change it';
    this.item.command = CHOOSE_COMMAND;
    this.update();
    this.watch = pool.onDidChange(() => this.update());
  }

  /** The saved agent, or `undefined` if none was picked yet or the saved one no longer exists. */
  current(): AgentAdapter | undefined {
    const id = this.state.get<string>(AGENT_KEY);
    return ADAPTERS.find(a => a.id === id);
  }

  /** Asks the user to pick an agent. It doesn't save anything, so the caller can still back out of its own prompts. */
  async pick(): Promise<AgentAdapter | undefined> {
    const items = pickerItems(ADAPTERS, a => detected(a, this.probe)).map(adapter => ({
      label: adapter.label,
      description: adapter.fillOnly ? 'fills the chat input; you press Enter' : undefined,
      adapter,
    }));
    const chosen = await vscode.window.showQuickPick(items, {
      title: 'Choose the coding agent steno hands work to',
      placeHolder: 'Only the agents found in this editor and on PATH are listed',
    });
    return chosen?.adapter;
  }

  /** Saves the agent for this workspace and updates the status bar. */
  async save(a: AgentAdapter): Promise<void> {
    await this.state.update(AGENT_KEY, a.id);
    this.update();
  }

  private update(): void {
    const chosen = this.current();
    this.item.text = `steno: ${chosen ? chosen.label : 'choose agent'}`;
    if (hasProject(this.pool.all())) this.item.show();
    else this.item.hide();
  }

  dispose(): void {
    this.watch.dispose();
    this.item.dispose();
  }
}

/** The command behind the status bar item: check workspace trust, then let the user pick and save an agent. */
export function registerChooser(chooser: Chooser): vscode.Disposable {
  return vscode.commands.registerCommand(CHOOSE_COMMAND, async () => {
    if (!(await guard('Choosing a coding agent'))) return;
    const a = await chooser.pick();
    if (a) await chooser.save(a);
  });
}
