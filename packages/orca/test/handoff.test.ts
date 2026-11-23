import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { AGENTS } from '@steno/core';
import { callForm, render, skillCall, type Handoff, type PanelRow } from '@steno/core/host';
import { PHASES } from '@steno/core';
import { launchable, orcaAgent, stenoAgent } from '../src/worker/agents.js';
import { handoffFor, launch, runningAgents, sendTo } from '../src/worker/handoff.js';

type Listed = { terminalId: string | null; title: string | null; agent: string | null; state: string; stateStartedAt: number };

/**
 * An Orca whose launched agent shows in `agents.list` after `startsAfter` looks (never when it is `Infinity`), beside
 * the agents in `running`. `refuse` names a call that rejects; `typing` is what `terminal.sendText` answers.
 */
function fakeOrca({ refuse, startsAfter = 0, running = [], typing = true, api = { major: 1, minor: 10 } }:
  { refuse?: string; startsAfter?: number; running?: Listed[]; typing?: boolean; api?: { major: number; minor: number } } = {}) {
  const calls: { method: string; params: unknown }[] = [];
  let looks = 0;
  let launched: string | undefined;
  const orca = {
    api,
    host: {
      call: async (method: string, params: unknown) => {
        calls.push({ method, params });
        if (method === refuse) throw new Error('agent not installed');
        if (method === 'agent.launch') return { terminalId: (launched = 't1') };
        if (method === 'agents.list') {
          const up = launched !== undefined && looks++ >= startsAfter;
          return { agents: [...running, ...(up ? [{ terminalId: launched, title: null, agent: 'claude', state: 'waiting', stateStartedAt: 0 }] : [])] };
        }
        if (method === 'terminal.sendText') return { accepted: typing };
        return {};
      },
    },
  };
  return { orca: orca as never, calls };
}

// long enough for a busy test run to see the agent start; `never` is for the agent that does not
const quick = { timeoutMs: 2000, everyMs: 1 };
const never = { timeoutMs: 20, everyMs: 1 };
const typed = (calls: { method: string; params: unknown }[]) =>
  calls.filter(c => c.method === 'terminal.sendText').map(c => c.params as { terminalId: string; text: string; enter: boolean });
const notices = (calls: { method: string; params: unknown }[]) =>
  calls.filter(c => c.method === 'notifications.show').map(c => c.params as { title: string; body: string });
const delivered = async (result: unknown) => {
  expect(result).toMatchObject({ launched: true });
  return (result as { delivered: Promise<boolean> }).delivered;
};

const name = fc.oneof(fc.stringMatching(/^[a-z0-9][a-z0-9-]{0,12}$/), fc.string({ maxLength: 8 }));
const handoffs: fc.Arbitrary<Handoff> = fc.oneof(
  fc.record({ kind: fc.constant('run' as const), spec: name, task: fc.option(fc.oneof(fc.stringMatching(/^T[0-9](\.[0-9])?$/), fc.string({ maxLength: 4 })), { nil: undefined }) }),
  fc.record({ kind: fc.constantFrom('write' as const, 'review' as const), spec: name, phase: fc.constantFrom(...PHASES) }),
  fc.constant({ kind: 'steer' as const }),
);

