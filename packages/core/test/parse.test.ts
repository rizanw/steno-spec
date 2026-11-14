import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseRequirements, parseDesign, parseTasks, nextTask, setTaskDone, lintRequirements, lintDesign, lintTasks, normalizeKiroRequirements, normalizeKiroTasks, normTaskId, normReqId, kindOf } from '../src/index.js';

const fx = (f: string) => readFileSync(join(import.meta.dirname, 'fixtures', f), 'utf8');

describe('ids', () => {
  it('normalises', () => {
    expect(normTaskId('1.1')).toBe('T1.1'); expect(normTaskId('T2')).toBe('T2');
    expect(normReqId('1.2')).toBe('R1.2'); expect(normReqId('R3')).toBe('R3');
    expect(kindOf('R1.2')).toBe('criterion'); expect(kindOf('D-auth')).toBe('design'); expect(kindOf('T1')).toBe('task');
  });
});

describe('requirements', () => {
  const doc = parseRequirements(fx('requirements.md'));
  it('parses steno headings, stories and criteria', () => {
    expect(doc.title).toBe('Requirements — login');
    expect(doc.requirements.map(r => r.id)).toEqual(['R1', 'R2']);
    expect(doc.requirements[0].story).toMatch(/^As a user/);
    expect(doc.requirements[0].criteria.map(c => c.id)).toEqual(['R1.1', 'R1.2', 'R1.3']);
    expect(doc.requirements[0].endLine).toBeLessThan(doc.requirements[1].line);
  });
  it('parses Kiro headings too', () => {
    const k = parseRequirements(fx('kiro-requirements.md'));
    expect(k.requirements[0].id).toBe('R1');
    expect(k.requirements[0].title).toBe('Login');
    expect(k.requirements[0].criteria).toHaveLength(1);
  });
  it('lints EARS', () => {
    const rules = lintRequirements(doc).map(i => `${i.id}:${i.rule}`);
    expect(rules).toContain('R1.3:ears/pattern');
    expect(rules).toContain('R1.3:ears/vague');
    expect(rules).toContain('R2.1:ears/split');
    expect(rules.filter(r => r.endsWith('ears/shall'))).toHaveLength(0);
  });
  it('flags a vague word on its own, before a space, comma or full stop, and not inside another word', () => {
    const vague = (text: string) => lintRequirements(parseRequirements(
      `# Requirements\n\n## Requirements\n\n### Requirement 1: X\n\n**User Story:** As a user, I want x, so that y.\n\n#### Acceptance Criteria\n\n1. ${text}\n`,
    )).find(i => i.rule === 'ears/vague')?.msg;
    expect(vague('WHEN asked, THE system SHALL answer fast, Quickly and as needed.')).toBe('vague wording: fast, quickly, as needed — make it testable');
    expect(vague('WHEN asked, THE system SHALL serve breakfast and fastest routes.')).toBeUndefined();
  });
});

describe('design', () => {
  const doc = parseDesign(fx('design.md'));
  it('parses ids, implicit ids, satisfies and bodies', () => {
    const ids = doc.sections.map(s => s.id);
    expect(ids).toEqual(['D-overview', 'D-arch', 'D-components-and-interfaces', 'D-auth', 'D-bad']);
    const auth = doc.sections.find(s => s.id === 'D-auth')!;
    expect(auth.satisfies).toEqual(['R1.1', 'R1.2']);
    expect(auth.body).toContain('line c');
    expect(auth.body).not.toContain('Missing ref');
  });
  it('lints coverage and unknown refs', () => {
    const issues = lintDesign(doc, parseRequirements(fx('requirements.md')));
    expect(issues.map(i => i.rule)).toContain('design/unknown-req');
    expect(issues.find(i => i.rule === 'design/uncovered-req')?.id).toBe('R2');
  });
});

