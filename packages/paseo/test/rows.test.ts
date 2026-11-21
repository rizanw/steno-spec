import { describe, expect, it } from 'vitest';
import { APPROVABLE, DOCUMENT_PHASE, type Diagnostic, type OutlineItem, type SpecTree, type TreeSpec } from '../server/vendor/host.mjs';
import { specRows, steeringRows } from '../server/rows';
import { Row } from '../shared/contracts';

const task = (id: string, title: string, extra: Partial<OutlineItem> = {}, children: OutlineItem[] = []): OutlineItem =>
  ({ kind: 'task', id, title, line: 1, endLine: 1, children, ...extra });

const executing: TreeSpec = {
  name: 'login', title: 'Log in', kind: 'feature', mode: 'gated', phase: 'execute',
  approvals: { requirements: '2026-01-01', design: '2026-01-02', tasks: '2026-01-03' },
  tasks: { total: 3, done: 1, optionalTotal: 1, optionalDone: 0 }, next: { id: 'T1.2', title: 'Store sessions' },
  documents: ['requirements.md', 'design.md', 'tasks.md'],
  taskItems: [
    task('T1', 'Sessions', {}, [task('T1.1', 'Hash passwords', { done: true }), task('T1.2', 'Store sessions')]),
    task('T2', 'Polish', { optional: true }),
  ],
};
const designing: TreeSpec = { name: 'search', title: 'Search', mode: 'gated', phase: 'design', approvals: { requirements: '2026-01-01' }, documents: ['requirements.md', 'design.md'] };
const finished: TreeSpec = { name: 'export', title: 'Export', mode: 'quick', phase: 'done', documents: ['requirements.md', 'design.md', 'tasks.md'], taskItems: [] };
const broken: TreeSpec = { name: 'legacy', unsupported: true, files: [{ file: '.steno/specs/legacy/spec.yaml', reason: 'written by a newer steno' }] };

const tree = (specs: TreeSpec[], extra: Partial<SpecTree> = {}): SpecTree => ({ protocolVersion: 1, specs, steering: [], ...extra });
const none = new Map<string, Diagnostic[]>();
const byKey = (rows: Row[]) => new Map(rows.map(r => [r.key, r]));

describe('the spec rows', () => {
  it('lists specs in progress before done ones, each with its documents and tasks', () => {
    const rows = specRows(tree([finished, executing, designing]), none);
    expect(rows.filter(r => r.kind === 'spec').map(r => r.label)).toEqual(['Log in', 'Search', 'Export']);
    expect(rows.map(r => r.key).slice(0, 10)).toEqual([
      'specs', 'spec:login', 'doc:login/requirements.md', 'doc:login/design.md', 'doc:login/tasks.md',
      'task:login/T1', 'task:login/T1.1', 'task:login/T1.2', 'task:login/T2', 'spec:search',
    ]);
    for (const row of rows) expect(Row.safeParse(row).success, row.key).toBe(true);
  });

  it('nests each row under its parent, one level deeper', () => {
    const rows = byKey(specRows(tree([executing]), none));
    for (const row of rows.values()) {
      if (row.parent === undefined) { expect(row.depth).toBe(0); continue; }
      expect(row.depth, row.key).toBe(rows.get(row.parent)!.depth + 1);
    }
    expect(rows.get('task:login/T1.2')!.parent).toBe('task:login/T1');
  });

  it('shows tasks left in execute, the phase while writing, nothing once done', () => {
    const rows = byKey(specRows(tree([executing, designing, finished]), none));
    expect(rows.get('spec:login')!.detail).toBe('2 tasks left');
    expect(rows.get('spec:search')!.detail).toBe('design');
    expect(rows.get('spec:export')!.detail).toBeUndefined();
    expect(rows.get('spec:export')!.icon).toBe('done');
  });

  it('ticks finished documents and flags the next and optional tasks', () => {
    const rows = byKey(specRows(tree([executing, designing]), none));
    expect(rows.get('doc:search/requirements.md')!.icon).toBe('finished');
    expect(rows.get('doc:search/design.md')!.icon).toBe('document');
    expect(rows.get('task:login/T1.1')!.icon).toBe('finished');
    expect(rows.get('task:login/T1.2')).toMatchObject({ icon: 'next', detail: 'next' });
    expect(rows.get('task:login/T2')).toMatchObject({ icon: 'task', detail: 'optional' });
  });

  it('names what each row acts on and where a document lives', () => {
    const rows = byKey(specRows(tree([executing], { specsDir: 'specs/' }), none));
    expect(rows.get('spec:login')!.target).toEqual({ spec: 'login', phase: 'execute' });
    expect(rows.get('doc:login/design.md')).toMatchObject({ target: { spec: 'login', phase: 'design' }, path: 'specs/login/design.md' });
    expect(rows.get('task:login/T1.2')!.target).toEqual({ spec: 'login', task: 'T1.2' });
  });

  it('counts the errors and warnings of each document', () => {
    const d = (severity: 'error' | 'warning'): Diagnostic => ({ file: 'design.md', line: 2, severity, rule: 'x', message: 'm' });
    const diagnostics = new Map([['.steno/specs/search/design.md', [d('error'), d('warning'), d('error')]]]);
    const rows = byKey(specRows(tree([designing]), diagnostics));
    expect(rows.get('doc:search/design.md')!.problems).toEqual({ errors: 2, warnings: 1 });
    expect(rows.get('doc:search/requirements.md')!.problems).toEqual({ errors: 0, warnings: 0 });
  });

  it('shows a spec the server could not use with its reason, nothing below it and no actions', () => {
    const rows = specRows(tree([broken]), none);
    expect(rows.map(r => r.key)).toEqual(['specs', 'spec:legacy']);
    expect(rows[1]).toMatchObject({ detail: 'unsupported', tooltip: 'written by a newer steno', icon: 'warning', actions: [] });
  });

  it('offers New Spec on the header and, with no specs, on a notice', () => {
    const rows = specRows(tree([]), none);
    expect(rows.map(r => [r.key, r.actions])).toEqual([['specs', ['newSpec']], ['notice:no-specs', ['newSpec']]]);
  });

  it('offers Set Up in a folder that is not a steno project', () => {
    const rows = specRows(tree([], { notSetUp: true }), none);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'notice', actions: ['setUp'] });
  });

  it('names the enclosing project instead of offering Set Up', () => {
    const rows = specRows(tree([], { notSetUp: true }), none, '/work/app');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'notice', label: 'Inside the steno project /work/app', actions: [] });
  });
});

