import { describe, it, expect } from 'vitest';
import { mkdtempSync, existsSync, writeFileSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import fc from 'fast-check';
import {
  createSpec, loadSpec, scaffoldCurrent, artifactFor, saveState, requirementsFile, lintSpec, requestLine,
  requirementsTemplate, bugfixTemplate, briefTemplate,
} from '../src/index.js';
import type { Phase, LintIssue } from '../src/index.js';

function root() { return mkdtempSync(join(tmpdir(), 'steno-spec-')); }

describe('the request line', () => {
  it('a request line is the description on one line', () => {
    fc.assert(fc.property(fc.string(), text => {
      const line = requestLine(text);
      if (text.trim() === '') { expect(line).toBeUndefined(); return; }
      expect(line).toBeDefined();
      expect(line!.startsWith('> Request: ')).toBe(true);
      const body = line!.slice('> Request: '.length);
      expect(body).toBe(body.trim());
      expect(line).not.toMatch(/\n|\r|\s\s/);
    }));
  });

  it('lands under the first heading of each first document', () => {
    const at = (file: string, opts: object) => readFileSync(join(createSpec(root(), 'x', { ...opts, description: ' export\n  invoices ' }).dir, file), 'utf8');
    expect(at('requirements.md', {})).toContain('## Introduction\n\n> Request: export invoices\n\n<2 short paragraphs');
    expect(at('bugfix.md', { bugfix: true })).toContain('## Introduction\n\n> Request: export invoices\n\n<what is broken');
    expect(at('brief.md', { brief: true })).toContain('## Problem\n\n> Request: export invoices\n\n## Proposed direction');
    // quick mode puts it in requirements.md only
    const { dir } = createSpec(root(), 'q', { quick: true, description: 'export invoices' });
    expect(readFileSync(join(dir, 'requirements.md'), 'utf8')).toContain('> Request: export invoices');
    expect(readFileSync(join(dir, 'design.md'), 'utf8')).not.toContain('> Request:');
  });

  it('leaves the templates as they are without a description, or with a blank one', () => {
    for (const description of [undefined, '', '  \n ']) {
      const read = (file: string, opts: object) => readFileSync(join(createSpec(root(), 'x', { ...opts, description }).dir, file), 'utf8');
      expect(read('requirements.md', {})).toBe(requirementsTemplate('x'));
      expect(read('bugfix.md', { bugfix: true })).toBe(bugfixTemplate('x'));
      expect(read('brief.md', { brief: true })).toBe(briefTemplate('x'));
    }
  });
});

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

describe('spec/empty-section lint', () => {
  it('flags a heading with nothing under it, but not a parent of sub-headings', async () => {
    const { lintEmptySections } = await import('../src/index.js');
    expect(lintEmptySections('# Design\n\n## Overview\ntext\n\n## Open questions\n', 'design.md')).toEqual([
      { level: 'warn', rule: 'spec/empty-section', file: 'design.md', line: 6, msg: 'section "Open questions" is empty; fill it or delete the heading' },
    ]);
    expect(lintEmptySections('## Glossary\n\n## Non-goals\n- none\n', 'requirements.md').map(i => i.line)).toEqual([1]);
    expect(lintEmptySections('## Components\n### Store {#D-store}\n\n### Api\n_Satisfies: 1.1_\n', 'design.md').map(i => i.msg)).toEqual(['section "Store" is empty; fill it or delete the heading']);
    expect(lintEmptySections('## Components\n\n### Store\ntext\n', 'design.md')).toHaveLength(0);
    expect(lintEmptySections('## Setup\n```sh\n# not a heading\n```\n', 'design.md')).toHaveLength(0);
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

describe('requirementsFile names the kind\'s requirements file', () => {
  it('is bugfix.md for a bugfix spec and requirements.md for a feature spec', () => {
    expect(requirementsFile({ kind: 'bugfix' })).toBe('bugfix.md');
    expect(requirementsFile({ kind: 'feature' })).toBe('requirements.md');
  });

  it('artifactFor uses it for the requirements phase', () => {
    for (const kind of ['bugfix', 'feature'] as const) {
      const { dir } = createSpec(root(), `art-${kind}`, { bugfix: kind === 'bugfix' });
      const state = loadSpec(dir).state;
      expect(artifactFor(state)).toBe(requirementsFile(state));
    }
  });
});

type Kind = 'feature' | 'bugfix';
const FILE: Record<Kind, string> = { feature: 'requirements.md', bugfix: 'bugfix.md' };
const OTHER: Record<Kind, string> = { feature: 'bugfix.md', bugfix: 'requirements.md' };
const fixturesDir = join(import.meta.dirname, 'fixtures');

/** A spec of the given kind and phase whose requirements file holds `text`; `undefined` deletes it, `other` writes the text under the other kind's name instead. */
function specWith(kind: Kind, phase: Phase, text: string | undefined, opts: { other?: boolean } = {}) {
  const { dir } = createSpec(root(), 'req', { bugfix: kind === 'bugfix' });
  rmSync(join(dir, FILE[kind]));
  if (text !== undefined) writeFileSync(join(dir, opts.other ? OTHER[kind] : FILE[kind]), text);
  const state = loadSpec(dir).state;
  state.phase = phase; saveState(dir, state);
  return loadSpec(dir);
}

describe('loadSpec parses only the kind\'s requirements file', () => {
  const text = readFileSync(join(fixturesDir, 'requirements.md'), 'utf8');
  it('a bugfix spec with only requirements.md has no requirements', () => {
    const spec = specWith('bugfix', 'requirements', text, { other: true });
    expect(spec.files['requirements.md']).toBe(text);
    expect(spec.requirements).toBeUndefined();
  });
  it('a feature spec with only bugfix.md has no requirements', () => {
    const spec = specWith('feature', 'requirements', text, { other: true });
    expect(spec.files['bugfix.md']).toBe(text);
    expect(spec.requirements).toBeUndefined();
  });
  it('each kind parses its own file', () => {
    for (const kind of ['feature', 'bugfix'] as const) expect(specWith(kind, 'requirements', text).requirements).toBeDefined();
  });
});

describe('lint names the requirements file of the spec\'s kind', () => {
  const fixtures = readdirSync(fixturesDir).filter(f => f.endsWith('.md')).map(f => readFileSync(join(fixturesDir, f), 'utf8'));
  const texts = [
    ...fixtures,
    readFileSync(join(createSpec(root(), 'tpl-f').dir, 'requirements.md'), 'utf8'),
    readFileSync(join(createSpec(root(), 'tpl-b', { bugfix: true }).dir, 'bugfix.md'), 'utf8'),
    '# Requirements\n\n## Requirements\n\n### Requirement 1: Dup\n\n#### Acceptance Criteria\n\n1. the app shall open quickly in `src/app.ts`.\n\n### Requirement 1:\n',
    '# Requirements\n\nnothing here\n',
  ];

  it('bugfix findings equal feature findings except the file', () => {
    let total = 0;
    for (const text of texts) {
      const feature = lintSpec(specWith('feature', 'requirements', text), 'requirements');
      const bugfix = lintSpec(specWith('bugfix', 'requirements', text), 'requirements');
      total += feature.length;
      expect(bugfix).toEqual(feature.map(i => ({ ...i, file: 'bugfix.md', msg: i.msg.replaceAll('requirements.md', 'bugfix.md') })));
      expect(bugfix.every(i => i.file === 'bugfix.md')).toBe(true);
    }
    expect(total).toBeGreaterThan(5); // the generated texts do exercise the requirements rules
  });

  it('every requirements finding of a feature spec names requirements.md', () => {
    for (const text of texts) {
      const issues = lintSpec(specWith('feature', 'requirements', text), 'requirements');
      expect(issues.every(i => i.file === 'requirements.md')).toBe(true);
      expect(issues.some(i => i.msg.includes('bugfix.md'))).toBe(false);
    }
  });

  it('unstaged lint reports the same missing error as staged lint, outside the brief phase', () => {
    const phases: Phase[] = ['requirements', 'design', 'tasks', 'execute', 'done'];
    const cases: Array<[string, string | undefined, { other?: boolean }]> = [['absent', undefined, {}], ['empty', '', {}], ['other name', readFileSync(join(fixturesDir, 'requirements.md'), 'utf8'), { other: true }]];
    const missing = (issues: LintIssue[]) => issues.filter(i => i.rule === 'spec/missing' && (i.file === 'requirements.md' || i.file === 'bugfix.md'));
    for (const kind of ['feature', 'bugfix'] as const) for (const phase of phases) for (const [, text, opts] of cases) {
      const spec = specWith(kind, phase, text, opts);
      const staged = missing(lintSpec(spec, 'requirements'));
      expect(staged).toEqual([{ level: 'error', rule: 'spec/missing', file: FILE[kind], msg: `${FILE[kind]} does not exist` }]);
      expect(missing(lintSpec(spec))).toEqual(staged);
      expect(lintSpec(spec).some(i => i.file === OTHER[kind])).toBe(false);
    }
  });

  it('the brief phase reports no missing requirements file unless the stage is named', () => {
    for (const kind of ['feature', 'bugfix'] as const) {
      const spec = specWith(kind, 'brief', undefined);
      expect(lintSpec(spec).some(i => i.rule === 'spec/missing')).toBe(false);
      expect(lintSpec(spec, 'requirements')).toContainEqual({ level: 'error', rule: 'spec/missing', file: FILE[kind], msg: `${FILE[kind]} does not exist` });
    }
  });

  it('design and tasks keep their own file names when missing', () => {
    const spec = specWith('bugfix', 'design', readFileSync(join(fixturesDir, 'requirements.md'), 'utf8'));
    expect(lintSpec(spec, 'design')).toContainEqual({ level: 'error', rule: 'spec/missing', file: 'design.md', msg: 'design.md does not exist' });
    expect(lintSpec(spec, 'tasks')).toContainEqual({ level: 'error', rule: 'spec/missing', file: 'tasks.md', msg: 'tasks.md does not exist' });
  });
});
