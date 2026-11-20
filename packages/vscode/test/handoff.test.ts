// Handing work to an agent: unsaved edits, the terminal command line, each way of delivering the call, each
// fallback to the clipboard, and each prompt the user can dismiss.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  Uri, answers, failures, folder, handlers, installed, memento, openDocument, recorded, resetRecorded, setFolders, workspace,
} from './vscode-stub.js';
import { ADAPTERS, type Probe } from '../src/agents.js';
import { AGENT_KEY, Chooser } from '../src/chooser.js';
import {
  REVIEW_COMMAND, RUN_NEXT_COMMAND, RUN_TASK_COMMAND, STEER_COMMAND, WRITE_COMMAND,
  dirtyFor, handOff, registerHandoffs, terminalOptions, type Deps,
} from '../src/handoff.js';
import type { OutlineItem, SpecTree, TreeSpec } from '../src/protocol.js';
import { ServerPool, type FolderServer } from '../src/servers.js';
import { FolderNode, SpecNode, TaskNode } from '../src/tree.js';

beforeEach(() => resetRecorded());

const ROOT = '/work/app';
const APP = folder(ROOT);

function task(id: string, over: Partial<OutlineItem> = {}): OutlineItem {
  return { kind: 'task', id, title: `task ${id}`, line: 10, endLine: 10, children: [], ...over };
}
function spec(over: Partial<TreeSpec> = {}): TreeSpec {
  return { name: 'auth', title: 'Auth', kind: 'feature', mode: 'gated', phase: 'execute', taskItems: [task('T1')], ...over };
}
function tree(over: Partial<SpecTree> = {}): SpecTree {
  return { protocolVersion: 1, specs: [spec()], steering: [], specsDir: '.steno/specs', steeringDir: '.steno/steering', ...over };
}

/** A machine with `claude` and `codex` on PATH and both chat extensions installed; `.steno` in `steno` folders. */
function probe(over: Partial<Probe> = {}, stenoIn: string[] = [ROOT]): Probe {
  return {
    hasExtension: id => installed.has(id),
    env: { path: '/bin', windows: false },
    exists: p => p === '/bin/claude' || p === '/bin/codex' || stenoIn.some(dir => p === `${dir}/.steno`),
    ...over,
  };
}

const server = (f = APP, t: SpecTree = tree()) => ({ folder: f, tree: t, state: 'running' }) as unknown as FolderServer;
const pool = (...servers: FolderServer[]) => ({ all: () => servers, onDidChange: () => ({ dispose() {} }) }) as unknown as ServerPool;

/** The deps of a handoff, with the agent `id` already saved (or none). */
function deps(id?: string, p: Probe = probe()): Deps & { state: ReturnType<typeof memento> } {
  const state = memento(id ? { [AGENT_KEY]: id } : {});
  return { chooser: new Chooser(state, p, pool(server())), probe: p, state };
}

const RUN = { kind: 'run', spec: 'auth', task: 'T1' } as const;
const label = (id: string) => ADAPTERS.find(a => a.id === id)!.label;

describe('dirtyFor (R1.12)', () => {
  const docs = [
    { path: '/w/.steno/specs/auth/tasks.md', dirty: true },
    { path: '/w/.steno/specs/auth/design.md', dirty: false },
    { path: '/w/.steno/specs/authz/tasks.md', dirty: true },
    { path: '/w/.steno/steering/tech.md', dirty: true },
    { path: '/w/src/index.ts', dirty: true },
  ];

  it('lists the unsaved documents of the Spec and of the steering folder, nothing else', () => {
    expect(dirtyFor(docs, '/w/.steno/specs/auth', '/w/.steno/steering'))
      .toEqual(['/w/.steno/specs/auth/tasks.md', '/w/.steno/steering/tech.md']);
  });

  it('looks only at steering when there is no Spec, as for generating steering', () => {
    expect(dirtyFor(docs, undefined, '/w/.steno/steering')).toEqual(['/w/.steno/steering/tech.md']);
  });

  it('accepts Windows paths', () => {
    const win = [{ path: 'C:\\w\\.steno\\specs\\auth\\tasks.md', dirty: true }];
    expect(dirtyFor(win, 'C:\\w\\.steno\\specs\\auth', 'C:\\w\\.steno\\steering')).toEqual([win[0].path]);
  });
});

