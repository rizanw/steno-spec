import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSpec, loadSpec, buildCtx, estimateTokens, testFilesFor, loadSteering } from '../src/index.js';

function project() {
  const root = mkdtempSync(join(tmpdir(), 'steno-'));
  mkdirSync(join(root, '.steno', 'steering'), { recursive: true });
  mkdirSync(join(root, 'src', 'auth'), { recursive: true });
  writeFileSync(join(root, 'src', 'auth', 'service.ts'), '// real file');
  writeFileSync(join(root, '.steno', 'steering', 'tech.md'), '---\ninclusion: fileMatch\nfileMatchPattern: "src/auth/**"\n---\nUse argon2 for hashing.');
  writeFileSync(join(root, '.steno', 'steering', 'ui.md'), '---\ninclusion: fileMatch\nfileMatchPattern: "src/ui/**"\n---\nNever shown.');
  const { dir } = createSpec(root, 'login', { quick: true });
  writeFileSync(join(dir, 'requirements.md'), `# Requirements — login\n\n## R1 Login\n**User Story:** As a user, I want in, so that x.\n\n### Acceptance Criteria\n1. WHEN valid THEN the system SHALL create a session.\n2. IF wrong THEN the system SHALL refuse.\n\n## R2 Other\n**User Story:** As a user, I want y, so that z.\n\n### Acceptance Criteria\n1. THE system SHALL log.\n`);
  const big = Array.from({ length: 200 }, (_, i) => `design line ${i} with enough words to cost tokens`).join('\n');
  writeFileSync(join(dir, 'design.md'), `# Design\n\n## Overview\nx\n\n## Components\n### AuthService {#D-auth}\n_Satisfies: R1.1, R1.2_\nLives in \`src/auth/service.ts\`.\n${big}\n\n### Logger {#D-log}\n_Satisfies: R2.1_\nunrelated\n`);
  writeFileSync(join(dir, 'tasks.md'), `# Tasks\n\n- [ ] 1. Auth\n  - [ ] 1.1 Session store\n    - _Requirements: R1.1_ _Design: D-auth_\n  - [ ] 1.2 Infer design from reqs\n    - _Requirements: R1.2_\n`);
  return { root, dir };
}

describe('ctx packet', () => {
  it('slices only referenced criteria, design, files and matching steering', () => {
    const { root, dir } = project();
    const p = buildCtx(loadSpec(dir), root, 'T1.1', 100000, { steering: loadSteering(root) });
    expect(p.text).toContain('R1.1 WHEN valid');
    expect(p.text).not.toContain('R1.2 IF wrong');
    expect(p.text).not.toContain('R2');
    expect(p.text).toContain('{#D-auth}');
    expect(p.text).not.toContain('Logger');
    expect(p.files).toEqual(['src/auth/service.ts']);
    expect(p.text).toContain('argon2');
    expect(p.text).not.toContain('Never shown');
    expect(p.text).toContain('steno done T1.1');
  });
  it('infers design sections from requirement refs when the task has none', () => {
    const { root, dir } = project();
    const p = buildCtx(loadSpec(dir), root, 'T1.2', 100000);
    expect(p.text).toContain('{#D-auth}');
    expect(p.text).toContain('R1.2 IF wrong');
  });
  it('respects the token budget with pointers', () => {
    const { root, dir } = project();
    const p = buildCtx(loadSpec(dir), root, 'T1.1', 400);
    expect(p.tokens).toBeLessThanOrEqual(400);
    expect(estimateTokens(p.text)).toBe(p.tokens);
    expect(p.trimmed).toContain('D-auth');
    expect(p.text).toContain('steno show D-auth');
  });
});

