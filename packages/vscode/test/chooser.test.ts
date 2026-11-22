// The agent chooser: what the picker offers, what gets saved, and the status bar item.
import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { EventEmitter, answers, folder, handlers, installed, memento, recorded, resetRecorded, workspace } from './vscode-stub.js';
import { ADAPTERS, type Probe } from '../src/agents.js';
import { AGENT_KEY, CHOOSE_COMMAND, Chooser, hostProbe, pickerItems, registerChooser } from '../src/chooser.js';
import type { FolderServer, ServerPool } from '../src/servers.js';
import type { SpecTree } from '../src/protocol.js';

beforeEach(() => resetRecorded());

const byId = (id: string) => ADAPTERS.find(a => a.id === id)!;
const project: SpecTree = { protocolVersion: 1, specs: [], steering: [], specsDir: '.steno/specs', steeringDir: '.steno/steering' };

/** Just enough of a server pool for the chooser: the servers and their change event. */
function fakePool(...trees: (SpecTree | undefined)[]) {
  const changed = new EventEmitter<FolderServer>();
  const servers = trees.map((tree, i) => ({ folder: folder(`/work/${i}`, i), tree }) as unknown as FolderServer);
  const pool = { all: () => servers, onDidChange: changed.event } as unknown as ServerPool;
  return { pool, servers, fire: () => changed.fire(servers[0]) };
}

/** Only the codex program on PATH, and the Copilot Chat extension installed. */
const probe: Probe = {
  hasExtension: id => id === 'GitHub.copilot-chat',
  env: { path: '/bin', windows: false },
  exists: p => p === '/bin/codex',
};

describe('pickerItems', () => {
  it('lists the detected adapters in table order, then the clipboard once', () => {
    const others = ADAPTERS.filter(a => a.via !== 'clipboard');
    fc.assert(fc.property(fc.subarray(others.map(a => a.id)), fc.boolean(), (ids, clipboardDetected) => {
      const on = new Set(ids);
      const items = pickerItems(ADAPTERS, a => (a.via === 'clipboard' ? clipboardDetected : on.has(a.id)));
      expect(items.map(a => a.id)).toEqual([...others.filter(a => on.has(a.id)).map(a => a.id), 'clipboard']);
    }));
  });
});

describe('Chooser', () => {
  it('shows the logo and "steno: choose agent" with no choice, and the label once one is saved', async () => {
    const { pool } = fakePool(project);
    const chooser = new Chooser(memento(), probe, pool);
    const [item] = recorded.statusItems;
    expect(item.text).toBe('$(steno-logo) steno: choose agent');
    expect(item.command).toBe(CHOOSE_COMMAND);
    expect(chooser.current()).toBeUndefined();
    await chooser.save(byId('codex'));
    expect(chooser.current()).toBe(byId('codex'));
    expect(item.text).toBe('$(steno-logo) steno: Codex CLI (terminal)');
  });

  it('reads the stored id, and counts an id no longer in the table as no choice', () => {
    const { pool } = fakePool(project);
    expect(new Chooser(memento({ [AGENT_KEY]: 'gemini' }), probe, pool).current()).toBe(byId('gemini'));
    expect(new Chooser(memento({ [AGENT_KEY]: 'gone-agent' }), probe, pool).current()).toBeUndefined();
    expect(recorded.statusItems[1].text).toBe('$(steno-logo) steno: choose agent');
  });

  it('shows the status item only while a folder is a steno project, following the pool', () => {
    const { pool, servers, fire } = fakePool(undefined);
    new Chooser(memento(), probe, pool);
    const [item] = recorded.statusItems;
    expect(item.visible).toBe(false);
    (servers[0] as { tree?: SpecTree }).tree = project;
    fire();
    expect(item.visible).toBe(true);
    (servers[0] as { tree?: SpecTree }).tree = { ...project, notSetUp: true };
    fire();
    expect(item.visible).toBe(false);
  });

  it('pick offers the detected adapters and the clipboard, and stores nothing', async () => {
    const state = memento();
    const chooser = new Chooser(state, probe, fakePool(project).pool);
    answers.pick = 'Codex CLI (terminal)';
    expect(await chooser.pick()).toBe(byId('codex'));
    expect(recorded.picks[0].labels).toEqual(['Copilot Chat', 'Codex CLI (terminal)', 'Copy to clipboard']);
    expect(state.values.size).toBe(0);
  });

  it('stops listening and removes the item on dispose', () => {
    const { pool, fire } = fakePool(project);
    const chooser = new Chooser(memento(), probe, pool);
    chooser.dispose();
    const [item] = recorded.statusItems;
    expect(item.disposed).toBe(true);
    fire();
    expect(item.visible).toBe(false);
  });
});

describe('steno.agent.choose', () => {
  const setUp = (state = memento()) => {
    const chooser = new Chooser(state, probe, fakePool(project).pool);
    registerChooser(chooser);
    return { state, run: () => handlers.get(CHOOSE_COMMAND)!() };
  };

  it('picks and saves the choice for the workspace', async () => {
    const { state, run } = setUp();
    answers.pick = 'Copilot Chat';
    await run();
    expect(state.values.get(AGENT_KEY)).toBe('copilot');
    expect(recorded.statusItems[0].text).toBe('$(steno-logo) steno: Copilot Chat');
  });

  it('saves nothing when the pick is dismissed', async () => {
    const { state, run } = setUp(memento({ [AGENT_KEY]: 'claude' }));
    await run();
    expect(state.values.get(AGENT_KEY)).toBe('claude');
  });

  it('stops at the trust guard in Restricted Mode, before any pick', async () => {
    const { state, run } = setUp();
    workspace.isTrusted = false;
    answers.pick = 'Copilot Chat';
    await run();
    expect(recorded.warning).toEqual(['Choosing a coding agent needs a trusted workspace']);
    expect(recorded.picks).toEqual([]);
    expect(state.values.size).toBe(0);
  });
});

describe('hostProbe', () => {
  it('asks the editor for extensions and reads PATH when asked', () => {
    installed.add('anthropic.claude-code');
    const p = hostProbe();
    expect(p.hasExtension('anthropic.claude-code')).toBe(true);
    expect(p.hasExtension('GitHub.copilot-chat')).toBe(false);
    expect(p.env.path).toBe(process.env.PATH ?? '');
  });
});
