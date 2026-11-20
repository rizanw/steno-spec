import { describe, expect, it, vi } from 'vitest';
import type { Row } from '../shared/contracts';
import { chooseTarget, creationHandoff, handoffFor, performHandoff, READY_TIMEOUT_MS, type ComposerLike, type HandoffDeps, type Target } from '../client/handoff';

const older = { id: 'a1', provider: 'codex', lastActivityAt: '2026-11-01T10:00:00Z' };
const newer = { id: 'a2', provider: 'claude', lastActivityAt: '2026-11-02T10:00:00Z' };

describe('where a hand-off goes', () => {
  it('goes to the focused agent of this workspace', () => {
    expect(chooseTarget('a1', [older, newer], true)).toEqual({ kind: 'focused', agentId: 'a1', provider: 'codex' });
  });

  it('goes to the focused agent even when Paseo cannot open agents, since it is already open', () => {
    expect(chooseTarget('a1', [older], false)).toEqual({ kind: 'focused', agentId: 'a1', provider: 'codex' });
  });

  it('passes over a focused agent of another workspace for the most recently active one here', () => {
    expect(chooseTarget('elsewhere', [older, newer], true)).toEqual({ kind: 'recent', agentId: 'a2', provider: 'claude' });
    expect(chooseTarget(null, [newer, older], true)).toEqual({ kind: 'recent', agentId: 'a2', provider: 'claude' });
  });

  it('fills the one open New Agent screen when no agent of this workspace is focused', () => {
    expect(chooseTarget(null, [older, newer], true, ['claude'])).toEqual({ kind: 'draft', provider: 'claude' });
    expect(chooseTarget(null, [], false, [null])).toEqual({ kind: 'draft', provider: null });
  });

  it('prefers the focused agent over an open New Agent screen', () => {
    expect(chooseTarget('a1', [older], true, ['claude'])).toEqual({ kind: 'focused', agentId: 'a1', provider: 'codex' });
  });

  it('passes over New Agent screens when several are open, since none says its workspace', () => {
    expect(chooseTarget(null, [older], true, ['claude', 'codex'])).toEqual({ kind: 'recent', agentId: 'a1', provider: 'codex' });
    expect(chooseTarget(null, [], true, ['claude', 'codex'])).toEqual({ kind: 'clipboard' });
  });

  it('copies to the clipboard with no agent in the workspace', () => {
    expect(chooseTarget(null, [], true)).toEqual({ kind: 'clipboard' });
  });

  it('copies to the clipboard when Paseo cannot open an agent', () => {
    expect(chooseTarget(null, [older], false)).toEqual({ kind: 'clipboard' });
  });
});

function deps(over: Partial<HandoffDeps> = {}) {
  const notes: string[] = [];
  const d: HandoffDeps & { notes: string[] } = {
    notes,
    call: vi.fn(async (provider?: string) => ({ ok: true as const, text: `${provider ?? 'plain'}:/steno-run`, plain: 'run steno-run' })),
    focusedComposer: () => undefined,
    openAgent: vi.fn(),
    draftComposer: () => undefined,
    paste: 'press ⌘V',
    sleep: vi.fn(async () => {}),
    copy: vi.fn(async () => {}),
    notify: (message: string) => { notes.push(message); },
    ...over,
  };
  return d;
}

const composer = (): ComposerLike & { inserted: string[] } => {
  const inserted: string[] = [];
  return { inserted, insertText: t => { inserted.push(t); }, focus: vi.fn(async () => {}) };
};

