// The server's time limits on the largest project they cover: 50 Specs and 50 steering files, every document 2,000
// lines. Diagnostics within 1,000 ms of an edit, the notice within 1,000 ms of a disk change, and every Diagnostic
// within 3,000 ms of the handshake. A 60-Spec project has no time limit and must still get all its Diagnostics.
// Needs `pnpm build` first.
import { describe, it, expect } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { uri, useClients } from './lsp-client.js';

const client = useClients();
const LINES = 2000;
const PUBLISH = 'textDocument/publishDiagnostics';

/** `head` followed by `block(i)` for i = 1, 2, … for as long as the whole stays within LINES lines. */
function fill(head: string[], block: (i: number) => string[]): string {
  const out = [...head];
  for (let i = 1; ; i++) {
    const b = block(i);
    if (out.length + b.length > LINES) break;
    out.push(...b);
  }
  return out.join('\n') + '\n';
}

const requirements = () => fill(['# Requirements Document', '', '## Requirements', ''], i => [
  `### Requirement ${i}: Feature ${i}`, '',
  `**User Story:** As a user, I want feature ${i}, so that I can work.`, '',
  '#### Acceptance Criteria', '',
  ...[1, 2, 3, 4, 5, 6].map(n => `${n}. WHEN a user starts action ${n} of feature ${i}, THE system SHALL record the result ${n}.`), '',
]);
// the first section cites R999.1, which no requirement has: one `design/unknown-req` per Spec
// each design section and task cites one of the first 100 requirements and sections, which every document holds
const ref = (i: number) => ((i - 1) % 100) + 1;
const design = () => fill(['# Design', '', '## Overview', '', 'Generated.', '', '## Missing {#D-missing}', '_Satisfies: 999.1_', ''], i => [
  `## Section ${i} {#D-s${i}}`, `_Satisfies: ${ref(i)}.1, ${ref(i)}.2_`, '',
  ...Array.from({ length: 8 }, (_, n) => `- Behaviour ${n} of section ${i}: the store keeps item ${n} for feature ${i}.`), '',
]);
const tasks = () => fill(['# Implementation Plan', ''], i => [
  `- [ ] ${i}. Task ${i}`,
  `  - [ ] ${i}.1 Build part one of task ${i}`, `    - _Requirements: ${ref(i)}.1_ _Design: D-s${ref(i)}_`,
  `  - [ ] ${i}.2 Build part two of task ${i}`, `    - _Requirements: ${ref(i)}.2_ _Design: D-s${ref(i)}_`, '',
]);
const steering = (n: number) => fill(['---', 'inclusion: manual', '---', `# Topic ${n}`, ''], i => [`- Fact ${i} of topic ${n}: the value is ${i * n}.`]);

/** A set-up project of `specs` Specs (requirements, design, tasks) and `files` steering files, every document LINES long. */
function large(specs: number, files: number) {
  const dir = mkdtempSync(join(tmpdir(), 'steno-timing-'));
  const steno = join(dir, '.steno'), steer = join(steno, 'steering');
  mkdirSync(steer, { recursive: true });
  writeFileSync(join(steno, 'config.yaml'), 'specsDir: .steno/specs\nsteeringDir: .steno/steering\n');
  const [req, des, tsk] = [requirements(), design(), tasks()];
  const designs: string[] = [];
  for (let s = 1; s <= specs; s++) {
    const name = `spec-${String(s).padStart(2, '0')}`, folder = join(steno, 'specs', name);
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, 'spec.yaml'), `name: ${name}\ntitle: ${name}\nkind: feature\nmode: gated\nphase: execute\ncreated: 2026-01-01\napprovals:\n  requirements: 2026-01-01\n  design: 2026-01-01\n  tasks: 2026-01-01\n`);
    writeFileSync(join(folder, 'requirements.md'), req);
    writeFileSync(join(folder, 'design.md'), des);
    writeFileSync(join(folder, 'tasks.md'), tsk);
    designs.push(join(folder, 'design.md'));
  }
  for (let f = 1; f <= files; f++) writeFileSync(join(steer, `topic-${String(f).padStart(2, '0')}.md`), steering(f));
  return { dir, designs, design: des };
}

const unknownReq = (ps: any) => ps.diagnostics.some((d: any) => d.code === 'design/unknown-req');
const clean = (ps: any) => !unknownReq(ps);

/** Waits until every design document has had its `design/unknown-req` published; returns when the last one arrived. */
async function allPublished(c: ReturnType<typeof client>, designs: string[], ms: number): Promise<number> {
  let last = 0;
  for (const d of designs) last = Math.max(last, (await c.waitFor(PUBLISH, ps => ps.uri === uri(d) && unknownReq(ps), ms)).at);
  return last;
}

describe('steno lsp: time limits for 50 Specs and 50 steering files', () => {
  // Windows CI runners are slow and their file watcher lags: the limits stay, a run over them is retried there
  it('publishes every Diagnostic within 3,000 ms of the handshake, then serves an edit and a disk change within 1,000 ms', { timeout: 30_000, retry: process.platform === 'win32' ? 2 : 0 }, async () => {
    const p = large(50, 50);
    // each document is close to the limit, never over it
    for (const f of [p.design, requirements(), tasks(), steering(1)]) expect(f.split('\n').length - 1).toBeGreaterThan(LINES - 20);
    for (const f of [p.design, requirements(), tasks(), steering(1)]) expect(f.split('\n').length - 1).toBeLessThanOrEqual(LINES);
    const c = client();
    const start = Date.now();
    await c.initialize({ rootUri: uri(p.dir) });
    expect(await allPublished(c, p.designs, 10_000) - start).toBeLessThan(3000);

    // an edit: the clock starts when the change is sent
    let from = c.received.length;
    let sent = Date.now();
    c.open(p.designs[0], p.design.replace('_Satisfies: 999.1_', '_Satisfies: 1.1_'));
    const edited = await c.waitFor(PUBLISH, ps => ps.uri === uri(p.designs[0]) && clean(ps), 5000, from);
    expect(edited.at - sent).toBeLessThan(1000);

    // a disk change, seen by the server's own watcher: the clock starts at the write, before the watcher event
    from = c.received.length;
    sent = Date.now();
    writeFileSync(p.designs[1], p.design.replace('_Satisfies: 999.1_', '_Satisfies: 1.1_'));
    const notice = await c.waitFor('steno/treeChanged', undefined, 5000, from);
    expect(notice.at - sent).toBeLessThan(1000);
  });
});

describe('steno lsp: beyond the size limit', () => {
  it('publishes the Diagnostics of every one of 60 Specs, with no time limit', async () => {
    const p = large(60, 50);
    const c = client();
    await c.initialize({ rootUri: uri(p.dir) });
    await allPublished(c, p.designs, 60_000);
    expect(new Set(c.received.filter(r => r.method === PUBLISH && unknownReq(r.params)).map(r => r.params.uri)).size).toBe(60);
  }, 90_000);
});
