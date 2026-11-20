// The CLI and the language server agree on one project: the spec tree, the Diagnostics and a task packet.
// The only differences masked are the approval dates of a derived Spec (the CLI writes them, the server shows null)
// and the no-match warning, which only `steno steer lint` gives. Needs `pnpm build` first.
import { describe, it, expect } from 'vitest';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { BIN, cliJson, project, uri, useClients } from './lsp-client.js';

const client = useClients();

const REQ = '# Requirements Document\n\n## Requirements\n\n### Requirement 1: Login\n\n**User Story:** As a user, I want to log in, so that I can work.\n\n#### Acceptance Criteria\n\n1. WHEN a user submits valid credentials, THE system SHALL create a session.\n';
// cites R1.2, which REQ lacks
const DESIGN = '# Design\n\n## Overview\n\nShort.\n\n## Sessions {#D-session}\n_Satisfies: 1.1, 1.2_\n\nThe store.\n';
const TASKS = '# Tasks\n\n- [ ] 1. Session\n  - [ ] 1.1 Add the store\n    - _Requirements: 1.1_ _Design: D-session_\n  - [ ] 1.2 Add expiry\n    - _Requirements: 1.1_\n- [ ] 2. Logout\n';
const NO_MATCH = 'steering/no-match';

/** A project with lint findings in several Specs and steering files, a derived Spec, an Unusable one and a config warning. */
function mixed(): string {
  const dir = project(true, 'demo', 'b');
  spawnSync(process.execPath, [BIN, 'quick', 'q'], { cwd: dir });
  const specs = join(dir, '.steno', 'specs'), steering = join(dir, '.steno', 'steering');
  writeFileSync(join(specs, 'demo', 'requirements.md'), REQ);
  writeFileSync(join(specs, 'demo', 'design.md'), DESIGN);
  writeFileSync(join(specs, 'demo', 'tasks.md'), TASKS);
  writeFileSync(join(specs, 'b', 'spec.yaml'), 'phase: nope\n');
  // documents and no spec.yaml: derived
  mkdirSync(join(specs, 'k'));
  writeFileSync(join(specs, 'k', 'requirements.md'), '# Requirements Document\n');
  writeFileSync(join(specs, 'k', 'design.md'), '# Design\n');
  writeFileSync(join(steering, 'tech.md'), '# Tech\n\nNode.\n');
  writeFileSync(join(steering, 'api.md'), '---\ninclusion: fileMatch\nfileMatchPattern: "nothing-here/**"\n---\n# API\n\nREST.\n');
  writeFileSync(join(steering, 'bad.md'), Buffer.from([0x23, 0x20, 0xff, 0xfe, 0x0a]));
  appendFileSync(join(dir, '.steno', 'config.yaml'), 'bogusKey: 1\n');
  return dir;
}

/** Diagnostics as the server publishes them: per file URI, in the protocol form, sorted. */
type Published = Record<string, { line: number; severity: number; code: string; message: string }[]>;
const sorted = (p: Published): Published => Object.fromEntries(Object.entries(p).sort(([a], [b]) => a.localeCompare(b))
  .map(([k, v]) => [k, [...v].sort((x, y) => x.line - y.line || x.code.localeCompare(y.code) || x.message.localeCompare(y.message))]));

describe('CLI and server parity', () => {
  it('returns the same tree, Diagnostics and task packet', async () => {
    const dir = mixed();
    const c = client();
    await c.initialize({ rootUri: uri(dir) });
    const design = join(dir, '.steno', 'specs', 'demo', 'design.md');
    // one sync publishes every file's list, so once one file has arrived, the rest has too
    await c.waitFor('textDocument/publishDiagnostics', ps => ps.uri === uri(design));
    await new Promise(r => setTimeout(r, 300));
    const fromServer: Published = {};
    for (const r of c.received.filter(m => m.method === 'textDocument/publishDiagnostics')) {
      fromServer[r.params.uri] = r.params.diagnostics.map((d: any) => ({ line: d.range.start.line + 1, severity: d.severity, code: d.code, message: d.message }));
    }
    for (const [k, v] of Object.entries(fromServer)) if (v.length === 0) delete fromServer[k];
    const tree = await c.request('steno/specTree');
    const packet = await c.request('steno/taskPacket', { spec: 'demo', task: 'T1.1' });
    c.proc.kill();

    // the task packet
    expect(packet).toEqual(cliJson(dir, 'ctx', 'T1.1', 'demo'));

    // the tree: `steno list` writes the derived Spec's record and shows today's dates where the server shows null
    const listed = cliJson(dir, 'list');
    const k = tree.specs.find((s: any) => s.name === 'k');
    expect(Object.keys(k.approvals).length).toBeGreaterThan(0);
    expect(Object.values(k.approvals).every(v => v === null)).toBe(true);
    const today = new Date().toISOString().slice(0, 10);
    for (const phase of Object.keys(k.approvals)) k.approvals[phase] = today;
    expect(tree).toEqual(listed);
    expect(tree.specsDir).toBe('.steno/specs');
    expect(tree.specs.find((s: any) => s.name === 'demo').taskItems.length).toBeGreaterThan(0);

    // the Diagnostics: `steno lint` for every Spec plus `steno steer lint`, without the no-match warning
    const cli = [
      ...tree.specs.flatMap((s: any) => cliJson(dir, 'lint', s.name).diagnostics),
      ...cliJson(dir, 'steer', 'lint').diagnostics,
    ];
    expect(cli.some(d => d.rule === NO_MATCH)).toBe(true);
    const fromCli: Published = {};
    for (const d of cli.filter(d => d.rule !== NO_MATCH)) {
      (fromCli[uri(join(dir, d.file))] ??= []).push({ line: d.line, severity: d.severity === 'error' ? 1 : 2, code: d.rule, message: d.message });
    }
    // the project covers lint, read and configuration findings in Spec and steering files
    const rules = new Set(Object.values(fromServer).flat().map(d => d.code));
    for (const r of ['design/unknown-req', 'spec/unreadable', 'steering/unreadable', 'config/unknown-key']) expect(rules).toContain(r);
    expect(sorted(fromServer)).toEqual(sorted(fromCli));
  });
});
