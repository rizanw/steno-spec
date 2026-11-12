import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  applyTaskChange, applyApprove, defaultWriter, loadProject, parseTasks, parseState, setTaskDone, StenoError, type Writer,
} from '../src/index.js';

const STATE = (name: string, phase = 'execute', approvals = 'approvals: {}\n') =>
  `name: ${name}\nkind: feature\nmode: gated\nphase: ${phase}\ncreated: 2026-01-01\n${approvals}`;
const REQS = '# Requirements\n\n## Requirements\n\n### Requirement 1: A\n\n**User Story:** As a u, I want a, so that b.\n\n#### Acceptance Criteria\n1. THE system SHALL a.\n';
const BAD_REQS = REQS.replace('THE system SHALL a.', 'THE system does a.');
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const today = new Date().toISOString().slice(0, 10);

function project(files: Record<string, string | Buffer>) {
  const root = mkdtempSync(join(tmpdir(), 'steno-change-'));
  mkdirSync(join(root, '.steno', 'specs'), { recursive: true });
  for (const [rel, text] of Object.entries(files)) {
    const p = join(root, rel);
    mkdirSync(join(p, '..'), { recursive: true });
    writeFileSync(p, text);
  }
  return root;
}
const at = (root: string, f: string) => join(root, '.steno', 'specs', 'a', f);
const bytes = (root: string, f: string) => readFileSync(at(root, f));
/** A writer that throws on call number `n` and writes through otherwise. */
const failOn = (n: number): Writer => { let i = 0; return (p, b) => { if (++i === n) throw new Error('disk full'); defaultWriter(p, b); }; };
const thrown = (fn: () => unknown) => { try { fn(); } catch (e) { return e as StenoError; } throw new Error('did not throw'); };

describe('applyTaskChange', () => {
  it('ticks the task and its parent and moves the Phase to done (R5.1)', () => {
    const root = project({ '.steno/specs/a/spec.yaml': STATE('a'), '.steno/specs/a/tasks.md': '# Tasks\n\n- [ ] 1. Top\n  - [ ] 1.1 Leaf\n' });
    const r = applyTaskChange(loadProject(root), 'a', 'T1.1', true);
    expect(r).toEqual({ protocolVersion: 1, spec: 'a', phase: 'done', task: 'T1.1', done: true });
    expect(bytes(root, 'tasks.md').toString()).toBe('# Tasks\n\n- [x] 1. Top\n  - [x] 1.1 Leaf\n');
    expect(bytes(root, 'spec.yaml').toString()).toMatch(/phase: done/);
    const back = applyTaskChange(loadProject(root), 'a', 'T1.1', false);
    expect(back).toMatchObject({ phase: 'execute', done: false });
    expect(bytes(root, 'tasks.md').toString()).toBe('# Tasks\n\n- [ ] 1. Top\n  - [ ] 1.1 Leaf\n');
  });

  it('writes only tasks.md when the Phase does not move', () => {
    const root = project({ '.steno/specs/a/spec.yaml': STATE('a'), '.steno/specs/a/tasks.md': '- [ ] 1. A\n- [ ] 2. B\n' });
    const before = bytes(root, 'spec.yaml');
    applyTaskChange(loadProject(root), 'a', 'T1', true);
    expect(bytes(root, 'spec.yaml')).toEqual(before);
  });

  it('keeps the byte order mark and each line ending (R5.14)', () => {
    const text = '# Tasks\r\n\n- [ ] 1. A\r\n- [ ] 2. B\n';
    const root = project({ '.steno/specs/a/spec.yaml': STATE('a'), '.steno/specs/a/tasks.md': Buffer.concat([BOM, Buffer.from(text)]) });
    applyTaskChange(loadProject(root), 'a', 'T1', true);
    expect(bytes(root, 'tasks.md')).toEqual(Buffer.concat([BOM, Buffer.from('# Tasks\r\n\n- [x] 1. A\r\n- [ ] 2. B\n')]));
  });

  it('restores every file when the second write fails (R5.11)', () => {
    const text = '- [ ] 1. A\r\n';
    const root = project({ '.steno/specs/a/spec.yaml': STATE('a'), '.steno/specs/a/tasks.md': Buffer.concat([BOM, Buffer.from(text)]) });
    const before = { tasks: bytes(root, 'tasks.md'), state: bytes(root, 'spec.yaml') };
    const e = thrown(() => applyTaskChange(loadProject(root), 'a', 'T1', true, { write: failOn(2) }));
    expect(e).toBeInstanceOf(StenoError);
    expect(e).toMatchObject({ code: 'failed', message: expect.stringMatching(/disk full/) });
    expect(bytes(root, 'tasks.md')).toEqual(before.tasks);
    expect(bytes(root, 'spec.yaml')).toEqual(before.state);
  });

  it('writes the derived record in the same step, and removes it when the change fails (R6.3)', () => {
    const files = { '.steno/specs/a/requirements.md': REQS, '.steno/specs/a/design.md': '# D\n', '.steno/specs/a/tasks.md': '- [ ] 1. A\n- [ ] 2. B\n' };
    const failing = project(files);
    expect(() => applyTaskChange(loadProject(failing), 'a', 'T1', true, { write: failOn(2) })).toThrow(StenoError);
    expect(existsSync(at(failing, 'spec.yaml'))).toBe(false);
    expect(bytes(failing, 'tasks.md').toString()).toBe(files['.steno/specs/a/tasks.md']);

    const root = project(files);
    applyTaskChange(loadProject(root), 'a', 'T1', true);
    const st = parseState(bytes(root, 'spec.yaml').toString());
    expect(st).toMatchObject({ state: { name: 'a', phase: 'execute', created: today, approvals: { requirements: today, design: today, tasks: today } } });
  });
});

