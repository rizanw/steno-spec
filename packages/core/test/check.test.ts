import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { check, defaultSpec, loadProject, StenoError, type Request } from '../src/index.js';

const STATE = (name: string, phase = 'execute', mode = 'gated') =>
  `name: ${name}\nkind: feature\nmode: ${mode}\nphase: ${phase}\ncreated: 2026-01-01\napprovals: {}\n`;
const TASKS = '# Tasks\n\n- [ ] 1. Do it\n';

function project(files: Record<string, string>, opts: { config?: string; steno?: boolean } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'steno-check-'));
  if (opts.steno !== false) mkdirSync(join(root, '.steno', 'specs'), { recursive: true });
  if (opts.config !== undefined) writeFileSync(join(root, '.steno', 'config.yaml'), opts.config);
  for (const [rel, text] of Object.entries(files)) {
    const p = join(root, rel);
    mkdirSync(join(p, '..'), { recursive: true });
    writeFileSync(p, text);
  }
  return root;
}
// a done spec has every task ticked; one with an open task would read as in execute
const sp = (name: string, phase = 'execute', mode = 'gated') => ({
  [`.steno/specs/${name}/spec.yaml`]: STATE(name, phase, mode), [`.steno/specs/${name}/tasks.md`]: phase === 'done' ? TASKS.replace('[ ]', '[x]') : TASKS,
});
const BROKEN = { '.steno/specs/bad/spec.yaml': 'formatVersion: 9\nname: bad\n' };

/** The StenoError `check` throws, or undefined when it passes. */
function refusal(root: string, req: Request, opts: { cli?: boolean; unsaved?: (p: string[]) => string | undefined } = {}) {
  try { check(req, loadProject(root), { cli: opts.cli ?? false, unsaved: opts.unsaved }); return undefined; } catch (e) {
    if (!(e instanceof StenoError)) throw e;
    return e;
  }
}

describe('check: one case per step', () => {
  const ok = project(sp('a'));

  it('passes a valid request and returns the entry and task', () => {
    const r = check({ kind: 'done', spec: 'a', task: 'T1' }, loadProject(ok), { cli: false });
    expect(r.entry.name).toBe('a');
    expect(r.task?.id).toBe('T1');
  });

  it('step 1: a missing field, an empty string counting as missing', () => {
    expect(refusal(ok, { kind: 'done', task: 'T1' })).toMatchObject({ code: 'invalid-request', field: 'spec' });
    expect(refusal(ok, { kind: 'done', spec: '', task: 'T1' })).toMatchObject({ code: 'invalid-request', field: 'spec' });
    expect(refusal(ok, { kind: 'reopen', spec: 'a', task: '' })).toMatchObject({ code: 'invalid-request', field: 'task' });
    expect(refusal(ok, { kind: 'packet', spec: 'a' })).toMatchObject({ code: 'invalid-request', field: 'task' });
    expect(refusal(ok, { kind: 'approve', spec: 'a', phase: '' })).toMatchObject({ code: 'invalid-request', field: 'phase' });
    expect(refusal(ok, { kind: 'packet', spec: 'a', task: 'T1', budget: 0 })).toMatchObject({ code: 'invalid-request', field: 'budget' });
    expect(refusal(ok, { kind: 'packet', spec: 'a', task: 'T1', budget: 1.5 })).toMatchObject({ field: 'budget' });
    expect(refusal(ok, { kind: 'packet', spec: 'a', task: 'T1', budget: 'x' })).toMatchObject({ field: 'budget' });
    expect(refusal(ok, { kind: 'packet', spec: 'a', task: 'T1', budget: '200' })).toBeUndefined();
    expect(refusal(ok, { kind: 'packet', spec: 'a', task: 'T1', budget: '' })).toBeUndefined();
  });

  it('step 2: not-set-up on the server; on the CLI only for an Unreadable configuration', () => {
    const bare = project({}, { steno: false });
    expect(refusal(bare, { kind: 'done', spec: 'a', task: 'T1' })).toMatchObject({ code: 'not-set-up' });
    expect(refusal(bare, { kind: 'read', spec: 'a' }, { cli: true })).toMatchObject({ code: 'not-found' });
    const badCfg = project(sp('a'), { config: '- a\n' });
    expect(refusal(badCfg, { kind: 'read', spec: 'a' }, { cli: true })).toMatchObject({ code: 'not-set-up' });
  });

  it('step 3: an unknown spec', () => {
    expect(refusal(ok, { kind: 'done', spec: 'zz', task: 'T1' })).toMatchObject({ code: 'not-found', spec: 'zz' });
  });

  it('step 4: an Unusable target names the spec, file and reason; lint may target it', () => {
    const root = project({ ...sp('a'), ...BROKEN });
    const e = refusal(root, { kind: 'done', spec: 'bad', task: 'T1' });
    expect(e).toMatchObject({ code: 'unsupported', spec: 'bad', file: join(root, '.steno/specs/bad/spec.yaml') });
    expect(e?.reason).toMatch(/format version 9/);
    expect(refusal(root, { kind: 'lint', spec: 'bad' }, { cli: true })).toBeUndefined();
    expect(refusal(root, { kind: 'done', spec: 'a', task: 'T1' })).toBeUndefined();
  });

  it('step 5: an unknown task, or a spec without tasks.md', () => {
    expect(refusal(ok, { kind: 'done', spec: 'a', task: 'T9' })).toMatchObject({ code: 'not-found', field: 'task' });
    const noTasks = project({ '.steno/specs/n/spec.yaml': STATE('n', 'requirements') });
    expect(refusal(noTasks, { kind: 'packet', spec: 'n', task: 'T1' })).toMatchObject({ code: 'not-found' });
  });

  it('step 6: approve rules', () => {
    const gated = project(sp('g', 'design'));
    expect(refusal(gated, { kind: 'approve', spec: 'g', phase: 'execute' })).toMatchObject({ code: 'invalid-request', reason: expect.stringMatching(/phase must be/) });
    expect(refusal(gated, { kind: 'approve', spec: 'g', phase: 'tasks' })).toMatchObject({ code: 'invalid-request', reason: expect.stringMatching(/only design/) });
    expect(refusal(gated, { kind: 'approve', spec: 'g', phase: 'design' })).toBeUndefined();
    const quick = project(sp('q', 'execute', 'quick'));
    expect(refusal(quick, { kind: 'approve', spec: 'q', phase: 'tasks' })).toMatchObject({ code: 'invalid-request', reason: expect.stringMatching(/quick spec/) });
  });

  it('step 6: only a finished spec can be reopened', () => {
    const root = project({
      ...sp('d', 'done'), ...sp('e', 'execute'),
    });
    expect(refusal(root, { kind: 'reopenSpec', spec: 'd' })).toBeUndefined();
    expect(refusal(root, { kind: 'reopenSpec', spec: 'e' })).toMatchObject({ code: 'invalid-request', field: 'spec', reason: expect.stringMatching(/only a done spec/) });
  });

  it('step 7: unsaved edits in a file the change writes or, for approve and packet, any spec document', () => {
    const asked: string[][] = [];
    const tasks = join(ok, '.steno/specs/a/tasks.md'), reqs = join(ok, '.steno/specs/a/requirements.md');
    const dirty = (file: string) => (paths: string[]) => { asked.push(paths); return paths.includes(file) ? file : undefined; };
    expect(refusal(ok, { kind: 'done', spec: 'a', task: 'T1' }, { unsaved: dirty(tasks) })).toMatchObject({ code: 'unsaved-edits', file: tasks });
    expect(refusal(ok, { kind: 'done', spec: 'a', task: 'T1' }, { unsaved: dirty(reqs) })).toBeUndefined();
    expect(refusal(ok, { kind: 'packet', spec: 'a', task: 'T1' }, { unsaved: dirty(reqs) })).toMatchObject({ code: 'unsaved-edits', file: reqs });
    expect(refusal(ok, { kind: 'read', spec: 'a' }, { cli: true, unsaved: dirty(reqs) })).toBeUndefined();
  });
});