describe('tasks', () => {
  it('parses tree, footers, optional, kiro refs', () => {
    const doc = parseTasks(fx('tasks.md'));
    expect(doc.tasks.map(t => t.id)).toEqual(['T1', 'T1.1', 'T1.2', 'T2', 'T2.1', 'T3']);
    const t11 = doc.tasks[1];
    expect(t11.requirements).toEqual(['R1.1']); expect(t11.design).toEqual(['D-auth']); expect(t11.parent).toBe('T1');
    expect(doc.tasks[2].optional).toBe(true);
    expect(doc.tasks[4].requirements).toEqual(['R1.2']);
    expect(doc.tasks[0].children).toEqual(['T1.1', 'T1.2']);
  });
  it('next skips optional and done', () => {
    const doc = parseTasks(fx('tasks.md'));
    expect(nextTask(doc)!.id).toBe('T1.1');
    const raw = setTaskDone(doc, 'T1.1');
    const again = parseTasks(raw);
    expect(again.tasks[1].done).toBe(true);
    expect(again.tasks[0].done).toBe(false);          // T1.2 optional still open
    expect(nextTask(again)!.id).toBe('T3');
    expect(nextTask(again, true)!.id).toBe('T1.2');
    const raw2 = setTaskDone(again, 'T1.2');
    expect(parseTasks(raw2).tasks[0].done).toBe(true); // parent cascades
  });
  it('lints footers and coverage', () => {
    const issues = lintTasks(parseTasks(fx('tasks.md')), parseRequirements(fx('requirements.md')));
    expect(issues.find(i => i.rule === 'tasks/no-req')?.id).toBe('T3');
    expect(issues.find(i => i.rule === 'tasks/uncovered-req')?.id).toBe('R2');
  });
  it('lints orphan tasks and unknown requirement, criterion and design references', () => {
    const doc = parseTasks('# Tasks\n\n- [ ] 1. Top\n  - [ ] 1.1 Good\n    - _Requirements: R1, R1.1_ _Design: D-auth_\n'
      + '  - [ ] 1.2 Bad\n    - _Requirements: R9, R1.9_ _Design: D-none_\n  - [ ] 3.1 Orphan\n    - _Requirements: R1_\n');
    const issues = lintTasks(doc, parseRequirements(fx('requirements.md')), parseDesign(fx('design.md')));
    const of = (rule: string) => issues.filter(i => i.rule === rule).map(i => [i.id, i.msg]);
    expect(of('tasks/orphan')).toEqual([['T3.1', 'parent T3 does not exist']]);
    expect(of('tasks/unknown-req')).toEqual([['T1.2', 'references unknown R9'], ['T1.2', 'references unknown R1.9']]);
    expect(of('tasks/unknown-design')).toEqual([['T1.2', 'references unknown design section D-none']]);
  });
  it('setTaskDone keeps each line\'s own ending in a mixed document', () => {
    const raw = '# Tasks\r\n\n- [ ] 1. Top\r\n  - [ ] 1.1 A\n  - [ ] 1.2 B\r\n- [ ] 2. Other\n';
    const out = setTaskDone(parseTasks(setTaskDone(parseTasks(raw), 'T1.1')), 'T1.2');
    expect(out).toBe('# Tasks\r\n\n- [x] 1. Top\r\n  - [x] 1.1 A\n  - [x] 1.2 B\r\n- [ ] 2. Other\n');
  });
  it('setTaskDone leaves the given document unchanged', () => {
    const doc = parseTasks(fx('tasks.md'));
    const before = structuredClone(doc);
    setTaskDone(doc, 'T1.1');
    setTaskDone(doc, 'T1', false);
    expect(doc).toEqual(before);
  });
});

describe('kiro import', () => {
  it('normalises headings and refs', () => {
    expect(normalizeKiroRequirements('### Requirement 2: Foo\n#### Acceptance Criteria')).toBe('## R2 Foo\n### Acceptance Criteria');
    expect(normalizeKiroTasks('- _Requirements: 1.1, 2_')).toBe('- _Requirements: R1.1, R2_');
  });
});

describe('kiro-shaped requirements with glossary', () => {
  const raw = `# Requirements Document\n\n## Introduction\n\nToday it is slow.\n\nTomorrow it is not.\n\n## Glossary\n\n- **Wallet_Picker**: the dropdown\n- **Personal_Mode**: one member\n\n## Requirements\n\n### Requirement 1: Pick\n\n**User Story:** As a u, I want p, so that b.\n\n#### Acceptance Criteria\n\n1. WHEN x, THE Wallet_Picker SHALL show owners.\n2. WHERE Personal_Mode, THE Wallet_Picker SHALL hide owners.\n3. THE Accounts_View SHALL stay.\n`;
  const doc = parseRequirements(raw);
  it('parses intro, glossary and criteria', () => {
    expect(doc.intro).toBe('Today it is slow.\n\nTomorrow it is not.');
    expect(doc.glossary.map(g => g.term)).toEqual(['Wallet_Picker', 'Personal_Mode']);
    expect(doc.requirements[0].criteria).toHaveLength(3);
    expect(doc.requirements[0].title).toBe('Pick');
  });
  it('flags terms missing from the glossary', () => {
    const i = lintRequirements(doc).filter(x => x.rule === 'ears/undefined-term');
    expect(i.map(x => x.id)).toEqual(['R1.3']);
    expect(i[0].msg).toContain('Accounts_View');
  });
});