describe('applyApprove', () => {
  it('records today\'s date and moves on when lint passes (R5.2)', () => {
    const root = project({ '.steno/specs/a/spec.yaml': STATE('a', 'requirements'), '.steno/specs/a/requirements.md': REQS });
    expect(applyApprove(loadProject(root), 'a', 'requirements')).toEqual({ protocolVersion: 1, spec: 'a', phase: 'design', approved: 'requirements' });
    expect(parseState(bytes(root, 'spec.yaml').toString())).toMatchObject({ state: { phase: 'design', approvals: { requirements: today } } });
  });

  it('is blocked by lint errors with the error findings and writes nothing (R5.3)', () => {
    const root = project({ '.steno/specs/a/spec.yaml': STATE('a', 'requirements'), '.steno/specs/a/requirements.md': BAD_REQS });
    const before = bytes(root, 'spec.yaml');
    const e = thrown(() => applyApprove(loadProject(root), 'a', 'requirements'));
    expect(e).toMatchObject({ code: 'lint-blocked', spec: 'a' });
    expect(e.findings?.length).toBeGreaterThan(0);
    expect(e.findings?.every(f => f.severity === 'error')).toBe(true);
    expect(e.findings).toContainEqual(expect.objectContaining({ file: '.steno/specs/a/requirements.md', rule: 'ears/shall' }));
    expect(bytes(root, 'spec.yaml')).toEqual(before);
  });

  it('approves despite errors with force and says so', () => {
    const root = project({ '.steno/specs/a/spec.yaml': STATE('a', 'requirements'), '.steno/specs/a/requirements.md': BAD_REQS });
    expect(applyApprove(loadProject(root), 'a', 'requirements', { force: true })).toMatchObject({ phase: 'design', approved: 'requirements', forced: true });
  });

  it('moves brief to requirements without lint (R5.7)', () => {
    const root = project({ '.steno/specs/a/spec.yaml': STATE('a', 'brief'), '.steno/specs/a/brief.md': '<placeholder>\n' });
    expect(applyApprove(loadProject(root), 'a', 'brief')).toEqual({ protocolVersion: 1, spec: 'a', phase: 'requirements', approved: 'brief' });
    expect(parseState(bytes(root, 'spec.yaml').toString())).toMatchObject({ state: { phase: 'requirements', approvals: {} } });
  });

  it('leaves spec.yaml unchanged when its write fails', () => {
    const root = project({ '.steno/specs/a/spec.yaml': STATE('a', 'brief') });
    const before = bytes(root, 'spec.yaml');
    expect(thrown(() => applyApprove(loadProject(root), 'a', 'brief', { write: failOn(1) }))).toMatchObject({ code: 'failed' });
    expect(bytes(root, 'spec.yaml')).toEqual(before);
  });
});