describe('check on the CLI: the default spec', () => {
  it('picks the only spec, or the only one not done (defaultSpec)', () => {
    expect(defaultSpec(loadProject(project(sp('a', 'done'))))?.name).toBe('a');
    expect(defaultSpec(loadProject(project({ ...sp('a', 'done'), ...sp('b') })))?.name).toBe('b');
    expect(defaultSpec(loadProject(project({ ...sp('a'), ...sp('b') })))).toBeUndefined();
    expect(check({ kind: 'read' }, loadProject(project({ ...sp('a', 'done'), ...sp('b') })), { cli: true }).entry.name).toBe('b');
  });

  it('cannot choose: invalid-request on spec, after the Unusable test', () => {
    expect(refusal(project({ ...sp('a'), ...sp('b') }), { kind: 'read' }, { cli: true })).toMatchObject({ code: 'invalid-request', field: 'spec' });
    expect(refusal(project({}), { kind: 'read' }, { cli: true })).toMatchObject({ code: 'invalid-request', field: 'spec' });
    expect(refusal(project({ ...sp('a'), ...sp('b'), ...BROKEN }), { kind: 'read' }, { cli: true })).toMatchObject({ code: 'unsupported', spec: 'bad' });
    expect(refusal(project({ ...sp('a', 'done'), ...BROKEN }), { kind: 'lint' }, { cli: true })).toMatchObject({ code: 'unsupported', spec: 'bad' });
  });
});

describe('check: when several refusals apply, the first in order wins', () => {
  const root = project({ ...sp('a', 'design'), ...sp('q', 'execute', 'quick'), ...BROKEN });
  const bare = project({}, { steno: false });
  const always = () => join(root, '.steno/specs/a/tasks.md');
  const cases: [string, string, Request, string][] = [
    ['missing spec beats not set up', bare, { kind: 'done', task: 'T1' }, 'invalid-request'],
    ['bad budget beats not set up', bare, { kind: 'packet', spec: 'a', task: 'T1', budget: -1 }, 'invalid-request'],
    ['not set up beats unknown spec', bare, { kind: 'done', spec: 'zz', task: 'T1' }, 'not-set-up'],
    ['unknown spec beats unknown task', root, { kind: 'done', spec: 'zz', task: 'T9' }, 'not-found'],
    ['Unusable spec beats unknown task', root, { kind: 'done', spec: 'bad', task: 'T9' }, 'unsupported'],
    ['Unusable spec beats unsaved edits', root, { kind: 'approve', spec: 'bad', phase: 'design' }, 'unsupported'],
    ['unknown task beats unsaved edits', root, { kind: 'done', spec: 'a', task: 'T9' }, 'not-found'],
    ['approve rule beats unsaved edits', root, { kind: 'approve', spec: 'a', phase: 'tasks' }, 'invalid-request'],
    ['quick spec beats unsaved edits', root, { kind: 'approve', spec: 'q', phase: 'tasks' }, 'invalid-request'],
    ['unsaved edits last', root, { kind: 'approve', spec: 'a', phase: 'design' }, 'unsaved-edits'],
  ];
  it.each(cases)('%s', (_label, r, req, code) => {
    expect(refusal(r, req, { unsaved: always })?.code).toBe(code);
  });
});
