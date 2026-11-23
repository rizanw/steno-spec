// The panel's rules: which rows show, which actions get a button, what each is called. They are the Paseo panel's,
// so these cases mirror packages/paseo/test/client.test.ts.
import { describe, expect, it } from 'vitest';
import type { PanelRow } from '@steno/core/host';
import { ACTION_ICONS, actionLabel, needsMore, newSpecAnswers, newSpecStart, setUpAnswers, problemCounts, ROW_ICONS, refusalProblems, reopenTarget, rowButtons, rowPress, pickEntries, agentLine, sendsForm, START_EXPANDED, toggled, visibleRows } from '../src/panel/rows.js';

const row = (key: string, parent?: string, extra: Partial<PanelRow> = {}): PanelRow =>
  ({ key, parent, depth: 0, kind: 'task', label: key, actions: [], ...extra });

describe('which rows show', () => {
  const rows = [row('specs'), row('spec:a', 'specs'), row('doc:a/tasks.md', 'spec:a'), row('task:a/T1', 'doc:a/tasks.md'), row('steering')];
  const keys = (expanded: readonly string[]) => visibleRows(rows, expanded).map(v => v.row.key);

  it('starts with both lists open and each spec closed', () => {
    expect(keys(START_EXPANDED)).toEqual(['specs', 'spec:a', 'steering']);
  });

  it('shows a row only when every row above it is expanded', () => {
    expect(keys(['specs', 'doc:a/tasks.md'])).toEqual(['specs', 'spec:a', 'steering']);
    expect(keys(['specs', 'spec:a', 'doc:a/tasks.md'])).toEqual(['specs', 'spec:a', 'doc:a/tasks.md', 'task:a/T1', 'steering']);
  });

  it('says which rows unfold and whether they are open', () => {
    const [specs, spec, steering] = visibleRows(rows, START_EXPANDED);
    expect(specs).toMatchObject({ expands: true, open: true });
    expect(spec).toMatchObject({ expands: true, open: false });
    expect(steering).toMatchObject({ expands: false, open: false });
  });

  it('shows the enclosing project\'s tree under the notice of a folder nested in it', () => {
    const nested = [
      row('notice:inside', undefined, { kind: 'notice' }), row('inside:specs', 'notice:inside', { kind: 'header' }),
      row('inside:spec:a', 'inside:specs', { kind: 'spec' }), row('inside:doc:a/tasks.md', 'inside:spec:a'),
    ];
    expect(visibleRows(nested, START_EXPANDED).map(v => v.row.key)).toEqual(['notice:inside', 'inside:specs', 'inside:spec:a']);
  });

  it('keeps room for a chevron only at a level where some row unfolds', () => {
    const tree = [
      row('specs'), row('spec:a', 'specs'), row('doc:a/brief.md', 'spec:a'), row('doc:a/tasks.md', 'spec:a'), row('task:a/T1', 'doc:a/tasks.md'),
      row('steering'), row('steering:tech.md', 'steering'), row('instruction:AGENTS.md', 'steering'),
    ];
    const slot = Object.fromEntries(visibleRows(tree, ['specs', 'spec:a', 'steering']).map(v => [v.row.key, v.chevronSlot]));
    expect(slot).toMatchObject({ specs: true, steering: true, 'spec:a': true, 'doc:a/brief.md': true, 'doc:a/tasks.md': true });
    expect(slot).toMatchObject({ 'steering:tech.md': false, 'instruction:AGENTS.md': false });
  });

  it('keeps a row whose parent is missing instead of dropping it', () => {
    expect(visibleRows([row('spec:a', 'specs')], []).map(v => v.row.key)).toEqual(['spec:a']);
  });

  it('adds a key to the open rows, or takes it out', () => {
    expect(toggled(['specs'], 'spec:a')).toEqual(['specs', 'spec:a']);
    expect(toggled(['specs', 'spec:a'], 'spec:a')).toEqual(['specs']);
  });
});

