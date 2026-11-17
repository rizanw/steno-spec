import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createSpec, loadSpec, nextReviewRound, saveReviewLog, loadReviewLog, reviewRoundSection, reviewGrew, reviewDecisions,
  MAX_REVIEW_ROUNDS,
} from '../src/index.js';

const doc = (criteria: string[]) => `# Requirements Document\n\n## Requirements\n\n### Requirement 1: Links\n\n**User Story:** As a user, I want links, so that I can share.\n\n#### Acceptance Criteria\n\n${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n`;
const crit = (n: number) => `WHEN event ${n} happens, THE System SHALL do thing ${n}.`;

function specWith(criteria: string[]) {
  const { dir } = createSpec(mkdtempSync(join(tmpdir(), 'steno-review-')), 'demo');
  const write = (c: string[]) => { writeFileSync(join(dir, 'requirements.md'), doc(c)); return loadSpec(dir); };
  return { dir, write, spec: write(criteria) };
}
/** Run one round the way the CLI does: compute it, then save its log. */
function round(spec: ReturnType<typeof loadSpec>, full = false) {
  const r = nextReviewRound(spec, 'requirements', spec.files['requirements.md'], { full });
  if (!r.unchanged) saveReviewLog(spec.root, 'requirements', r.log);
  return r;
}

describe('review rounds', () => {
  it('starts with a full round and reports an unchanged document instead of a new round', () => {
    const { spec, dir } = specWith([crit(1), crit(2)]);
    const r1 = round(spec);
    expect(r1).toMatchObject({ round: 1, verify: false, unchanged: false, count: 2, firstCount: 2, overLimit: false });
    expect(r1.delta).toBeUndefined();
    expect(reviewRoundSection(r1, 'requirements')).toBe('## Review round 1 (full)\nSize: 2 criteria.');
    expect(round(loadSpec(dir))).toMatchObject({ round: 1, unchanged: true });
    expect(loadReviewLog(dir, 'requirements').rounds).toHaveLength(1);
  });

  it('makes later rounds verify rounds scoped to the added, changed and removed items', () => {
    const { spec, write } = specWith([crit(1), crit(2), crit(3)]);
    round(spec);
    // criterion 2 is rewritten, 3 holds other text, 4 is new
    const r2 = round(write([crit(1), 'WHEN event 2 happens, THE System SHALL refuse.', crit(9), crit(4)]));
    expect(r2).toMatchObject({ round: 2, verify: true, count: 4, firstCount: 3, overLimit: false });
    expect(r2.delta).toEqual({ added: ['R1.4'], changed: ['R1.2', 'R1.3'], removed: [] });
    const section = reviewRoundSection(r2, 'requirements');
    expect(section).toContain('## Review round 2 (verify)');
    expect(section).toContain('Size: 4 criteria (round 1: 3, +1).');
    expect(section).toContain('Since round 1: added: R1.4; changed: R1.2, R1.3.');
    expect(section).toContain('Report nothing med or low on items that did not change.');
    expect(reviewGrew(r2)).toBe(true);   // 3 → 4 is more than a quarter
  });

  it('flags rounds past the limit, and --full starts again at round 1', () => {
    const { spec, write } = specWith([crit(1)]);
    round(spec);
    expect(round(write([crit(1), crit(2)])).overLimit).toBe(false);
    const r3 = round(write([crit(2)]));
    expect(r3.round).toBe(MAX_REVIEW_ROUNDS + 1);
    expect(r3.overLimit).toBe(true);
    expect(r3.delta).toEqual({ added: [], changed: ['R1.1'], removed: ['R1.2'] });
    expect(reviewGrew(r3)).toBe(false);
    expect(round(write([crit(2)]), true)).toMatchObject({ round: 1, verify: false, unchanged: false, firstCount: 1 });
  });

  it('counts a task as changed when its detail lines change, not when it is ticked off or text after it changes', () => {
    const { dir } = specWith([crit(1)]);
    const tasks = (detail: string, box = ' ', notes = 'free text') =>
      `# Implementation Plan\n\n- [${box}] 1. Add links\n  - ${detail}\n  - _Requirements: 1.1_\n- [ ] 2. Add expiry\n  - store the date\n\n## Notes\n${notes}\n`;
    const run = (text: string) => {
      writeFileSync(join(dir, 'tasks.md'), text);
      const spec = loadSpec(dir);
      const r = nextReviewRound(spec, 'tasks', spec.files['tasks.md']);
      if (!r.unchanged) saveReviewLog(dir, 'tasks', r.log);
      return r;
    };
    run(tasks('validate the URL'));
    expect(run(tasks('validate the URL and the slug')).delta).toEqual({ added: [], changed: ['T1'], removed: [] });
    expect(run(tasks('validate the URL and the slug', 'x')).delta).toEqual({ added: [], changed: [], removed: [] });
    expect(run(tasks('validate the URL and the slug', 'x', 'other text')).delta).toEqual({ added: [], changed: [], removed: [] });
  });

  it('reads the decisions ledger for the packet, ignoring an empty one', () => {
    const { dir } = specWith([crit(1)]);
    expect(reviewDecisions(dir, 'requirements')).toBeUndefined();
    writeFileSync(join(dir, 'reviews', 'requirements-decisions.md'), '\n');
    expect(reviewDecisions(dir, 'requirements')).toBeUndefined();
    writeFileSync(join(dir, 'reviews', 'requirements-decisions.md'), '- R1.2: cut, no consumer yet\n');
    expect(reviewDecisions(dir, 'requirements')).toBe('- R1.2: cut, no consumer yet');
  });
});