describe('the steering rows', () => {
  const steering: SpecTree['steering'] = [
    { path: '.steno/steering/tech.md', inclusion: 'always' },
    { path: '.steno/steering/api.md', inclusion: 'fileMatch', pattern: 'src/api/**' },
    { path: '.steno/steering/release.md', inclusion: 'manual' },
    { path: '.steno/steering/broken.md', unreadable: true, reason: 'bad frontmatter' },
  ];

  it('puts root instruction files first, then steering, then one agent\'s files, each A to Z', () => {
    const rows = steeringRows(tree([], { steering }), ['GEMINI.md', 'AGENTS.md'], ['.github/copilot-instructions.md', '.cursor/rules/style.mdc']);
    expect(rows.map(r => r.label)).toEqual([
      'Steering', 'AGENTS', 'GEMINI', 'api', 'broken', 'release', 'tech', '.cursor/rules/style.mdc', '.github/copilot-instructions.md',
    ]);
    expect(rows.slice(1).every(r => r.parent === 'steering' && r.depth === 1)).toBe(true);
    for (const row of rows) expect(Row.safeParse(row).success, row.key).toBe(true);
  });

  it('says when each steering file reaches the agent, or that it is unreadable', () => {
    const rows = byKey(steeringRows(tree([], { steering }), [], []));
    expect(rows.get('steering:.steno/steering/tech.md')).toMatchObject({ detail: 'always on', path: '.steno/steering/tech.md' });
    expect(rows.get('steering:.steno/steering/api.md')!.detail).toBe('matching files');
    expect(rows.get('steering:.steno/steering/release.md')!.detail).toBe('on request');
    expect(rows.get('steering:.steno/steering/broken.md')).toMatchObject({ detail: 'unreadable', icon: 'warning' });
    expect(rows.has('notice:no-steering')).toBe(false);
  });

  it('offers Generate Steering on the header and, with no steering files, on a notice', () => {
    const rows = steeringRows(tree([]), ['AGENTS.md'], []);
    expect(rows.map(r => [r.key, r.actions])).toEqual([['steering', ['steer']], ['instruction:AGENTS.md', ['open']], ['notice:no-steering', ['steer']]]);
  });

  it('lists nothing in a folder that is not a steno project', () => {
    expect(steeringRows(tree([], { notSetUp: true }), ['AGENTS.md'], [])).toEqual([]);
  });
});