describe('ctx packet: tiers, scoped files, term boundaries', () => {
  function project2() {
    const root = mkdtempSync(join(tmpdir(), 'steno-'));
    mkdirSync(join(root, '.steno', 'specs'), { recursive: true });
    mkdirSync(join(root, 'src', 'a'), { recursive: true }); mkdirSync(join(root, 'src', 'b'), { recursive: true });
    writeFileSync(join(root, 'src', 'a', 'main.ts'), ''); writeFileSync(join(root, 'src', 'b', 'other.ts'), '');
    const { dir } = createSpec(root, 'f', { quick: true });
    writeFileSync(join(dir, 'requirements.md'), `# R\n\n## Glossary\n\n- **Wallet**: a wallet\n- **Wallet_Picker**: the picker\n- **Unused_Term**: never\n\n## Requirements\n\n### Requirement 1: A\n\n**User Story:** As a u, I want p, so that b.\n\n#### Acceptance Criteria\n\n1. WHEN x, THE Wallet_Picker SHALL list.\n2. WHEN y, THE Wallet_Picker SHALL hide.\n`);
    const big = Array.from({ length: 40 }, (_, i) => `- primary rule ${i} with enough words to cost some tokens here`).join('\n');
    writeFileSync(join(dir, 'design.md'), `# D\n\n## Components\n### Main {#D-main}\n_Satisfies: 1.1, 1.2_\nLives in \`src/a/main.ts\`.\n${big}\n\n### Other {#D-other}\n_Satisfies: 1.1_\nLives in \`src/b/other.ts\`.\n\n## Correctness Properties\n### Property 1: p {#D-prop-1}\n_Validates: 1.1_\n- intro line\n- bullet about 1.1 only\n- bullet about 1.2 only\n- bullet about nothing\n`);
    writeFileSync(join(dir, 'tasks.md'), `# T\n\n- [ ] 1. G\n  - [ ] 1.1 Do main\n    - _Requirements: 1.1_ _Design: D-main, D-prop-1_\n`);
    return { root, dir };
  }
  it('protects the primary section, filters secondary bullets, scopes files and terms', () => {
    const { root, dir } = project2();
    const p = buildCtx(loadSpec(dir), root, 'T1.1', 100000);
    expect(p.files).toEqual(['src/a/main.ts']);                 // not other.ts: scoped to the task's sections
    expect(p.text).toContain('Wallet_Picker: the picker');
    expect(p.text).not.toContain('Wallet: a wallet');            // "Wallet" must not match inside Wallet_Picker
    expect(p.text).not.toContain('Unused_Term');
    expect(p.text).toContain('bullet about 1.1 only');
    expect(p.text).not.toContain('bullet about 1.2 only');        // secondary section filtered to the task's criteria
    expect(p.text).toContain('intro line');
  });
  it('trims the secondary section before the primary one', () => {
    const { root, dir } = project2();
    const p = buildCtx(loadSpec(dir), root, 'T1.1', 520);
    expect(p.tokens).toBeLessThanOrEqual(520);
    expect(p.text).toContain('primary rule 10');                  // primary body survives
    expect(p.trimmed).toContain('D-prop-1');
  });
});

describe('ctx packet: checkpoints', () => {
  it('gives a checkpoint the criteria of the tasks it verifies', async () => {
    const { checkpointScope, parseTasks } = await import('../src/index.js');
    const doc = parseTasks(`# T\n\n- [ ] 1. A\n  - [ ] 1.1 a\n    - _Requirements: 1.1_\n  - [ ] 1.2 b\n    - _Requirements: 1.2_\n- [ ] 2. Checkpoint — A\n- [ ] 3. B\n  - [ ] 3.1 c\n    - _Requirements: 2.1_\n  - [ ] 3.2 Checkpoint — B\n- [ ] 4. Final checkpoint\n`);
    const t = (id: string) => doc.tasks.find(x => x.id === id)!;
    expect(checkpointScope(doc.tasks, t('T2')).map(x => x.id)).toEqual(['T1.1', 'T1.2']);
    expect(checkpointScope(doc.tasks, t('T3.2')).map(x => x.id)).toEqual(['T3.1']);
    expect(checkpointScope(doc.tasks, t('T4')).map(x => x.id)).toEqual(['T3.1']);
  });
});

