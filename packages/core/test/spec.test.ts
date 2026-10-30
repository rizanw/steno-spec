import { describe, it, expect } from 'vitest';
import { mkdtempSync, existsSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createSpec, loadSpec, scaffoldCurrent, artifactFor, saveState } from '../src/index.js';

function root() { return mkdtempSync(join(tmpdir(), 'steno-spec-')); }

describe('createSpec --brief and lazy scaffolding', () => {
  it('writes only brief.md; requirements.md appears via scaffoldCurrent once the phase moves on', () => {
    const { dir, written } = createSpec(root(), 'idea', { brief: true });
    expect(written).toEqual(['brief.md']);
    expect(existsSync(join(dir, 'requirements.md'))).toBe(false);

    const spec = loadSpec(dir);
    expect(spec.state.phase).toBe('brief');
    expect(artifactFor(spec.state)).toBe('brief.md');
    expect(scaffoldCurrent(spec)).toBeUndefined(); // brief.md already exists

    spec.state.phase = 'requirements';
    saveState(dir, spec.state);
    expect(artifactFor(spec.state)).toBe('requirements.md');
    expect(scaffoldCurrent(loadSpec(dir))).toBe('requirements.md');
    expect(existsSync(join(dir, 'requirements.md'))).toBe(true);
    expect(scaffoldCurrent(loadSpec(dir))).toBeUndefined(); // idempotent
  });

  it('scaffolds bugfix.md for a bugfix brief, then design.md and tasks.md per phase', () => {
    const { dir, written } = createSpec(root(), 'crash', { brief: true, bugfix: true });
    expect(written).toEqual(['brief.md']);
    const spec = loadSpec(dir);
    spec.state.phase = 'requirements'; saveState(dir, spec.state);
    expect(scaffoldCurrent(loadSpec(dir))).toBe('bugfix.md');
    spec.state.phase = 'design'; saveState(dir, spec.state);
    expect(scaffoldCurrent(loadSpec(dir))).toBe('design.md');
    spec.state.phase = 'tasks'; saveState(dir, spec.state);
    expect(scaffoldCurrent(loadSpec(dir))).toBe('tasks.md');
    spec.state.phase = 'execute'; saveState(dir, spec.state);
    expect(artifactFor(loadSpec(dir).state)).toBeUndefined();
    expect(scaffoldCurrent(loadSpec(dir))).toBeUndefined();
  });

  it('writes requirements.md directly without --brief', () => {
    const { written } = createSpec(root(), 'plain');
    expect(written).toEqual(['requirements.md']);
  });
});

describe('spec/placeholder lint', () => {
  it('flags the untouched template and clears once written', async () => {
    const { lintSpec, lintPlaceholders } = await import('../src/index.js');
    const { dir } = createSpec(root(), 'tpl');
    const before = lintSpec(loadSpec(dir), 'requirements').filter(i => i.rule === 'spec/placeholder');
    expect(before).toHaveLength(1);
    expect(before[0].file).toBe('requirements.md');
    expect(before[0].msg).toMatch(/skeleton/);
    writeFileSync(join(dir, 'requirements.md'), '# Requirements Document\n\n## Requirements\n\n### Requirement 1: Pick\n\n**User Story:** As a u, I want p, so that b.\n\n#### Acceptance Criteria\n\n1. THE App SHALL open.\n');
    expect(lintSpec(loadSpec(dir), 'requirements').filter(i => i.rule === 'spec/placeholder')).toHaveLength(0);
    expect(lintPlaceholders('ok <br> here\n```\n<not counted>\n```\n', 'x.md')).toHaveLength(0);
    expect(lintPlaceholders('a < b and c > d', 'x.md')).toHaveLength(0);
    expect(lintPlaceholders('THE <Component> SHALL', 'x.md')).toHaveLength(1);
  });
});

describe('spec/placeholder lint: generic types', () => {
  it('ignores <…> glued to an identifier but still flags template placeholders', async () => {
    const { lintPlaceholders } = await import('../src/index.js');
    expect(lintPlaceholders('The `Record<LinkErrorKind, number>` type fails the check.', 'design.md')).toHaveLength(0);
    expect(lintPlaceholders('Returns Promise<void> or Map<string, Array<Link>>.', 'design.md')).toHaveLength(0);
    expect(lintPlaceholders('- File: `src/<path>`', 'design.md')).toHaveLength(1);
    expect(lintPlaceholders('uses `Record<Kind, number>` in <Component>', 'design.md')).toHaveLength(1);
  });
});

describe('approval gates run in order', () => {
  it('only the current phase can be approved', async () => {
    const { approvalError } = await import('../src/index.js');
    const { state } = createSpec(root(), 'gated');
    expect(approvalError(state, 'requirements')).toBeUndefined();
    expect(approvalError(state, 'design')).toMatch(/phase requirements; only requirements/);
    expect(approvalError(state, 'tasks')).toMatch(/phase requirements/);
    expect(approvalError({ ...state, phase: 'design' }, 'design')).toBeUndefined();
    expect(approvalError({ ...state, phase: 'design' }, 'requirements')).toMatch(/phase design/);
  });

  it('quick specs have no gates to approve', async () => {
    const { approvalError } = await import('../src/index.js');
    const { state } = createSpec(root(), 'fast', { quick: true });
    expect(approvalError(state, 'requirements')).toMatch(/quick spec/);
  });
});