describe('the row actions', () => {
  const PHASES = ['brief', 'requirements', 'design', 'tasks', 'execute', 'done'] as const;
  const DOCUMENTS = ['brief.md', 'requirements.md', 'bugfix.md', 'design.md', 'tasks.md'];

  it('offers Approve only on the current phase\'s document of a usable gated spec in an approvable phase', () => {
    for (const phase of PHASES) for (const mode of ['gated', 'quick'] as const) for (const unsupported of [undefined, true] as const) {
      const spec: TreeSpec = { name: 's', mode, phase, unsupported, documents: DOCUMENTS, taskItems: [task('T1', 'One')] };
      const rows = specRows(tree([spec]), none);
      const approving = rows.filter(r => r.actions.includes('approve'));
      const expected = mode === 'gated' && !unsupported && APPROVABLE.includes(phase)
        ? DOCUMENTS.filter(d => DOCUMENT_PHASE[d] === phase).map(d => `doc:s/${d}`) : [];
      expect(approving.map(r => r.key), `${mode} ${phase} ${unsupported ? 'unsupported' : ''}`).toEqual(expected);
    }
  });

  it('keeps every primary action among the row\'s own actions', () => {
    const rows = [...specRows(tree([executing, designing, finished, broken]), none), ...steeringRows(tree([]), ['AGENTS.md'], [])];
    for (const row of rows) expect(Row.safeParse(row).success, row.key).toBe(true);
  });

  it('on a task: Run Task when offered, else Mark Done, and Reopen with no button once done', () => {
    const rows = byKey(specRows(tree([executing, { ...designing, documents: ['tasks.md'], taskItems: [task('T1', 'Early')] }]), none));
    expect(rows.get('task:login/T1.2')).toMatchObject({ actions: ['done', 'run'], primary: 'run' });
    expect(rows.get('task:login/T2')).toMatchObject({ actions: ['done', 'run'], primary: 'run' });
    expect(rows.get('task:login/T1')).toMatchObject({ actions: ['done'], primary: 'done' });
    expect(rows.get('task:search/T1')).toMatchObject({ actions: ['done'], primary: 'done' });
    expect(rows.get('task:login/T1.1')!.actions).toEqual(['reopen']);
    expect(rows.get('task:login/T1.1')!.primary).toBeUndefined();
  });

  it('on a document: Approve when offered, else Open', () => {
    const rows = byKey(specRows(tree([designing]), none));
    expect(rows.get('doc:search/design.md')).toMatchObject({ actions: ['approve', 'open'], primary: 'approve' });
    expect(rows.get('doc:search/requirements.md')).toMatchObject({ actions: ['open'], primary: 'open' });
  });

  it('on a spec: Run Next Task in execute, Write This Phase while writing, nothing once done or unusable', () => {
    const brief: TreeSpec = { name: 'idea', mode: 'gated', phase: 'brief', documents: ['brief.md'] };
    const rows = byKey(specRows(tree([executing, designing, brief, finished, broken]), none));
    expect(rows.get('spec:login')).toMatchObject({ actions: ['runNext'], primary: 'runNext' });
    expect(rows.get('spec:search')).toMatchObject({ actions: ['write', 'review'], primary: 'write' });
    expect(rows.get('spec:idea')).toMatchObject({ actions: ['write'], primary: 'write' });
    expect(rows.get('spec:export')!.actions).toEqual(['review']);
    expect(rows.get('spec:export')!.primary).toBeUndefined();
    expect(rows.get('spec:legacy')!.actions).toEqual([]);
    for (const row of rows.values()) if (row.kind === 'spec') expect(row.actions).not.toContain('approve');
  });

  it('on a spec whose phase document is written: Review is the button and Write waits in the sheet', () => {
    const brief: TreeSpec = { name: 'idea', mode: 'gated', phase: 'brief', documents: ['brief.md'], written: true };
    const rows = byKey(specRows(tree([{ ...designing, written: true }, brief]), none));
    expect(rows.get('spec:search')).toMatchObject({ actions: ['write', 'review'], primary: 'review', target: { written: true } });
    expect(byKey(specRows(tree([designing]), none)).get('spec:search')!.target).not.toHaveProperty('written');
    expect(rows.get('spec:idea')!.actions).toEqual(['write']);
    expect(rows.get('spec:idea')!.primary).toBeUndefined();
  });

  it('offers Open on every steering and instruction row, unreadable ones included', () => {
    const rows = steeringRows(tree([], { steering: [{ path: '.steno/steering/x.md', unreadable: true }] }), ['AGENTS.md'], []);
    for (const row of rows.slice(1)) expect(row).toMatchObject({ actions: ['open'], primary: 'open' });
  });
});