// --- properties --------------------------------------------------------------------------------
const EOL = fc.constantFrom('\n', '\r\n');
const filler = fc.constantFrom('', '# Tasks', 'text', '  - _Requirements: R1_', '## Notes');
/** A tasks document of nested tasks (numbers from the tree), filler lines, and any mix of line endings. */
const tasksDoc = (allOpen: boolean) => fc.array(fc.tuple(fc.integer({ min: 0, max: 2 }), fc.boolean(), fc.array(filler, { maxLength: 2 })), { minLength: 1, maxLength: 12 })
  .chain(items => fc.tuple(fc.constant(items), fc.array(EOL, { minLength: 60, maxLength: 60 })))
  .map(([items, eols]) => {
    const counters: number[] = [];
    const lines: string[] = [];
    for (const [rawDepth, done, extra] of items) {
      const depth = Math.min(rawDepth, counters.length);
      counters.length = depth + 1;
      counters[depth] = (counters[depth] ?? 0) + 1;
      lines.push(`${'  '.repeat(depth)}- [${done && !allOpen ? 'x' : ' '}] ${counters.join('.')}. Task`, ...extra);
    }
    return lines.map((l, i) => l + eols[i % eols.length]).join('');
  });

describe('Property 1: a task change touches only checkbox characters (D-prop-1)', () => {
  it('differs from the input only between the brackets of task lines', () => {
    fc.assert(fc.property(tasksDoc(false), fc.nat(), fc.boolean(), (raw, pick, done) => {
      const doc = parseTasks(raw);
      const id = doc.tasks[pick % doc.tasks.length].id;
      const out = setTaskDone(doc, id, done);
      expect(out.length).toBe(raw.length);
      const lines = raw.split(/(?<=\n)/), outLines = out.split(/(?<=\n)/);
      expect(outLines.length).toBe(lines.length);
      lines.forEach((l, i) => {
        if (l === outLines[i]) return;
        const at = l.indexOf('[') + 1;
        expect(/^\s*- \[/.test(l)).toBe(true);
        expect(outLines[i].slice(0, at) + outLines[i].slice(at + 1)).toBe(l.slice(0, at) + l.slice(at + 1));
      });
    }));
  });

  it('holds for the written bytes, the byte order mark included', () => {
    fc.assert(fc.property(tasksDoc(false), fc.nat(), (raw, pick) => {
      const root = project({ '.steno/specs/a/spec.yaml': STATE('a'), '.steno/specs/a/tasks.md': Buffer.concat([BOM, Buffer.from(raw)]) });
      const doc = parseTasks(raw);
      const id = doc.tasks[pick % doc.tasks.length].id;
      applyTaskChange(loadProject(root), 'a', id, true);
      expect(bytes(root, 'tasks.md')).toEqual(Buffer.concat([BOM, Buffer.from(setTaskDone(doc, id, true))]));
    }), { numRuns: 25 });
  });
});

describe('Property 2: done then reopen restores the document (D-prop-2)', () => {
  it('returns the original text when no parent was already checked', () => {
    fc.assert(fc.property(tasksDoc(true), fc.nat(), (raw, pick) => {
      const doc = parseTasks(raw);
      const id = doc.tasks[pick % doc.tasks.length].id;
      const back = setTaskDone(parseTasks(setTaskDone(doc, id, true)), id, false);
      expect(back).toBe(raw);
    }));
  });
});