describe('pressing a row', () => {
  it('folds or unfolds a row with rows under it, and opens a row with a file', () => {
    const rows = [row('doc:a/tasks.md', undefined, { path: 'tasks.md', actions: ['open'] }), row('task:a/T1', 'doc:a/tasks.md'), row('steering:tech.md', undefined, { path: 'tech.md', actions: ['open'] })];
    const [doc, , file] = visibleRows(rows, ['doc:a/tasks.md']);
    expect(rowPress(doc)).toBe('toggle');
    expect(rowPress(file)).toBe('open');
  });

  it('opens its spec tasks.md from a task row, which has no path of its own', () => {
    const [task] = visibleRows([row('task:a/T1', undefined, { actions: ['run', 'done'] })], []);
    expect(rowPress(task)).toBe('open');
  });

  it('does nothing on a row with neither, or on a task read from the enclosing project', () => {
    const [spec, inside] = visibleRows([row('spec:a', undefined, { kind: 'spec', actions: ['review'] }), row('inside:task:a/T1', undefined, { actions: [] })], []);
    expect(rowPress(spec)).toBeUndefined();
    expect(rowPress(inside)).toBeUndefined();
  });
});

describe('a row\'s buttons', () => {
  const actions = (list: PanelRow['actions'], primary?: PanelRow['primary']) => row('r', undefined, { actions: list, ...(primary ? { primary } : {}) });

  it('shows no more button when every action already has a button', () => {
    const tasksDoc = actions(['approve', 'open'], 'approve');
    expect(rowButtons(tasksDoc, true)).toEqual(['open', 'approve']);
    expect(needsMore(tasksDoc, true)).toBe(false);
  });

  it('shows no more button when pressing the row does the only other action', () => {
    expect(rowButtons(actions(['approve', 'open'], 'approve'), false)).toEqual(['approve']);
    expect(needsMore(actions(['approve', 'open'], 'approve'), false)).toBe(false);
    expect(needsMore(actions(['open'], 'open'), false)).toBe(false);
    expect(needsMore(actions(['done'], 'done'), false)).toBe(false);
  });

  it('shows the more button when an action has no button', () => {
    expect(needsMore(actions(['write', 'review'], 'review'), true)).toBe(true);
    expect(needsMore(actions(['approve', 'review'], 'approve'), true)).toBe(true);
    expect(needsMore(actions(['done', 'run'], 'run'), false)).toBe(true);
  });

  it('never offers an action the row does not have', () => {
    expect(rowButtons(actions(['reopen'], 'run'), false)).toEqual([]);
    expect(needsMore(actions(['reopen'], 'run'), false)).toBe(true);
  });
});

describe('a row\'s words and icons', () => {
  it('names Write and Review after the phase they work on', () => {
    const spec = (phase: 'tasks' | 'done', written?: true) => row('spec:a', undefined, { target: { spec: 'a', phase, ...(written ? { written } : {}) } });
    expect(actionLabel('write', spec('tasks'))).toBe('Write Tasks');
    expect(actionLabel('write', spec('tasks', true))).toBe('Revise Tasks');
    expect(actionLabel('review', spec('done'))).toBe('Review Drift');
    expect(actionLabel('runNext', spec('tasks'))).toBe('Run Next Task');
  });

  it('counts a document\'s errors and warnings, and shows nothing when it is clean', () => {
    expect(problemCounts(row('d', undefined, { problems: { errors: 1, warnings: 2 } }))).toEqual({ errors: '1 error', warnings: '2 warnings' });
    expect(problemCounts(row('d', undefined, { problems: { errors: 0, warnings: 0 } }))).toEqual({});
  });

  it('uses the Paseo panel\'s icons, so both panels read the same', () => {
    expect(ROW_ICONS).toMatchObject({ spec: 'FilePen', execute: 'CirclePlay', done: 'CircleCheck', task: 'Circle' });
    expect(ACTION_ICONS).toMatchObject({ run: 'Play', runNext: 'FastForward', open: 'FileText' });
  });
});