describe('importKiroSpec', () => {
  function kiroDir(files: Record<string, string>) {
    const d = mkdtempSync(join(tmpdir(), 'kiro-'));
    for (const [f, t] of Object.entries(files)) writeFileSync(join(d, f), t);
    return d;
  }

  it('refuses a slug that would escape the specs folder', async () => {
    const { importKiroSpec } = await import('../src/index.js');
    const r = root();
    const from = kiroDir({ 'requirements.md': '# Requirements Document\n' });
    for (const bad of ['../../escaped', '/tmp/abs', 'a/b', '..', 'Upper']) {
      expect(() => importKiroSpec(r, from, bad)).toThrow(/kebab-case slug/);
    }
    expect(existsSync(join(r, 'escaped'))).toBe(false);
  });

  it('imports under a valid slug and approves the stages that exist', async () => {
    const { importKiroSpec } = await import('../src/index.js');
    const from = kiroDir({ 'requirements.md': '# Requirements Document\n', 'design.md': '# Design\n' });
    const { dir } = importKiroSpec(root(), from, 'login');
    const s = loadSpec(dir).state;
    expect(s.approvals.requirements).toBeTruthy();
    expect(s.approvals.design).toBeTruthy();
    expect(s.phase).toBe('tasks');
  });
});

describe('shared Kiro specsDir', () => {
  it('lists Kiro folders without spec.yaml and writes spec.yaml on first load', async () => {
    const { listSpecs, specDir } = await import('../src/index.js');
    const r = root();
    mkdirSync(join(r, '.steno'), { recursive: true });
    writeFileSync(join(r, '.steno', 'config.yaml'), 'specsDir: .kiro/specs\n');
    const kiro = join(r, '.kiro', 'specs', 'login');
    mkdirSync(kiro, { recursive: true });
    writeFileSync(join(kiro, 'requirements.md'), '# Requirements Document\n');
    mkdirSync(join(r, '.kiro', 'specs', 'not-a-spec'));

    expect(listSpecs(r)).toEqual(['login']);
    expect(existsSync(join(kiro, 'spec.yaml'))).toBe(false);
    const spec = loadSpec(specDir(r, 'login'));
    expect(spec.state.name).toBe('login');
    expect(spec.state.phase).toBe('design');
    expect(existsSync(join(kiro, 'spec.yaml'))).toBe(true);
    expect(() => createSpec(r, 'login')).toThrow(/already exists/);
  });
});

describe('task completion and phase', () => {
  const md = (a: string, b: string, c: string) => `# Tasks\n\n- [${a}] 1. Build\n  - [${b}] 1.1 Core\n  - [${c}]* 1.2 Extra tests\n`;

  it('allTasksDone ignores optional tasks, whatever their parent shows', async () => {
    const { parseTasks, allTasksDone } = await import('../src/index.js');
    expect(allTasksDone(parseTasks(md(' ', 'x', ' ')))).toBe(true);
    expect(allTasksDone(parseTasks(md(' ', ' ', 'x')))).toBe(false);
  });

  it('syncDonePhase moves execute → done and back on undo', async () => {
    const { syncDonePhase } = await import('../src/index.js');
    const { state } = createSpec(root(), 'q', { quick: true });
    expect(syncDonePhase(state, false)).toBe(false);
    expect(syncDonePhase(state, true)).toBe(true);
    expect(state.phase).toBe('done');
    expect(syncDonePhase(state, false)).toBe(true);
    expect(state.phase).toBe('execute');
    const gated = { ...state, phase: 'design' as const };
    expect(syncDonePhase(gated, true)).toBe(false);
  });

  it('setTaskDone keeps CRLF line endings', async () => {
    const { parseTasks, setTaskDone } = await import('../src/index.js');
    const raw = md(' ', ' ', ' ').replace(/\n/g, '\r\n');
    const out = setTaskDone(parseTasks(raw), 'T1.1');
    expect(out).toContain('- [x] 1.1 Core\r\n');
    expect(out.replace(/\r\n/g, '')).not.toContain('\n');
  });
});

describe('seen cache', () => {
  it('lives in a self-ignoring local cache, not spec.yaml', async () => {
    const { loadSeen, saveSeen } = await import('../src/index.js');
    const r = root();
    const { dir } = createSpec(r, 'tracked');
    expect(loadSeen(r, 'tracked')).toEqual({});
    saveSeen(r, 'tracked', { 'requirements.md': 'abc' });
    saveSeen(r, 'other', { 'design.md': 'def' });
    expect(loadSeen(r, 'tracked')).toEqual({ 'requirements.md': 'abc' });
    expect(existsSync(join(r, '.steno', 'cache', '.gitignore'))).toBe(true);
    expect(readFileSync(join(dir, 'spec.yaml'), 'utf8')).not.toMatch(/seen/);
  });

  it('drops a legacy seen block from spec.yaml on load', () => {
    const { dir } = createSpec(root(), 'legacy');
    writeFileSync(join(dir, 'spec.yaml'), readFileSync(join(dir, 'spec.yaml'), 'utf8') + 'seen:\n  requirements.md: abc\n');
    expect('seen' in loadSpec(dir).state).toBe(false);
  });
});

describe('setTaskDone cascades through every level', () => {
  const md = '# Tasks\n\n- [ ] 1. Top\n  - [ ] 1.1 Mid\n    - [ ] 1.1.1 Leaf\n    - [ ] 1.1.2 Leaf two\n- [ ] 2. Other\n';
  it('done on a parent ticks grandchildren; undo reopens them', async () => {
    const { parseTasks, setTaskDone, nextTask } = await import('../src/index.js');
    const after = parseTasks(setTaskDone(parseTasks(md), 'T1'));
    expect(after.tasks.filter(t => t.id.startsWith('T1')).every(t => t.done)).toBe(true);
    expect(nextTask(after)?.id).toBe('T2');
    const undone = parseTasks(setTaskDone(after, 'T1', false));
    expect(undone.tasks.filter(t => t.id.startsWith('T1')).some(t => t.done)).toBe(false);
  });
});