describe('lint: length and implementation leakage', () => {
  const raw = `# Requirements Document\n\n## Requirements\n\n### Requirement 1: X\n\n**User Story:** As a u, I want p, so that b.\n\n#### Acceptance Criteria\n\n1. WHEN the user picks an owner, THE Wallet_Picker SHALL reset \`walletFilter\` to "ALL" and re-render \`src/components/picker.tsx\`.\n2. WHEN a wallet's \`created_by\` is null, THE Wallet_Picker SHALL show it under Shared.\n3. THE Wallet_Picker SHALL ${'word '.repeat(45)}SHALL.\n`;
  const issues = lintRequirements(parseRequirements(raw));
  it('flags paths and camelCase identifiers but not data field names', () => {
    const impl = issues.filter(i => i.rule === 'ears/implementation');
    expect(impl.map(i => i.id)).toEqual(['R1.1']);
    expect(impl[0].msg).toContain('walletFilter');
    expect(impl[0].msg).toContain('picker.tsx');
  });
  it('flags over-long criteria', () => {
    expect(issues.filter(i => i.rule === 'ears/too-long').map(i => i.id)).toEqual(['R1.3']);
  });
});

describe('lint: bare implementation identifiers', () => {
  const raw = `# Requirements Document\n\n## Glossary\n\n- **Wallet_Picker**: x\n\n## Requirements\n\n### Requirement 1: X\n\n**User Story:** As a u, I want p, so that b.\n\n#### Acceptance Criteria\n\n1. WHEN the user picks an owner, THE Wallet_Picker SHALL reset walletFilter and re-render src/components/picker.tsx.\n2. WHEN the user picks an owner, THE Wallet_Picker SHALL call refresh() first.\n3. WHEN a wallet has no owner, THE Wallet_Picker SHALL list it under Shared, in English and Bahasa Indonesia.\n`;
  const impl = lintRequirements(parseRequirements(raw)).filter(i => i.rule === 'ears/implementation');
  it('catches camelCase, paths and calls without backticks, but not prose or Term_Names', () => {
    expect(impl.map(i => i.id)).toEqual(['R1.1', 'R1.2']);
    expect(impl[0].msg).toContain('walletFilter');
    expect(impl[0].msg).toContain('src/components/picker.tsx');
    expect(impl[1].msg).toContain('refresh()');
  });
});

describe('design: validates alias, over-tagging, overlap, overview footer', () => {
  const reqs = parseRequirements(`# R\n\n## Requirements\n\n### Requirement 1: A\n\n**User Story:** As a u, I want p, so that b.\n\n#### Acceptance Criteria\n\n1. THE X SHALL a.\n2. THE X SHALL b.\n3. THE X SHALL c.\n4. THE X SHALL d.\n5. THE X SHALL e.\n6. THE X SHALL f.\n7. THE X SHALL g.\n`);
  const design = parseDesign(`# D\n\n## Overview\n_Satisfies: 1.1_\nx\n\n## Components\n### Big {#D-big}\n_Satisfies: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_\nx\n\n### B {#D-b}\n_Satisfies: 1.1_\nx\n\n### C {#D-c}\n_Satisfies: 1.1_\nx\n\n## Correctness Properties\n### Property 1: p {#D-prop-1}\n_Validates: 1.2_\nx\n`);
  const issues = lintDesign(design, reqs);
  it('reads _Validates:_ as traceability', () => {
    expect(design.sections.find(s => s.id === 'D-prop-1')!.satisfies).toEqual(['R1.2']);
  });
  it('warns on over-tagged, overlap and overview footers', () => {
    expect(issues.find(i => i.rule === 'design/over-tagged')?.id).toBe('D-big');
    expect(issues.find(i => i.rule === 'design/overlap')?.id).toBe('R1.1');
    expect(issues.find(i => i.rule === 'design/footer-on-overview')?.id).toBe('D-overview');
  });
});

describe('checkpoints', () => {
  const raw = `# T\n\n- [ ] 1. A\n  - [ ] 1.1 a\n    - _Requirements: 1.1_\n  - [ ] 1.2 b\n    - _Requirements: 1.2_\n- [ ] 2. Checkpoint — A end to end\n- [ ] 3. B\n  - [ ] 3.1 c\n    - _Requirements: 2.1_\n  - [ ] 3.2 Checkpoint — B\n- [ ] 4. Final checkpoint\n`;
  const doc = parseTasks(raw);
  it('parses the flag and exempts checkpoints from the footer rule', () => {
    expect(doc.tasks.filter(t => t.checkpoint).map(t => t.id)).toEqual(['T2', 'T3.2', 'T4']);
    expect(lintTasks(doc).filter(i => i.rule === 'tasks/no-req')).toHaveLength(0);
  });
});
