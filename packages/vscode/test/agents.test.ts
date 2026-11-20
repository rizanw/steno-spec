// The agent table and how we detect agents.
import { describe, it, expect } from 'vitest';
import { ADAPTERS, detected, type AgentAdapter, type Probe } from '../src/agents.js';
import { render, skillCall, type Env, type Handoff } from '@steno/core/host';

const files = (...paths: string[]) => { const set = new Set(paths); return (p: string) => set.has(p); };
const posixEnv: Env = { path: '/usr/local/bin:/usr/bin::/opt/bin', windows: false };
const byId = (id: string) => ADAPTERS.find(a => a.id === id)!;

describe('ADAPTERS', () => {
  it('holds the seven adapters in picker order, with their forms and fill-only flags', () => {
    expect(ADAPTERS.map(a => [a.id, a.form, a.fillOnly])).toEqual([
      ['copilot', 'slash', true],
      ['claude-code', 'slash', true],
      ['claude', 'slash', false],
      ['codex', 'dollar', false],
      ['gemini', 'plain', false],
      ['opencode', 'plain', false],
      ['clipboard', 'slash', false],
    ]);
    expect(new Set(ADAPTERS.map(a => a.label)).size).toBe(7);
  });

  it('delivers through the named extension, program or the clipboard', () => {
    expect(byId('copilot').via).toEqual({ extension: 'GitHub.copilot-chat', deliver: 'chatCommand' });
    expect(byId('claude-code').via).toEqual({ extension: 'anthropic.claude-code', deliver: 'uri' });
    expect(byId('clipboard').via).toBe('clipboard');
    const argv = (id: string) => {
      const via = byId(id).via as { program: string; args: (c: string) => string[] };
      return [via.program, ...via.args('CALL')];
    };
    expect(argv('claude')).toEqual(['claude', 'CALL']);
    expect(argv('codex')).toEqual(['codex', 'CALL']);
    expect(argv('gemini')).toEqual(['gemini', '-i', 'CALL']);
    expect(argv('opencode')).toEqual(['opencode', '--prompt', 'CALL']);
  });

  it("keeps each terminal adapter's arguments in the call alphabet", () => {
    const handoffs: Handoff[] = [
      { kind: 'run', spec: 'my-spec', task: 'T3.1' }, { kind: 'run', spec: 'my_spec.2' },
      { kind: 'write', spec: 'a', phase: 'brief' }, { kind: 'review', spec: 'a', phase: 'done' }, { kind: 'steer' },
    ];
    for (const a of ADAPTERS) {
      if (typeof a.via === 'string' || !('program' in a.via)) continue;
      for (const h of handoffs) {
        for (const arg of a.via.args(render(skillCall(h)!, a.form))) expect(arg, a.id).toMatch(/^[A-Za-z0-9 /$:._-]+$/);
      }
    }
  });
});

describe('detected', () => {
  const probe = (over: Partial<Probe> = {}): Probe =>
    ({ hasExtension: () => false, env: posixEnv, exists: () => false, ...over });

  it('counts an extension adapter when its extension is installed', () => {
    const p = probe({ hasExtension: id => id === 'GitHub.copilot-chat' });
    expect(detected(byId('copilot'), p)).toBe(true);
    expect(detected(byId('claude-code'), p)).toBe(false);
  });

  it('counts a terminal adapter when its program is on PATH', () => {
    const p = probe({ exists: files('/usr/local/bin/codex') });
    expect(detected(byId('codex'), p)).toBe(true);
    expect(detected(byId('claude'), p)).toBe(false);
  });

  it('always counts the clipboard', () => {
    expect(detected(byId('clipboard'), probe())).toBe(true);
  });

  it('detects nothing else with no extension and an empty PATH', () => {
    const none: AgentAdapter[] = ADAPTERS.filter(a => detected(a, probe()));
    expect(none.map(a => a.id)).toEqual(['clipboard']);
  });
});