describe('placing the call', () => {
  it('puts the call worded for the agent into the focused message box, unsent', async () => {
    const box = composer();
    const d = deps({ focusedComposer: id => (id === 'a1' ? box : undefined) });
    expect(await performHandoff({ kind: 'focused', agentId: 'a1', provider: 'codex' }, d)).toBe('inserted');
    expect(d.call).toHaveBeenCalledWith('codex');
    expect(box.inserted).toEqual(['codex:/steno-run']);
    expect(d.openAgent).not.toHaveBeenCalled();
  });

  it('opens the most recent agent and inserts once its message box takes focus', async () => {
    const box = composer();
    let polls = 0;
    const d = deps({ focusedComposer: () => (++polls >= 3 ? box : undefined) });
    expect(await performHandoff({ kind: 'recent', agentId: 'a2', provider: 'claude' }, d)).toBe('inserted');
    expect(d.openAgent).toHaveBeenCalledWith('a2');
    expect(box.inserted).toEqual(['claude:/steno-run']);
  });

  it('puts the call into the New Agent screen unsent, worded for its provider', async () => {
    const box = composer();
    const d = deps({ draftComposer: () => box });
    expect(await performHandoff({ kind: 'draft', provider: 'claude' }, d)).toBe('inserted');
    expect(d.call).toHaveBeenCalledWith('claude');
    expect(box.inserted).toEqual(['claude:/steno-run']);
    expect(d.openAgent).not.toHaveBeenCalled();
  });

  it('copies the plain call when the New Agent screen closed before the call was placed', async () => {
    const d = deps();
    expect(await performHandoff({ kind: 'draft', provider: null }, d)).toBe('copied');
    expect(d.call).toHaveBeenCalledWith(undefined);
  });

  it('copies the plain call when the opened agent is not ready within 2 s', async () => {
    let waited = 0;
    const d = deps({ sleep: async ms => { waited += ms; } });
    expect(await performHandoff({ kind: 'recent', agentId: 'a2', provider: 'claude' }, d)).toBe('copied');
    expect(waited).toBe(READY_TIMEOUT_MS);
    expect(d.copy).toHaveBeenCalledWith('run steno-run');
    expect(d.notes).toEqual(["The agent took too long to open. It's copied: press ⌘V in its message box."]);
  });

  it('copies the plain call with no agent to hand it to', async () => {
    const d = deps();
    expect(await performHandoff({ kind: 'clipboard' }, d)).toBe('copied');
    expect(d.notes).toEqual(["No agent is open. It's copied: open one and press ⌘V."]);
    expect(d.call).toHaveBeenCalledWith(undefined);
    expect(d.copy).toHaveBeenCalledWith('run steno-run');
  });

  it('copies the plain call when the message box refuses the text', async () => {
    const d = deps({ focusedComposer: () => ({ insertText: () => { throw new Error('gone'); }, focus: async () => {} }) });
    expect(await performHandoff({ kind: 'focused', agentId: 'a1', provider: 'claude' }, d)).toBe('copied');
  });

  it('shows the call in the toast when the clipboard fails too', async () => {
    const d = deps({ copy: async () => { throw new Error('denied'); } });
    expect(await performHandoff({ kind: 'clipboard' }, d)).toBe('failed');
    expect(d.notes[0]).toContain('run steno-run');
  });

  it('inserts and copies nothing when there is no skill for the hand-off', async () => {
    const box = composer();
    const d = deps({ call: async () => ({ ok: false, message: 'no steno skill to hand off' }), focusedComposer: () => box });
    const target: Target = { kind: 'focused', agentId: 'a1', provider: 'claude' };
    expect(await performHandoff(target, d)).toBe('refused');
    expect(box.inserted).toEqual([]);
    expect(d.copy).not.toHaveBeenCalled();
    expect(d.notes).toEqual(['no steno skill to hand off']);
  });
});

describe('which hand-off an action makes', () => {
  const row = (target?: Row['target']): Row => ({ key: 'k', depth: 0, kind: 'task', label: 'k', actions: [], ...(target ? { target } : {}) });

  it('maps each hand-off action to its call', () => {
    expect(handoffFor(row({ spec: 's', task: 'T1' }), 'run')).toEqual({ kind: 'run', spec: 's', task: 'T1' });
    expect(handoffFor(row({ spec: 's' }), 'runNext')).toEqual({ kind: 'run', spec: 's' });
    expect(handoffFor(row({ spec: 's', phase: 'design' }), 'write')).toEqual({ kind: 'write', spec: 's', phase: 'design' });
    expect(handoffFor(row({ spec: 's', phase: 'done' }), 'review')).toEqual({ kind: 'review', spec: 's', phase: 'done' });
    expect(handoffFor(undefined, 'steer')).toEqual({ kind: 'steer' });
  });

  it('makes none for a change, or for a row without what the call needs', () => {
    expect(handoffFor(row({ spec: 's', task: 'T1' }), 'done')).toBeUndefined();
    expect(handoffFor(row({ spec: 's' }), 'run')).toBeUndefined();
    expect(handoffFor(row(), 'write')).toBeUndefined();
  });
});

describe('the hand-off after New Spec', () => {
  it('hands the first stage to an agent for writers agent and brainstorm', () => {
    expect(creationHandoff('agent', 'login', 'requirements')).toEqual({ kind: 'write', spec: 'login', phase: 'requirements' });
    expect(creationHandoff('brainstorm', 'login', 'brief')).toEqual({ kind: 'write', spec: 'login', phase: 'brief' });
  });

  it('hands nothing off when the person writes it', () => {
    expect(creationHandoff('me', 'login', 'requirements')).toBeUndefined();
  });
});