describe('around a change', () => {
  it('lists each blocking problem of a refusal with its file and line', () => {
    const findings = [{ file: '.steno/specs/a/design.md', line: 12, severity: 'error' as const, rule: 'trace/missing', message: 'R2 has no design' }];
    expect(refusalProblems({ protocolVersion: 1, code: 'lint-failed', message: 'design has errors', findings } as never))
      .toEqual(['.steno/specs/a/design.md:12  error  R2 has no design']);
    expect(refusalProblems({ protocolVersion: 1, code: 'failed', message: 'no' } as never)).toEqual([]);
  });

  it('names the task on a task row and the whole spec on a spec row in the reopen confirm', () => {
    expect(reopenTarget(row('task:a/T1', undefined, { target: { spec: 'a', task: 'T1' } }))).toEqual({ spec: 'a', task: 'T1' });
    expect(reopenTarget(row('spec:a', undefined, { kind: 'spec', target: { spec: 'a', phase: 'done' } }))).toEqual({ spec: 'a' });
    expect(reopenTarget(undefined)).toBeUndefined();
  });
});

describe('the forms', () => {
  it('holds New Spec back until it has a name, and an agent when an agent writes', () => {
    const start = newSpecStart(['claude', 'codex']);
    expect(start).toMatchObject({ kind: 'feature', writer: 'self', agent: 'claude' });
    expect(newSpecAnswers(start)).toBeUndefined();
    expect(newSpecAnswers({ ...start, name: '  ' })).toBeUndefined();
    expect(newSpecAnswers({ ...newSpecStart([]), name: 'a', writer: 'agent' })).toBeUndefined();
  });

  it('sends New Spec\'s answers trimmed, with the agent only when an agent writes', () => {
    const start = newSpecStart(['claude']);
    expect(newSpecAnswers({ ...start, name: ' csv-export ', title: ' Export ' }))
      .toEqual({ kind: 'feature', name: 'csv-export', title: 'Export', description: '', writer: 'self' });
    expect(newSpecAnswers({ ...start, kind: 'bugfix', name: 'slow-login', writer: 'agent', description: 'Times out' }))
      .toEqual({ kind: 'bugfix', name: 'slow-login', title: '', description: 'Times out', writer: 'agent', agent: 'claude' });
  });

  it('sends the agents Set Up picked in the order offered, none meaning the shared folder only', () => {
    expect(setUpAnswers(['codex', 'claude', 'cursor'], ['cursor', 'codex'])).toEqual({ agents: 'codex,cursor' });
    expect(setUpAnswers(['codex'], [])).toEqual({ agents: '' });
  });

  it('lists each running agent before the agents a hand-off can start, sending its terminal or the agent to start', () => {
    const running = [{ terminalId: 't2', agent: 'claude', title: 'Claude Code' }, { terminalId: 't5', agent: 'claude', title: null }];
    expect(pickEntries(running, ['claude', 'codex'])).toEqual([
      { value: 'terminal:t2', label: 'claude — Claude Code, running', answers: { terminal: 't2', agent: 'claude' } },
      { value: 'terminal:t5', label: 'claude, running', answers: { terminal: 't5', agent: 'claude' } },
      { value: 'agent:claude', label: 'New claude', answers: { agent: 'claude' } },
      { value: 'agent:codex', label: 'New codex', answers: { agent: 'codex' } },
    ]);
    expect(pickEntries([], ['claude']).map(e => e.label)).toEqual(['New claude']);
  });

  it('names the agent hand-offs go to, or says each hand-off asks', () => {
    expect(agentLine('claude')).toBe('Agent: claude');
    expect(agentLine(undefined)).toBe('Agent: asks each time');
  });

  it('sends a form on Enter in a text field, leaving a description, a list and the choices their own keys', () => {
    expect(sendsForm('Enter', { tagName: 'INPUT', type: 'text' })).toBe(true);
    expect(sendsForm('a', { tagName: 'INPUT', type: 'text' })).toBe(false);
    for (const field of [{ tagName: 'TEXTAREA' }, { tagName: 'SELECT' }, { tagName: 'BUTTON' }, { tagName: 'INPUT', type: 'radio' }, { tagName: 'INPUT', type: 'checkbox' }]) {
      expect(sendsForm('Enter', field)).toBe(false);
    }
  });
});
