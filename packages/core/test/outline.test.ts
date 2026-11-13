import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { outlineOf, itemTitle, type OutlineItem } from '../src/index.js';

const strip = (items: OutlineItem[]): unknown[] => items.map(i => [i.id ?? i.title, i.line, i.endLine, ...(i.children.length ? [strip(i.children)] : [])]);

describe('outlineOf', () => {
  it('lists requirements with nested criteria and their ranges', () => {
    const text = '# R\n\n## R1 Login\n\n**User Story:** x\n\n### Acceptance Criteria\n1. WHEN a THE system SHALL b.\n   more\n2. THE system SHALL c.\n\n## R2 Logout\n1. no AC heading\n';
    const items = outlineOf('requirements', text);
    expect(strip(items)).toEqual([['R1', 3, 11, [['R1.1', 8, 9], ['R1.2', 10, 11]]], ['R2', 12, 14]]);
    expect(items[0]).toMatchObject({ kind: 'requirement', title: 'Login' });
    expect(items[0].children[0]).toMatchObject({ kind: 'criterion', title: 'WHEN a THE system SHALL b.' });
  });

  it('adds the free level-2 headings of a bugfix document', () => {
    const text = '# Bug\n\n## Current Behavior\nx\n\n## Requirements\n\n### Requirement 1: Fix\n\n#### Acceptance Criteria\n1. THE system SHALL y.\n\n## Notes\nz\n';
    const items = outlineOf('bugfix', text);
    expect(items.map(i => [i.kind, i.title, i.line, i.endLine])).toEqual([
      ['heading', 'Current Behavior', 3, 5], ['requirement', 'Fix', 8, 12], ['heading', 'Notes', 13, 15],
    ]);
  });

  it('nests design sections of level 2 to 4 with their ids', () => {
    const text = '# D\n\n## Overview\n\n## Parts\n### Auth {#D-auth}\n#### Tokens\n### DB\n##### deep\n## End\n';
    const items = outlineOf('design', text);
    expect(strip(items)).toEqual([
      ['D-overview', 3, 4], ['D-parts', 5, 9, [['D-auth', 6, 7, [['D-tokens', 7, 7]]], ['D-db', 8, 9]]], ['D-end', 10, 11],
    ]);
    expect(items[1].children[0]).toMatchObject({ kind: 'section', title: 'Auth' });
  });

  it('nests a subtask under its parent only when every task between is nested too', () => {
    const text = '# T\n\n- [ ] 1. A\n  - [ ] 1.1 A1\n- [ ] 2. B\n  - [ ] 1.2 stray\n- [ ] 3.1 orphan\n- [x] 3. C\n';
    const items = outlineOf('tasks', text);
    expect(strip(items)).toEqual([['T1', 3, 4, [['T1.1', 4, 4]]], ['T2', 5, 5], ['T1.2', 6, 6], ['T3.1', 7, 7], ['T3', 8, 9]]);
    expect(items[0]).toMatchObject({ kind: 'task', title: 'A' });
  });

  it('lists level-2 and level-3 headings of a brief or steering file, skipping fenced code', () => {
    const text = '---\ninclusion: always\n---\n# S\n## One\n### Sub\n```\n## not a heading\n```\n## Two\n#### deep\n';
    expect(strip(outlineOf('steering', text))).toEqual([['One', 5, 9, [['Sub', 6, 9]]], ['Two', 10, 12]]);
    expect(outlineOf('brief', '# B\n## Goal\n')[0]).toMatchObject({ kind: 'heading', title: 'Goal', line: 2 });
  });
});

describe('itemTitle', () => {
  it('keeps a title, else uses the first line cut to 79 characters and an ellipsis', () => {
    expect(itemTitle('T', 'x')).toBe('T');
    expect(itemTitle('', 'first\nsecond')).toBe('first');
    expect(itemTitle('', 'a'.repeat(81))).toBe('a'.repeat(79) + '…');
    expect(itemTitle('', 'a'.repeat(80))).toBe('a'.repeat(80));
  });

  it('a title has at most 80 characters and follows the first line', () => {
    fc.assert(fc.property(fc.string({ unit: 'grapheme', maxLength: 200 }), fc.string({ maxLength: 40 }), (line, rest) => {
      const first = line.split(/\r?\n/)[0];
      const t = itemTitle('', `${first}\n${rest}`);
      const chars = Array.from(first);
      expect(Array.from(t).length).toBeLessThanOrEqual(80);
      if (chars.length <= 80) expect(t).toBe(first);
      else expect(t).toBe(chars.slice(0, 79).join('') + '…');
    }));
  });
});

describe('outline ranges nest', () => {
  const check = (items: OutlineItem[], parent?: OutlineItem) => {
    let prev: OutlineItem | undefined;
    for (const i of items) {
      expect(i.line).toBeLessThanOrEqual(i.endLine);
      if (parent) { expect(i.line).toBeGreaterThanOrEqual(parent.line); expect(i.endLine).toBeLessThanOrEqual(parent.endLine); }
      if (prev) expect(i.line).toBeGreaterThan(prev.endLine);
      prev = i;
      check(i.children, i);
    }
  };
  const filler = fc.constantFrom('', 'text', '_Requirements: R1_', '### Note', '#### x');

  it('holds for tasks documents with tasks in any order', () => {
    const num = fc.array(fc.integer({ min: 1, max: 3 }), { minLength: 1, maxLength: 3 }).map(a => a.join('.'));
    const task = fc.tuple(num, fc.boolean(), fc.integer({ min: 0, max: 2 })).map(([n, d, ind]) => `${'  '.repeat(ind)}- [${d ? 'x' : ' '}] ${n}. T${n}`);
    fc.assert(fc.property(fc.array(fc.oneof(task, filler), { maxLength: 25 }), lines => {
      check(outlineOf('tasks', ['# Tasks', ...lines].join('\n')));
    }));
  });

  it('holds for requirements and bugfix documents', () => {
    const head = fc.oneof(fc.integer({ min: 1, max: 9 }).map(n => `## R${n} Title`), fc.integer({ min: 1, max: 9 }).map(n => `### Requirement ${n}: T`), fc.constantFrom('## Notes', '## Requirements', '#### Acceptance Criteria', '### Acceptance Criteria'));
    const crit = fc.integer({ min: 1, max: 5 }).map(n => `${n}. THE system SHALL x.`);
    fc.assert(fc.property(fc.array(fc.oneof(head, crit, filler), { maxLength: 30 }), lines => {
      const text = ['# Requirements', ...lines].join('\n');
      check(outlineOf('requirements', text));
      check(outlineOf('bugfix', text));
    }));
  });
});
