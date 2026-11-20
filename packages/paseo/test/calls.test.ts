import { describe, expect, it } from 'vitest';
import { buildCall } from '../server/calls';

describe('the skill call for a hand-off', () => {
  const run = { kind: 'run', spec: 'my-spec', task: 'T3.1' } as const;

  it('uses a slash for Claude, a dollar sign for Codex and a sentence for any other agent', () => {
    expect(buildCall(run, 'claude')).toMatchObject({ ok: true, text: '/steno-run T3.1 my-spec' });
    expect(buildCall(run, 'codex')).toMatchObject({ ok: true, text: '$steno-run T3.1 my-spec' });
    expect(buildCall(run, 'opencode')).toMatchObject({ ok: true, text: 'Use the steno-run skill with: T3.1 my-spec' });
    expect(buildCall(run)).toMatchObject({ ok: true, text: 'Use the steno-run skill with: T3.1 my-spec' });
  });

  it('always returns the plain form for the clipboard', () => {
    for (const provider of ['claude', 'codex', 'copilot', undefined]) {
      expect(buildCall(run, provider)).toMatchObject({ plain: 'Use the steno-run skill with: T3.1 my-spec' });
    }
    expect(buildCall({ kind: 'steer' }, 'claude')).toEqual({ ok: true, text: '/steno-steer', plain: 'Use the steno-steer skill' });
  });

  it('gives no call for an unsafe name or a phase with no skill', () => {
    expect(buildCall({ kind: 'run', spec: 'my spec; rm -rf /' }, 'claude')).toMatchObject({ ok: false });
    expect(buildCall({ kind: 'write', spec: 'my-spec', phase: 'execute' }, 'claude')).toMatchObject({ ok: false, message: expect.stringContaining('my-spec') });
  });
});