describe('terminalOptions (R2.2)', () => {
  it('runs a program directly with the argument list, so no shell parses the call', () => {
    expect(terminalOptions('/bin/gemini', ['-i', 'Use the steno-run skill with: T1 auth'], false))
      .toEqual({ shellPath: '/bin/gemini', shellArgs: ['-i', 'Use the steno-run skill with: T1 auth'] });
    expect(terminalOptions('C:\\bin\\claude.exe', ['/steno-run T1 auth'], true))
      .toEqual({ shellPath: 'C:\\bin\\claude.exe', shellArgs: ['/steno-run T1 auth'] });
  });

  it('starts a Windows .cmd or .bat shim through cmd.exe, quoting each argument that holds a space', () => {
    expect(terminalOptions('C:\\npm\\codex.cmd', ['$steno-run T1 auth'], true))
      .toEqual({ shellPath: 'cmd.exe', shellArgs: '/d /s /c ""C:\\npm\\codex.cmd" "$steno-run T1 auth""' });
    expect(terminalOptions('C:\\npm\\gemini.BAT', ['-i', 'x y'], true))
      .toEqual({ shellPath: 'cmd.exe', shellArgs: '/d /s /c ""C:\\npm\\gemini.BAT" -i "x y""' });
  });
});

describe('handOff', () => {
  it('starts a terminal agent in the handoff folder with the call in its own form (R2.2)', async () => {
    await handOff(deps('codex'), server(), RUN);
    expect(recorded.terminals).toHaveLength(1);
    const [{ options, shown }] = recorded.terminals;
    expect(options.shellPath).toBe('/bin/codex');
    expect(options.shellArgs).toEqual(['$steno-run T1 auth']);
    expect(String(options.cwd)).toBe(APP.uri.toString());
    expect(shown).toBe(true);
    expect(recorded.clipboard).toEqual([]);
    expect(recorded.info).toEqual([]);
  });

  it('fills Copilot Chat and tells the user to press Enter (R1.10)', async () => {
    installed.add('GitHub.copilot-chat');
    setFolders(APP);
    await handOff(deps('copilot'), server(), { kind: 'run', spec: 'auth' });
    expect(recorded.commands).toContainEqual({
      command: 'workbench.action.chat.open', args: [{ query: '/steno-run auth', isPartialQuery: true }],
    });
    expect(recorded.info).toEqual(['Press Enter in Copilot Chat to send it']);
  });

  it('opens the Claude Code extension through its URI (R1.10)', async () => {
    installed.add('anthropic.claude-code');
    setFolders(APP);
    await handOff(deps('claude-code'), server(), { kind: 'review', spec: 'auth', phase: 'design' });
    expect(recorded.external).toEqual([`vscode://anthropic.claude-code/open?prompt=${encodeURIComponent('/steno-review design auth')}`]);
    expect(recorded.info).toEqual(['Press Enter in Claude Code (extension) to send it']);
  });

  describe('the clipboard path (R1.11)', () => {
    it('copies the call when the chosen agent is the clipboard', async () => {
      await handOff(deps('clipboard'), server(), RUN);
      expect(recorded.clipboard).toEqual(['/steno-run T1 auth']);
      expect(recorded.info).toEqual(['Skill call copied; paste it into your agent']);
    });

    it('copies the call in the agent\'s own form when its program is gone, and keeps the choice', async () => {
      const d = deps('codex', probe({ exists: () => false }));
      await handOff(d, server(), RUN);
      expect(recorded.terminals).toEqual([]);
      expect(recorded.clipboard).toEqual(['$steno-run T1 auth']);
      expect(recorded.info).toEqual([`${label('codex')} was not found. Skill call copied; paste it into your agent`]);
      expect(d.state.values.get(AGENT_KEY)).toBe('codex');
    });

    it('copies the call when the agent extension is no longer installed', async () => {
      await handOff(deps('copilot'), server(), RUN);
      expect(recorded.info).toEqual(['Copilot Chat was not found. Skill call copied; paste it into your agent']);
    });

    it('copies the call when the terminal cannot be created', async () => {
      failures.createTerminal = true;
      await handOff(deps('claude'), server(), RUN);
      expect(recorded.clipboard).toEqual(['/steno-run T1 auth']);
      expect(recorded.info).toEqual([`${label('claude')} could not be reached. Skill call copied; paste it into your agent`]);
    });

    it('copies the call when the chat command throws or openExternal says no', async () => {
      setFolders(APP);
      installed.add('GitHub.copilot-chat');
      installed.add('anthropic.claude-code');
      failures.executeCommand = true;
      await handOff(deps('copilot'), server(), RUN);
      failures.openExternal = 'false';
      await handOff(deps('claude-code'), server(), RUN);
      failures.openExternal = 'throw';
      await handOff(deps('claude-code'), server(), RUN);
      expect(recorded.info).toEqual([
        'Copilot Chat could not be reached. Skill call copied; paste it into your agent',
        'Claude Code (extension) could not be reached. Skill call copied; paste it into your agent',
        'Claude Code (extension) could not be reached. Skill call copied; paste it into your agent',
      ]);
    });

    it('copies the call for a Windows .cmd shim whose path holds " or %', async () => {
      const windows = probe({ env: { path: 'C:\\100%', pathExt: '.CMD', windows: true }, exists: p => p === 'C:\\100%\\claude.cmd' });
      await handOff(deps('claude', windows), server(), RUN);
      expect(recorded.terminals).toEqual([]);
      expect(recorded.info).toEqual([`${label('claude')} could not be reached. Skill call copied; paste it into your agent`]);
    });

    it('copies the call for an extension agent while the window holds several steno projects', async () => {
      const other = folder('/work/other', 1);
      setFolders(APP, other);
      installed.add('GitHub.copilot-chat');
      await handOff(deps('copilot', probe({}, [ROOT, '/work/other'])), server(), RUN);
      expect(recorded.commands.map(c => c.command)).not.toContain('workbench.action.chat.open');
      expect(recorded.info).toEqual(['Skill call copied; paste it into your agent in app']);
    });
  });

  describe('choosing the agent (R2.4)', () => {
    it('asks for an agent when none is saved, saves it and goes on', async () => {
      const d = deps(undefined);
      answers.pick = 'Codex CLI (terminal)';
      await handOff(d, server(), RUN);
      expect(recorded.picks).toHaveLength(1);
      expect(d.state.values.get(AGENT_KEY)).toBe('codex');
      expect(recorded.terminals).toHaveLength(1);
    });

    it('uses the saved agent without asking', async () => {
      await handOff(deps('clipboard'), server(), RUN);
      expect(recorded.picks).toEqual([]);
    });
  });

  describe('unsaved edits (R1.12)', () => {
    const tasksMd = Uri.file(`${ROOT}/.steno/specs/auth/tasks.md`);
    const steering = Uri.file(`${ROOT}/.steno/steering/tech.md`);
    const code = Uri.file(`${ROOT}/src/index.ts`);

    it('offers to save, and saves only the Spec and steering documents before handing off', async () => {
      openDocument(tasksMd); openDocument(steering); openDocument(code);
      answers.message = 'Save and hand off';
      await handOff(deps('clipboard'), server(), RUN);
      expect(recorded.modal).toEqual(['2 spec or steering files have unsaved edits']);
      expect(recorded.saved.sort()).toEqual([tasksMd.toString(), steering.toString()]);
      expect(recorded.clipboard).toHaveLength(1);
    });

    it('hands off without saving when the user says so', async () => {
      openDocument(tasksMd);
      answers.message = 'Hand off without saving';
      await handOff(deps('clipboard'), server(), RUN);
      expect(recorded.modal).toEqual(['A spec or steering file has unsaved edits']);
      expect(recorded.saved).toEqual([]);
      expect(recorded.clipboard).toHaveLength(1);
    });

    it('asks nothing when no Spec or steering document is unsaved', async () => {
      openDocument(code);
      openDocument(Uri.file(`${ROOT}/.steno/specs/other/tasks.md`));
      await handOff(deps('clipboard'), server(), RUN);
      expect(recorded.modal).toEqual([]);
    });

    it('checks only steering when generating steering', async () => {
      openDocument(tasksMd);
      await handOff(deps('clipboard'), server(), { kind: 'steer' });
      expect(recorded.modal).toEqual([]);
      expect(recorded.clipboard).toEqual(['/steno-steer']);
    });
  });

  describe('cancelling (R2.6)', () => {
    it('saves and sends nothing when the agent picker is dismissed', async () => {
      const d = deps(undefined);
      await handOff(d, server(), RUN);
      expect(d.state.values.size).toBe(0);
      expect(recorded.clipboard).toEqual([]);
      expect(recorded.terminals).toEqual([]);
    });

    it('saves no agent and no document when the unsaved-edits modal is dismissed', async () => {
      const d = deps(undefined);
      openDocument(Uri.file(`${ROOT}/.steno/specs/auth/tasks.md`));
      answers.pick = 'Copy to clipboard';
      await handOff(d, server(), RUN);
      expect(recorded.modal).toHaveLength(1);
      expect(d.state.values.size).toBe(0);
      expect(recorded.saved).toEqual([]);
      expect(recorded.clipboard).toEqual([]);
    });
  });

  it('refuses in Restricted Mode before any prompt (R4.1)', async () => {
    workspace.isTrusted = false;
    const d = deps(undefined);
    await handOff(d, server(), RUN);
    expect(recorded.warning).toEqual(['Handing work to an agent needs a trusted workspace']);
    expect(recorded.picks).toEqual([]);
    expect(recorded.clipboard).toEqual([]);
  });

  it('ends with an error naming the task when no skill call fits, before any prompt', async () => {
    const d = deps(undefined);
    await handOff(d, server(), { kind: 'run', spec: 'auth', task: 'T1; rm -rf' });
    await handOff(d, server(), { kind: 'write', spec: 'auth', phase: 'execute' });
    expect(recorded.error).toEqual([
      expect.stringContaining('Cannot hand off task T1; rm -rf of auth'),
      expect.stringContaining('Cannot hand off auth'),
    ]);
    expect(recorded.picks).toEqual([]);
  });
});