describe('hand-off', () => {
  it('types the skill call the other hosts send into the agent it starts, or starts nothing when there is none', async () => {
    await fc.assert(fc.asyncProperty(handoffs, fc.constantFrom(...launchable()), async (handoff, agent) => {
      const { orca, calls } = fakeOrca();
      const result = await launch(orca, 'ws1', handoff, agent, quick);
      const call = skillCall(handoff);
      if (call === undefined) {
        expect(result).toHaveProperty('nothing');
        expect(calls.map(c => c.method)).toEqual(['notifications.show']);
      } else {
        expect(await delivered(result)).toBe(true);
        expect(calls[0]).toEqual({ method: 'agent.launch', params: { workspaceId: 'ws1', agent: orcaAgent(agent) } });
        expect(typed(calls)).toEqual([{ terminalId: 't1', text: render(call, callForm(agent)), enter: false }]);
      }
    }));
  });

  it('types the same call into an agent already running, worded for that agent', async () => {
    await fc.assert(fc.asyncProperty(handoffs, fc.constantFrom(...launchable()), async (handoff, agent) => {
      const { orca, calls } = fakeOrca({ running: [{ terminalId: 't9', title: 'busy', agent: orcaAgent(agent)!, state: 'waiting', stateStartedAt: 0 }] });
      const result = await sendTo(orca, 'ws1', 't9', handoff);
      const call = skillCall(handoff);
      if (call === undefined) {
        expect(result).toHaveProperty('nothing');
        expect(typed(calls)).toEqual([]);
      } else {
        expect(result).toEqual({ sent: true });
        expect(typed(calls)).toEqual([{ terminalId: 't9', text: render(call, callForm(agent)), enter: false }]);
      }
      expect(calls.map(c => c.method)).not.toContain('agent.launch');
    }));
  });

  it('words the call as each agent takes it', async () => {
    const { orca, calls } = fakeOrca();
    await delivered(await launch(orca, 'ws1', { kind: 'run', spec: 'a', task: 'T3.1' }, 'claude', quick));
    await delivered(await launch(orca, 'ws1', { kind: 'run', spec: 'a', task: 'T3.1' }, 'codex', quick));
    await delivered(await launch(orca, 'ws1', { kind: 'review', spec: 'a', phase: 'design' }, 'gemini', quick));
    expect(typed(calls).map(t => t.text)).toEqual(['/steno-run T3.1 a', '$steno-run T3.1 a', 'Use the steno-review skill with: design a']);
  });

  it('waits until Orca lists the started agent before typing, and shows its terminal at once', async () => {
    const { orca, calls } = fakeOrca({ startsAfter: 3 });
    expect(await delivered(await launch(orca, 'ws1', { kind: 'steer' }, 'claude', quick))).toBe(true);
    expect(calls.map(c => c.method)).toEqual(['agent.launch', 'terminal.focus', 'agents.list', 'agents.list', 'agents.list', 'agents.list', 'terminal.sendText']);
  });

  it('hands the call over to paste when the agent never starts', async () => {
    const { orca, calls } = fakeOrca({ startsAfter: Infinity });
    expect(await delivered(await launch(orca, 'ws1', { kind: 'run', spec: 'a', task: 'T1' }, 'claude', never))).toBe(false);
    expect(typed(calls)).toEqual([]);
    expect(notices(calls)).toEqual([{ title: 'Paste this into claude', body: '/steno-run T1 a' }]);
  });

  it('hands the call over to paste when Orca will not type into the terminal', async () => {
    for (const fake of [fakeOrca({ typing: false }), fakeOrca({ refuse: 'terminal.sendText' })]) {
      expect(await delivered(await launch(fake.orca, 'ws1', { kind: 'steer' }, 'claude', quick))).toBe(false);
      expect(notices(fake.calls)).toEqual([{ title: 'Paste this into claude', body: '/steno-steer' }]);
    }
  });

  it('hands the call over to paste when the picked agent has exited', async () => {
    const { orca, calls } = fakeOrca();
    expect(await sendTo(orca, 'ws1', 't9', { kind: 'run', spec: 'a', task: 'T1' })).toEqual({ nothing: 'That agent is no longer running.' });
    expect(typed(calls)).toEqual([]);
    expect(notices(calls)).toEqual([{ title: 'Paste this into your agent', body: expect.stringContaining('steno-run') }]);
  });

  it('lists the agents running in a terminal that steno can word a call for', async () => {
    const running: Listed[] = [
      { terminalId: 't2', title: 'Claude Code', agent: 'claude', state: 'working', stateStartedAt: 0 },
      { terminalId: null, title: 'Claude Chat', agent: 'claude', state: 'waiting', stateStartedAt: 0 },
      { terminalId: 't3', title: 'pi', agent: 'pi', state: 'waiting', stateStartedAt: 0 },
      { terminalId: 't4', title: null, agent: 'codex', state: 'done', stateStartedAt: 0 },
    ];
    const { orca } = fakeOrca({ running });
    expect(await runningAgents(orca, 'ws1')).toEqual([{ terminalId: 't2', agent: 'claude', title: 'Claude Code' }, { terminalId: 't4', agent: 'codex', title: null }]);
    expect(stenoAgent('claude')).toBe('claude');
    expect(stenoAgent('pi')).toBeUndefined();
  });

  it('names the workspace to agents.list only where Orca takes it', async () => {
    const newer = fakeOrca({ api: { major: 1, minor: 10 } });
    const older = fakeOrca({ api: { major: 1, minor: 9 } });
    await runningAgents(newer.orca, 'ws1');
    await runningAgents(older.orca, 'ws1');
    expect(newer.calls).toEqual([{ method: 'agents.list', params: { workspaceId: 'ws1' } }]);
    expect(older.calls).toEqual([{ method: 'agents.list', params: undefined }]);
  });

  it('offers no running agent when Orca will not list them', async () => {
    expect(await runningAgents(fakeOrca({ refuse: 'agents.list' }).orca, 'ws1')).toEqual([]);
  });

  it('offers only the agents Orca can start, in steno order', () => {
    expect(launchable()).toEqual(AGENTS.map(a => a.key).filter(key => orcaAgent(key)));
    expect(launchable()).toContain('claude');
    expect(orcaAgent('no-such-agent')).toBeUndefined();
  });

  it('starts nothing for an agent Orca cannot start', async () => {
    const { orca, calls } = fakeOrca();
    expect(await launch(orca, 'ws1', { kind: 'steer' }, 'no-such-agent', quick)).toHaveProperty('nothing');
    expect(calls).toEqual([]);
  });

  it('reports Orca refusing to start the agent', async () => {
    const { orca, calls } = fakeOrca({ refuse: 'agent.launch' });
    expect(await launch(orca, 'ws1', { kind: 'steer' }, 'claude', quick)).toHaveProperty('nothing');
    expect(calls.at(-1)).toEqual({ method: 'notifications.show', params: { title: 'Starting claude failed', body: 'agent not installed' } });
  });

  it('still counts the agent as started when Orca will not show its terminal', async () => {
    const { orca, calls } = fakeOrca({ refuse: 'terminal.focus' });
    expect(await delivered(await launch(orca, 'ws1', { kind: 'steer' }, 'claude', quick))).toBe(true);
    expect(calls.map(c => c.method)).toEqual(['agent.launch', 'terminal.focus', 'agents.list', 'terminal.sendText']);
  });

  it('reads the hand-off from a row action the row offers', () => {
    const task: PanelRow = { key: 'task:a/T1', depth: 2, kind: 'task', label: 'T1', actions: ['done', 'run'], target: { spec: 'a', task: 'T1' } };
    const spec: PanelRow = { key: 'spec:a', depth: 1, kind: 'spec', label: 'a', actions: ['write', 'review'], target: { spec: 'a', phase: 'design' } };
    expect(handoffFor(task, 'run')).toEqual({ kind: 'run', spec: 'a', task: 'T1' });
    expect(handoffFor(spec, 'review')).toEqual({ kind: 'review', spec: 'a', phase: 'design' });
    expect(handoffFor(spec, 'runNext')).toBeUndefined();
    expect(handoffFor(undefined, 'steer')).toBeUndefined();
  });
});