describe('ctx packet: a task with subtasks', () => {
  const group = (tasks: string, id: string, budget = 1500) => {
    const { root, dir } = project();
    writeFileSync(join(dir, 'tasks.md'), `# Tasks\n\n${tasks}`);
    return buildCtx(loadSpec(dir), root, id, budget, { steering: loadSteering(root) });
  };
  const NESTED = [
    '- [ ] 1. Auth', '  - [x] 1.1 Store', '    - _Requirements: R1.1_ _Design: D-auth_', '  - [ ] 1.2 Expiry',
    '    - [ ] 1.2.1 Clock', '    - [ ]* 1.2.2 Metrics', '  - [ ]* 1.3 Extras', '    - [ ] 1.3.1 Banner', '  - [ ] 1.4 Checkpoint — auth', '',
  ].join('\n');

  it('lists every subtask at any depth and starts at the first open one that is not optional', () => {
    const p = group(NESTED, 'T1');
    expect(p.text).toBe([
      '# T1 Auth',
      'Run each open subtask that is not optional, in order: `steno ctx T1.2.1`, implement, verify, `steno done T1.2.1`, then the next. Stop at the first that fails verification.',
      '## Subtasks\n[x] T1.1 Store\n[ ] T1.2.1 Clock\n[ ] T1.2.2 Metrics (optional)\n[ ] T1.3.1 Banner (optional)\n[ ] T1.4 Checkpoint — auth',
      "## When finished\nThe last subtask's `steno done` ticks T1 as well. While an optional subtask is still open, T1 stays open; `steno done T1` closes it on purpose and ticks those subtasks too.",
    ].join('\n\n'));
    expect(p).toMatchObject({ trimmed: [], files: [], budget: 1500, tokens: estimateTokens(p.text) });
  });

  it('carries no requirements, design or steering, and is not cut to a small budget', () => {
    const p = group(NESTED, 'T1', 10);
    expect(p.text).not.toMatch(/## (Requirements|Design|Steering)|part of/);
    expect(p.text).toContain('[ ] T1.4 Checkpoint — auth');
    expect(p).toMatchObject({ trimmed: [], budget: 10 });
  });

  it('gives no run line when every open subtask is optional', () => {
    const p = group('- [ ] 1. Auth\n  - [x] 1.1 Store\n  - [ ]* 1.2 Extras\n', 'T1');
    expect(p.text).not.toContain('Run each');
    expect(p.text).toContain('## Subtasks\n[x] T1.1 Store\n[ ] T1.2 Extras (optional)');
  });

  it('keeps the Verifies packet for a checkpoint with subtasks', () => {
    const p = group('- [ ] 1. Auth\n  - [ ] 1.1 Store\n    - _Requirements: R1.1_\n- [ ] 2. Checkpoint — auth\n  - [ ] 2.1 Run the suite\n', 'T2');
    expect(p.text).toContain('## Verifies\nT1.1 Store');
    expect(p.text).not.toContain('## Subtasks');
  });
});

describe('ctx packet: omitted steering files', () => {
  it('lists an omitted file the packet would include, with its reason, and leaves it out', () => {
    const { root, dir } = project();
    const p = buildCtx(loadSpec(dir), root, 'T1.1', 100000, { steering: loadSteering(root), omit: [{ file: 'tech.md', reason: 'unsaved edits' }] });
    expect(p.text).not.toContain('argon2');
    expect(p.trimmed).toContain('steering/tech.md (unsaved edits)');
  });

  it('does not list an omitted file the packet would not include', () => {
    const { root, dir } = project();
    const p = buildCtx(loadSpec(dir), root, 'T1.1', 100000, { steering: loadSteering(root), omit: [{ file: 'ui.md', reason: 'unsaved edits' }] });
    expect(p.text).toContain('argon2');
    expect(p.trimmed.some(t => t.startsWith('steering/ui.md'))).toBe(false);
  });

  it('always lists an Unreadable file, whose inclusion rule cannot be read', () => {
    const { root, dir } = project();
    const p = buildCtx(loadSpec(dir), root, 'T1.1', 100000, { steering: loadSteering(root), omit: [{ file: 'bad.md', reason: 'bad.md is not UTF-8 text' }] });
    expect(p.text).toContain('argon2');
    expect(p.trimmed).toContain('steering/bad.md (bad.md is not UTF-8 text)');
  });

  it('includes no steering when none is given', () => {
    const { root, dir } = project();
    expect(buildCtx(loadSpec(dir), root, 'T1.1', 100000).text).not.toContain('argon2');
  });
});

describe('ctx packet: test files', () => {
  const tree = (...files: string[]) => {
    const root = mkdtempSync(join(tmpdir(), 'steno-'));
    for (const f of files) { mkdirSync(join(root, f, '..'), { recursive: true }); writeFileSync(join(root, f), ''); }
    return root;
  };

  it('finds the existing test of a source file across common layouts', () => {
    const root = tree('src/links.ts', 'test/links.test.ts', 'src/ui/Button.tsx', 'src/ui/Button.test.tsx', 'src/db/client.ts', 'src/db/__tests__/client.spec.ts',
      'packages/core/src/parse/ears.ts', 'packages/core/test/parse/ears.test.ts', 'pkg/store.go', 'pkg/store_test.go', 'app/models.py', 'tests/test_models.py', 'src/lonely.ts');
    expect(testFilesFor(root, 'src/links.ts')).toEqual(['test/links.test.ts']);
    expect(testFilesFor(root, 'src/ui/Button.tsx')).toEqual(['src/ui/Button.test.tsx']);
    expect(testFilesFor(root, 'src/db/client.ts')).toEqual(['src/db/__tests__/client.spec.ts']);
    expect(testFilesFor(root, 'packages/core/src/parse/ears.ts')).toEqual(['packages/core/test/parse/ears.test.ts']);
    expect(testFilesFor(root, 'pkg/store.go')).toEqual(['pkg/store_test.go']);
    expect(testFilesFor(root, 'app/models.py')).toEqual(['tests/test_models.py']);
  });

  it('returns nothing for a file with no test, and for a test file itself', () => {
    const root = tree('src/lonely.ts', 'src/links.ts', 'test/links.test.ts');
    expect(testFilesFor(root, 'src/lonely.ts')).toEqual([]);
    expect(testFilesFor(root, 'test/links.test.ts')).toEqual([]);
    expect(testFilesFor(root, 'README')).toEqual([]);
  });

  it('lists the test file after the source file in the packet', () => {
    const { root, dir } = project();
    mkdirSync(join(root, 'test', 'auth'), { recursive: true });
    writeFileSync(join(root, 'test', 'auth', 'service.test.ts'), '');
    const packet = buildCtx(loadSpec(dir), root, 'T1.1', 100000);
    expect(packet.files).toEqual(['src/auth/service.ts', 'test/auth/service.test.ts']);
    expect(packet.text).toContain('## Likely files\nsrc/auth/service.ts\ntest/auth/service.test.ts');
  });
});