describe('registerHandoffs (R1.1 to R1.7)', () => {
  const ROOT_URI = APP.uri as unknown as import('vscode').Uri;
  const tasksUri = Uri.file(`${ROOT}/.steno/specs/auth/tasks.md`) as unknown as import('vscode').Uri;

  function setup(t: SpecTree = tree()) {
    const s = server(APP, t);
    const p = { all: () => [s], get: (uri: { fsPath: string }) => (uri.fsPath.startsWith(ROOT) ? s : undefined) } as unknown as ServerPool;
    registerHandoffs(p, deps('clipboard'));
    return (command: string, arg: unknown) => handlers.get(command)!(arg);
  }

  it('runs a task from its tree node or its lens, naming the task and the Spec (R1.2)', async () => {
    const run = setup();
    await run(RUN_TASK_COMMAND, new TaskNode(spec(), task('T1'), [], false, tasksUri));
    await run(RUN_TASK_COMMAND, { spec: 'auth', task: 'T1', optional: false, uri: tasksUri });
    expect(recorded.clipboard).toEqual(['/steno-run T1 auth', '/steno-run T1 auth']);
  });

  it('runs the next task naming only the Spec (R1.3)', async () => {
    const run = setup();
    await run(RUN_NEXT_COMMAND, new SpecNode(ROOT_URI, tree(), spec()));
    expect(recorded.clipboard).toEqual(['/steno-run auth']);
  });

  it('writes and reviews the current phase, and generates steering (R1.4, R1.5, R1.6)', async () => {
    const run = setup();
    const design = spec({ phase: 'design' });
    await run(WRITE_COMMAND, new SpecNode(ROOT_URI, tree(), design));
    await run(REVIEW_COMMAND, new SpecNode(ROOT_URI, tree(), design));
    await run(REVIEW_COMMAND, new SpecNode(ROOT_URI, tree(), spec({ phase: 'done' })));
    // from a folder of the Steering view, and from its title bar, which passes no item
    await run(STEER_COMMAND, new FolderNode(APP as unknown as import('vscode').WorkspaceFolder, true));
    await run(STEER_COMMAND, undefined);
    expect(recorded.clipboard).toEqual([
      '/steno-design auth', '/steno-review design auth', '/steno-review drift auth', '/steno-steer', '/steno-steer',
    ]);
  });

  it('ignores a wrong node, an Unusable Spec, a done or parent task and a lens without its URI (R1.7)', async () => {
    const run = setup();
    const bad = { name: 'old', unsupported: true, phase: 'execute' } as TreeSpec;
    await run(RUN_NEXT_COMMAND, new SpecNode(ROOT_URI, tree(), bad));
    await run(WRITE_COMMAND, { kind: 'spec', folder: ROOT_URI, spec: spec({ phase: 'design' }) });
    await run(STEER_COMMAND, new SpecNode(ROOT_URI, tree(), spec()));
    await run(RUN_TASK_COMMAND, new TaskNode(spec(), task('T1', { done: true }), [], false, tasksUri));
    const child = new TaskNode(spec(), task('T1.1'), [], false, tasksUri);
    await run(RUN_TASK_COMMAND, new TaskNode(spec(), task('T1'), [child], false, tasksUri));
    await run(RUN_TASK_COMMAND, new TaskNode(bad, task('T1'), [], false, tasksUri));
    await run(RUN_TASK_COMMAND, { spec: 'auth', task: 'T1' });
    expect(recorded.clipboard).toEqual([]);
    expect(recorded.error).toEqual([]);
  });
});

