// The agent table and how we detect agents, including PATH lookup on macOS/Linux and on Windows.
import { describe, it, expect } from 'vitest';
import { ADAPTERS, detected, findOnPath, type AgentAdapter, type Env, type Probe } from '../src/agents.js';
import { render, skillCall, type Handoff } from '../src/calls.js';

const files = (...paths: string[]) => { const set = new Set(paths); return (p: string) => set.has(p); };
const posixEnv: Env = { path: '/usr/local/bin:/usr/bin::/opt/bin', windows: false };
const winEnv: Env = { path: 'C:\\Windows;C:\\Users\\u\\AppData\\Roaming\\npm', pathExt: '.COM;.EXE;.BAT;.CMD', windows: true };
const byId = (id: string) => ADAPTERS.find(a => a.id === id)!;

describe('ADAPTERS', () => {
  it('holds the seven adapters in picker order, with their forms and Fill_Only flags (R2.1, R1.10)', () => {
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

describe('findOnPath', () => {
  it('finds the bare name on POSIX, in PATH order, skipping empty entries', () => {
    expect(findOnPath('claude', posixEnv, files('/usr/bin/claude', '/opt/bin/claude'))).toBe('/usr/bin/claude');
    expect(findOnPath('claude', posixEnv, files('/usr/bin/claude.cmd'))).toBeUndefined();
    expect(findOnPath('claude', posixEnv, files())).toBeUndefined();
  });

  it('tries only the PATHEXT endings on Windows, in PATHEXT order', () => {
    const npm = 'C:\\Users\\u\\AppData\\Roaming\\npm';
    expect(findOnPath('codex', winEnv, files(`${npm}\\codex.cmd`, `${npm}\\codex.exe`))).toBe(`${npm}\\codex.exe`);
    expect(findOnPath('codex', winEnv, files('C:\\Windows\\codex'))).toBeUndefined();
  });

  it('resolves a bare npm script beside its .cmd shim to the shim on Windows', () => {
    const npm = 'C:\\Users\\u\\AppData\\Roaming\\npm';
    expect(findOnPath('gemini', winEnv, files(`${npm}\\gemini`, `${npm}\\gemini.cmd`))).toBe(`${npm}\\gemini.cmd`);
  });

  it('falls back to the usual PATHEXT when the variable is missing', () => {
    const env: Env = { path: 'C:\\bin', windows: true };
    expect(findOnPath('opencode', env, files('C:\\bin\\opencode.exe'))).toBe('C:\\bin\\opencode.exe');
  });
});

describe('detected', () => {
  const probe = (over: Partial<Probe> = {}): Probe =>
    ({ hasExtension: () => false, env: posixEnv, exists: () => false, ...over });

  it('counts an extension adapter when its extension is installed (R2.3)', () => {
    const p = probe({ hasExtension: id => id === 'GitHub.copilot-chat' });
    expect(detected(byId('copilot'), p)).toBe(true);
    expect(detected(byId('claude-code'), p)).toBe(false);
  });

  it('counts a terminal adapter when its program is on PATH (R2.3)', () => {
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
