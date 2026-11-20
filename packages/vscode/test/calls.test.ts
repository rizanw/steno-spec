// Which skill each action calls in each phase, the order of its arguments, and the three ways we write a call.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { SAFE, render, skillCall, type CallForm, type Handoff } from '../src/calls.js';
import type { Phase } from '../src/protocol.js';

const PHASES: Phase[] = ['brief', 'requirements', 'design', 'tasks', 'execute', 'done'];
const FORMS: CallForm[] = ['slash', 'dollar', 'plain'];
const ARG = '[A-Za-z0-9][A-Za-z0-9._-]*';

const safeName = fc.stringMatching(/^[A-Za-z0-9][A-Za-z0-9._-]{0,20}$/);
const anyName = fc.oneof(safeName, fc.string({ maxLength: 20 }), fc.constantFrom('', ' x', 'a b', 'a"b', '%x%', 'a&b', '../x', '-x', 'a\nb'));
const phase = fc.constantFrom(...PHASES);
const handoff = (name: fc.Arbitrary<string>): fc.Arbitrary<Handoff> => fc.oneof(
  fc.record({ kind: fc.constant('run' as const), spec: name, task: fc.option(name, { nil: undefined }) }),
  fc.record({ kind: fc.constantFrom('write' as const, 'review' as const), spec: name, phase }),
  fc.constant({ kind: 'steer' as const }),
);

describe('skillCall', () => {
  it('run with a task gives steno-run with the task before the spec', () => {
    expect(skillCall({ kind: 'run', spec: 'my-spec', task: 'T3.1' })).toEqual({ skill: 'steno-run', args: ['T3.1', 'my-spec'] });
  });

  it('run without a task names only the spec', () => {
    expect(skillCall({ kind: 'run', spec: 'my-spec' })).toEqual({ skill: 'steno-run', args: ['my-spec'] });
  });

  it('write gives the skill of each writing Phase, and nothing in execute or done', () => {
    const skill = (p: Phase) => skillCall({ kind: 'write', spec: 's', phase: p });
    expect(skill('brief')).toEqual({ skill: 'steno-brainstorm', args: ['s'] });
    expect(skill('requirements')).toEqual({ skill: 'steno-spec', args: ['s'] });
    expect(skill('design')).toEqual({ skill: 'steno-design', args: ['s'] });
    expect(skill('tasks')).toEqual({ skill: 'steno-tasks', args: ['s'] });
    expect(skill('execute')).toBeUndefined();
    expect(skill('done')).toBeUndefined();
  });

  it('review gives steno-review with the stage before the spec, drift for done, nothing in brief or execute', () => {
    const skill = (p: Phase) => skillCall({ kind: 'review', spec: 's', phase: p });
    expect(skill('requirements')).toEqual({ skill: 'steno-review', args: ['requirements', 's'] });
    expect(skill('design')).toEqual({ skill: 'steno-review', args: ['design', 's'] });
    expect(skill('tasks')).toEqual({ skill: 'steno-review', args: ['tasks', 's'] });
    expect(skill('done')).toEqual({ skill: 'steno-review', args: ['drift', 's'] });
    expect(skill('brief')).toBeUndefined();
    expect(skill('execute')).toBeUndefined();
  });

  it('steer gives steno-steer with no argument', () => {
    expect(skillCall({ kind: 'steer' })).toEqual({ skill: 'steno-steer', args: [] });
  });

  it('builds no call from an unsafe spec or task', () => {
    for (const bad of ['', 'a b', 'a"b', '%PATH%', 'a&b', '-x', '.x', 'a|b', 'a>b', 'a\nb']) {
      expect(skillCall({ kind: 'run', spec: bad }), bad).toBeUndefined();
      expect(skillCall({ kind: 'run', spec: 'ok', task: bad }), bad).toBeUndefined();
      expect(skillCall({ kind: 'write', spec: bad, phase: 'design' }), bad).toBeUndefined();
      expect(skillCall({ kind: 'review', spec: bad, phase: 'design' }), bad).toBeUndefined();
    }
  });
});

describe('render', () => {
  const call = { skill: 'steno-run', args: ['T3.1', 'my-spec'] };

  it('renders the three forms', () => {
    expect(render(call, 'slash')).toBe('/steno-run T3.1 my-spec');
    expect(render(call, 'dollar')).toBe('$steno-run T3.1 my-spec');
    expect(render(call, 'plain')).toBe('Use the steno-run skill with: T3.1 my-spec');
  });

  it('renders plain with no argument without "with:"', () => {
    expect(render({ skill: 'steno-steer', args: [] }, 'plain')).toBe('Use the steno-steer skill');
    expect(render({ skill: 'steno-steer', args: [] }, 'slash')).toBe('/steno-steer');
  });
});

describe('properties', () => {
  // Whatever we're handed, the message only ever holds a skill name and safe arguments.
  it('any call renders to the skill and at most two safe arguments, with no cmd.exe syntax', () => {
    const prefixed = new RegExp(`^[/$]steno-[a-z]+( ${ARG}){0,2}$`);
    const plain = new RegExp(`^Use the steno-[a-z]+ skill( with:( ${ARG}){1,2})?$`);
    fc.assert(fc.property(handoff(anyName), fc.constantFrom(...FORMS), (h, form) => {
      const call = skillCall(h);
      if (!call) return;
      const text = render(call, form);
      expect(text).toMatch(form === 'plain' ? plain : prefixed);
      expect(text).toMatch(/^[A-Za-z0-9 /$:._-]+$/);
    }));
  });

  // The skill and arguments always match the action and the spec's phase.
  it('run puts the task first; write and review are defined exactly in their Phases', () => {
    fc.assert(fc.property(safeName, safeName, phase, (spec, task, p) => {
      expect(SAFE.test(spec) && SAFE.test(task)).toBe(true);
      expect(skillCall({ kind: 'run', spec, task })).toEqual({ skill: 'steno-run', args: [task, spec] });
      const write = skillCall({ kind: 'write', spec, phase: p });
      expect(write !== undefined).toBe(['brief', 'requirements', 'design', 'tasks'].includes(p));
      const review = skillCall({ kind: 'review', spec, phase: p });
      expect(review !== undefined).toBe(['requirements', 'design', 'tasks', 'done'].includes(p));
      if (review) expect(review).toEqual({ skill: 'steno-review', args: [p === 'done' ? 'drift' : p, spec] });
    }));
  });
});