describe('the manifest (R1.1 to R1.6)', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const HANDOFFS = [RUN_TASK_COMMAND, RUN_NEXT_COMMAND, WRITE_COMMAND, REVIEW_COMMAND, STEER_COMMAND];

  it('contributes the five handoffs, hidden from the command palette, each with a handler', () => {
    const contributed = manifest.contributes.commands.map((c: { command: string }) => c.command);
    const hidden = manifest.contributes.menus.commandPalette
      .filter((m: { when: string }) => m.when === 'false').map((m: { command: string }) => m.command);
    registerHandoffs(pool(), deps());
    for (const command of HANDOFFS) {
      expect(contributed).toContain(command);
      expect(hidden).toContain(command);
      expect(handlers.has(command)).toBe(true);
    }
  });

  it('hangs each handoff off the views only, generating steering off the Steering view', () => {
    const items = manifest.contributes.menus['view/item/context'].filter((m: { command: string }) => HANDOFFS.includes(m.command));
    expect(items.map((m: { command: string }) => m.command).sort()).toEqual([...HANDOFFS].sort());
    for (const m of items) {
      const view = m.command === STEER_COMMAND ? 'steering' : 'specs';
      expect(m.when).toMatch(new RegExp(`^view == steno\\.${view} && viewItem `));
    }
    expect(manifest.contributes.menus['view/title']).toContainEqual(
      { command: STEER_COMMAND, when: 'view == steno.steering && steno.hasProject', group: 'navigation' });
  });
});
