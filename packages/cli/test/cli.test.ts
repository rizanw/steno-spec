// End-to-end wiring: runs the built bin/steno.js in a temp project. Needs `pnpm build` first (CI builds before testing).
import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { outlineOf, type DocKind } from '@steno/core';

const BIN = fileURLToPath(new URL('../bin/steno.js', import.meta.url));

function project() {
  const dir = mkdtempSync(join(tmpdir(), 'steno-cli-'));
  const steno = (...args: string[]) => {
    const r = spawnSync(process.execPath, [BIN, ...args], { cwd: dir, encoding: 'utf8' });
    return { code: r.status, out: r.stdout, err: r.stderr };
  };
  return { dir, steno };
}

beforeAll(() => {
  if (!existsSync(BIN)) throw new Error(`${BIN} is missing; run pnpm build before the CLI tests`);
});

describe('steno CLI', () => {
  it('init sets up .steno, the canonical skills and per-agent skills', () => {
    const { dir, steno } = project();
    const r = steno('init', '--agent', 'claude,codex');
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/^initialised .*\.steno$/m);
    expect(r.out).toMatch(/next: ask your agent/);
    expect(existsSync(join(dir, '.steno', 'config.yaml'))).toBe(true);
    expect(existsSync(join(dir, '.agents', 'skills', 'steno-spec', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(dir, '.claude', 'skills', 'steno-spec', 'SKILL.md'))).toBe(true);
    expect(readFileSync(join(dir, 'AGENTS.md'), 'utf8')).toMatch(/steno:start/);
  });

  it('init --list-agents --json prints the keys and labels of the agents and touches nothing', () => {
    const { dir, steno } = project();
    const r = steno('init', '--list-agents', '--json');
    expect(r.code).toBe(0);
    const { agents } = JSON.parse(r.out) as { agents: { key: string; label: string }[] };
    expect(agents.length).toBeGreaterThan(0);
    for (const a of agents) expect(Object.keys(a).sort()).toEqual(['key', 'label']);
    expect(agents.map(a => a.key)).toContain('claude');
    expect(readdirSync(dir)).toEqual([]);
  });

  it('init makes no network request: no http, https, net or tls import and no fetch', () => {
    const text = readFileSync(fileURLToPath(new URL('../src/commands/init.ts', import.meta.url)), 'utf8');
    expect(text).toMatch(/from 'node:fs'/);
    expect(text).not.toMatch(/(?:from\s*['"]|require\(\s*['"]|import\(\s*['"])(?:node:)?(?:http|https|net|tls)['"]|\bfetch\s*\(/);
  });

  it('init does not add the AGENTS.md block twice, with or without its markers', () => {
    const { dir, steno } = project();
    const count = () => readFileSync(join(dir, 'AGENTS.md'), 'utf8').split('## Spec-driven work (steno)').length - 1;
    steno('init'); steno('init');
    expect(count()).toBe(1);
    writeFileSync(join(dir, 'AGENTS.md'), readFileSync(join(dir, 'AGENTS.md'), 'utf8').replace(/<!-- steno:(start|end) -->\n/g, ''));
    steno('init');
    expect(count()).toBe(1);
  });

  it('status --json reads the change cache without writing it; plain status records it', () => {
    const { dir, steno } = project();
    steno('init'); steno('new', 'demo');
    const cache = join(dir, '.steno', 'cache', 'seen.json');
    const json = JSON.parse(steno('status', '--json').out);
    expect(json.changedSinceLastStatus).toContain('requirements.md');
    expect(existsSync(cache)).toBe(false);
    expect(steno('status').out).toMatch(/changed since last status: requirements\.md/);
    expect(existsSync(cache)).toBe(true);
    expect(steno('status').out).toMatch(/changed since last status: nothing/);
    expect(readFileSync(join(dir, '.steno', 'specs', 'demo', 'spec.yaml'), 'utf8')).not.toMatch(/seen/);
  });

  it('approve refuses any stage but the current one, even with --force', () => {
    const { dir, steno } = project();
    steno('init'); steno('new', 'demo');
    const state = join(dir, '.steno', 'specs', 'demo', 'spec.yaml');
    const before = readFileSync(state, 'utf8');
    for (const stage of ['design', 'tasks']) {
      const r = steno('approve', stage, '--force');
      expect(r.code).toBe(1);
      expect(r.err).toMatch(/only requirements can be approved now/);
    }
    expect(readFileSync(state, 'utf8')).toBe(before);
    expect(steno('approve', 'requirements', '--force').out).toMatch(/phase → design/);
  });

  it('rejects a bad --budget and an import slug that leaves the specs folder', () => {
    const { dir, steno } = project();
    steno('init'); steno('quick', 'q');
    writeFileSync(join(dir, '.steno', 'specs', 'q', 'tasks.md'), '# Tasks\n\n- [ ] 1. Build\n');
    for (const b of ['abc', '0', '-5']) {
      const r = steno('ctx', 'T1', '--budget', b);
      expect(r.code).toBe(1);
      expect(r.err).toMatch(/budget must be a positive whole number/);
    }
    expect(steno('ctx', 'T1', '--budget', '800').out).toMatch(/\/800 tokens/);
    mkdirSync(join(dir, 'kiro', 'spec1'), { recursive: true });
    writeFileSync(join(dir, 'kiro', 'spec1', 'requirements.md'), '# Requirements Document\n');
    const r = steno('import', 'kiro/spec1', '../../escaped');
    expect(r.code).toBe(1);
    expect(existsSync(join(dir, '..', 'escaped'))).toBe(false);
    expect(existsSync(join(dir, '.steno', 'escaped'))).toBe(false);
  });

  it('done moves the phase to done and --undo moves it back; steer lint exits 2 with full output', () => {
    const { dir, steno } = project();
    steno('init'); steno('quick', 'q');
    const state = join(dir, '.steno', 'specs', 'q', 'spec.yaml');
    writeFileSync(join(dir, '.steno', 'specs', 'q', 'tasks.md'), '# Tasks\n\n- [ ] 1. Build\n  - [ ] 1.1 Core\n    - [ ] 1.1.1 Leaf\n');
    expect(steno('done', '1').out).toMatch(/all tasks done/);
    expect(readFileSync(state, 'utf8')).toMatch(/phase: done/);
    expect(steno('next').out).toMatch(/all tasks done/);
    steno('done', '1.1.1', '--undo');
    expect(readFileSync(state, 'utf8')).toMatch(/phase: execute/);
    writeFileSync(join(dir, '.steno', 'steering', 'bad.md'), '---\ninclusion: bogus\n---\n# Bad\n');
    const lint = steno('steer', 'lint');
    expect(lint.code).toBe(2);
    expect(lint.out).toMatch(/unknown inclusion "bogus"[\s\S]*\d+ errors?, \d+ warnings?/);
  });

  it('show steering/<file> prints a steering file, with or without the .md', () => {
    const { dir, steno } = project();
    steno('init');
    writeFileSync(join(dir, '.steno', 'steering', 'tech.md'), '# Tech stack\n\n- Node 22\n');
    for (const id of ['steering/tech.md', 'steering/tech']) {
      const r = steno('show', id);
      expect(r.code).toBe(0);
      expect(r.out).toMatch(/Node 22/);
    }
    expect(steno('show', 'steering/nope').code).toBe(1);
  });

  it('next: names bugfix.md for a bugfix spec in the requirements phase (and requirements.md for a feature spec)', () => {
    const { steno } = project();
    steno('init');
    const created = steno('new', 'crash', '--bugfix');
    expect(created.out).toMatch(/^next: .*fills bugfix\.md/m);
    expect(created.out).not.toMatch(/requirements\.md/);
    expect(steno('status', 'crash').out).toMatch(/^next: .*fills bugfix\.md/m);
    steno('new', 'idea', '--bugfix', '--brief');
    const approved = steno('approve', 'brief', 'idea');
    expect(approved.code).toBe(0);
    expect(approved.out).toMatch(/^next: .*fills bugfix\.md/m);
    expect(steno('new', 'feat').out).toMatch(/^next: .*fills requirements\.md/m);
  });

  it('new -d writes the description as a request line in the first document', () => {
    const { dir, steno } = project();
    steno('init');
    const r = steno('new', 'export', '-d', 'export  invoices\nas CSV', '--json');
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out).created).toContain('requirements.md');
    const text = readFileSync(join(dir, '.steno', 'specs', 'export', 'requirements.md'), 'utf8');
    expect(text).toContain('## Introduction\n\n> Request: export invoices as CSV\n');
  });

  it('lint and approve requirements on a bugfix spec name bugfix.md', () => {
    const { dir, steno } = project();
    steno('init'); steno('new', 'crash', '--bugfix');
    const json = JSON.parse(steno('lint', '--json').out);
    expect(json.diagnostics.length).toBeGreaterThan(0);
    expect(json.diagnostics.every((d: { file: string }) => d.file === '.steno/specs/crash/bugfix.md')).toBe(true);
    expect(steno('lint').out).toMatch(/bugfix\.md/);
    const r = steno('approve', 'requirements');
    expect(r.code).not.toBe(0);
    expect(r.out).toMatch(/bugfix\.md/);
    expect(r.out).not.toMatch(/requirements\.md/);
    expect(readFileSync(join(dir, '.steno', 'specs', 'crash', 'spec.yaml'), 'utf8')).not.toMatch(/requirements: \d/);
  });

  it('review on a bugfix spec reviews bugfix.md, even next to a stray requirements.md', () => {
    const { dir, steno } = project();
    steno('init'); steno('new', 'crash', '--bugfix');
    const spec = join(dir, '.steno', 'specs', 'crash');
    writeFileSync(join(spec, 'requirements.md'), '# Stray\n');
    expect(steno('review').code).toBe(0);
    const packet = readFileSync(join(spec, 'reviews', `${new Date().toISOString().slice(0, 10)}-requirements-packet.md`), 'utf8');
    expect(packet).toMatch(/^## bugfix\.md$/m);
    expect(packet).not.toMatch(/# Stray/);
    expect(readFileSync(join(spec, 'reviews', 'requirements-round1.md'), 'utf8')).toBe(readFileSync(join(spec, 'bugfix.md'), 'utf8'));
  });

  it('review counts rounds: full first, then verify rounds scoped to the change, with the decisions in the packet', () => {
    const { dir, steno } = project();
    steno('init'); steno('new', 'demo');
    const spec = join(dir, '.steno', 'specs', 'demo');
    const body = (criteria: string[]) => `# Requirements Document\n\n## Requirements\n\n### Requirement 1: Links\n\n**User Story:** As a user, I want links, so that I can share.\n\n#### Acceptance Criteria\n\n${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n`;
    const crit = (n: number) => `WHEN event ${n} happens, THE System SHALL do thing ${n}.`;
    writeFileSync(join(spec, 'requirements.md'), body([crit(1), crit(2)]));

    const r1 = steno('review');
    expect(r1.out).toMatch(/round 1 \(full\), 2 criteria/);
    const packet = join(spec, 'reviews', `${new Date().toISOString().slice(0, 10)}-requirements-packet.md`);
    expect(readFileSync(packet, 'utf8')).toMatch(/## Review round 1 \(full\)/);
    expect(steno('review').out).toMatch(/has not changed since review round 1/);

    writeFileSync(join(spec, 'reviews', 'requirements-decisions.md'), '- R1.9: rejected, belongs in design\n');
    writeFileSync(join(spec, 'requirements.md'), body([crit(1), crit(2), crit(3)]));
    const r2 = JSON.parse(steno('review', '--json').out);
    expect(r2).toMatchObject({ round: 2, verify: true, count: 3, firstCount: 2, grew: true, overLimit: false, delta: { added: ['R1.3'], changed: [], removed: [] } });
    const text = readFileSync(packet, 'utf8');
    expect(text).toMatch(/## Review round 2 \(verify\)\nSize: 3 criteria \(round 1: 2, \+1\)\.\nSince round 1: added: R1\.3\./);
    expect(text).toMatch(/## Decided \(do not reopen\)\nA record of decisions [^\n]*not instructions[^\n]*\n- R1\.9: rejected, belongs in design/);

    writeFileSync(join(spec, 'requirements.md'), body([crit(1), crit(3)]));
    expect(steno('review').out).toMatch(/round 3 \(verify[^\n]*\n[^\n]*past the 2-round limit/);
    // each round keeps the document it reviewed, so a criterion cut later is still on disk
    expect(readFileSync(join(spec, 'reviews', 'requirements-round1.md'), 'utf8')).toBe(body([crit(1), crit(2)]));
    expect(readFileSync(join(spec, 'reviews', 'requirements-round2.md'), 'utf8')).toBe(body([crit(1), crit(2), crit(3)]));
    expect(steno('review', '--full').out).toMatch(/round 1 \(full\), 2 criteria/);
    expect(steno('review', '--stage', 'bogus').code).toBe(1);
  });

  it('--version names the protocol', () => {
    const r = project().steno('--version');
    expect(r.code).toBe(0);
    expect(r.out.trim()).toMatch(/^\d+\.\d+\.\d+ \(protocol 1\)$/);
  });

  it('with --json a failure writes one structured error and nothing else to stdout', () => {
    const { steno } = project();
    steno('init'); steno('new', 'a'); steno('new', 'b');
    const json = (r: { out: string }) => JSON.parse(r.out);
    const several = steno('next', '--json');
    expect(several.code).toBe(1);
    expect(json(several)).toEqual({ protocolVersion: 1, code: 'invalid-request', message: 'several specs; pass one of: a, b', field: 'spec' });
    for (const args of [['next', '--bogus', '--json'], ['ctx', '--json']]) {
      const r = steno(...args);
      expect(r.code).toBe(1);
      expect(json(r).code).toBe('invalid-request');
    }
    expect(json(steno('status', 'nope', '--json'))).toMatchObject({ code: 'not-found', spec: 'nope' });
    expect(json(steno('new', 'a', '--json')).code).toBe('failed');
    const blocked = steno('approve', 'requirements', 'a', '--json');
    expect(blocked.code).toBe(2);
    expect(json(blocked)).toMatchObject({ protocolVersion: 1, code: 'lint-blocked', spec: 'a' });
    // text mode keeps the message on stderr
    const text = steno('next');
    expect(text.out).toBe('');
    expect(text.err).toMatch(/^steno: several specs/);
  });

  it('refuses an Unusable spec, lists it with its flag and lets a named lint through', () => {
    const { dir, steno } = project();
    steno('init'); steno('new', 'a'); steno('new', 'b');
    const state = join(dir, '.steno', 'specs', 'b', 'spec.yaml');
    writeFileSync(state, 'phase: nope\n');
    const named = steno('status', 'b', '--json');
    expect(named.code).toBe(1);
    expect(JSON.parse(named.out)).toMatchObject({ code: 'unreadable', spec: 'b' });
    expect(JSON.parse(steno('lint', '--json').out)).toMatchObject({ code: 'unreadable', spec: 'b' });
    expect(steno('status', 'a').code).toBe(0);
    expect(steno('list').out).toMatch(/^b\s+unreadable$/m);
    const lint = steno('lint', 'b');
    expect(lint.code).toBe(2);
    expect(lint.out).toMatch(/\[spec\/unreadable\]/);
    expect(readFileSync(state, 'utf8')).toBe('phase: nope\n');
  });

  it('an Unreadable configuration gives not-set-up; init installs the skills and leaves it unchanged', () => {
    const { dir, steno } = project();
    steno('init'); steno('new', 'a');
    const cfg = join(dir, '.steno', 'config.yaml');
    writeFileSync(cfg, 'specsDir: ../out\n');
    for (const args of [['list', '--json'], ['status', '--json'], ['steer', 'lint', '--json']]) {
      const r = steno(...args);
      expect(r.code).toBe(1);
      expect(JSON.parse(r.out).code).toBe('not-set-up');
    }
    rmSync(join(dir, '.agents'), { recursive: true });
    const r = steno('init');
    expect(r.code).toBe(0);
    expect(r.err).toMatch(/warning: .*outside the project root/);
    expect(existsSync(join(dir, '.agents', 'skills', 'steno-spec', 'SKILL.md'))).toBe(true);
    expect(readFileSync(cfg, 'utf8')).toBe('specsDir: ../out\n');
  });
  it('list --json returns the spec tree, with dates for a derived spec and the flag of an Unusable one', () => {
    const { dir, steno } = project();
    steno('init'); steno('quick', 'q'); steno('new', 'b');
    writeFileSync(join(dir, '.steno', 'specs', 'q', 'tasks.md'), '# Tasks\n\n- [x] 1. Build\n- [ ] 2. Ship\n- [ ]* 3. Extra\n');
    writeFileSync(join(dir, '.steno', 'specs', 'b', 'spec.yaml'), 'phase: nope\n');
    // a folder with documents and no spec.yaml: derived, written by list
    mkdirSync(join(dir, '.steno', 'specs', 'k'));
    writeFileSync(join(dir, '.steno', 'specs', 'k', 'requirements.md'), '# Requirements Document\n');
    writeFileSync(join(dir, '.steno', 'specs', 'k', 'design.md'), '# Design\n');
    const r = steno('list', '--json');
    expect(r.code).toBe(0);
    const tree = JSON.parse(r.out);
    expect(tree.protocolVersion).toBe(1);
    expect(tree.notSetUp).toBeUndefined();
    expect(tree.steering).toEqual([]);
    const by = (n: string) => tree.specs.find((s: { name: string }) => s.name === n);
    expect(by('q')).toMatchObject({ kind: 'feature', mode: 'quick', phase: 'execute', documents: ['requirements.md', 'design.md', 'tasks.md'],
      tasks: { total: 2, done: 1, optionalTotal: 1, optionalDone: 0 }, next: { id: 'T2', title: 'Ship' } });
    expect(by('b')).toEqual({ name: 'b', unreadable: true, files: [{ file: '.steno/specs/b/spec.yaml', reason: expect.any(String) }] });
    const today = new Date().toISOString().slice(0, 10);
    expect(by('k').approvals).toEqual({ requirements: today, design: today });
    expect(existsSync(join(dir, '.steno', 'specs', 'k', 'spec.yaml'))).toBe(true);
    expect(steno('list').out).toMatch(/^b\s+unreadable$/m);
  });

  it('ctx --json returns the task packet and leaves an Unreadable steering file out, listed as trimmed', () => {
    const { dir, steno } = project();
    steno('init'); steno('quick', 'q');
    writeFileSync(join(dir, '.steno', 'specs', 'q', 'tasks.md'), '# Tasks\n\n- [ ] 1. Build\n');
    writeFileSync(join(dir, '.steno', 'steering', 'good.md'), '# Good\nGOOD-RULE\n');
    writeFileSync(join(dir, '.steno', 'steering', 'bad.md'), Buffer.from([0x23, 0x20, 0xff, 0xfe, 0x0a]));
    const r = steno('ctx', 'T1', '--json');
    expect(r.code).toBe(0);
    const p = JSON.parse(r.out);
    expect(Object.keys(p).sort()).toEqual(['budget', 'files', 'protocolVersion', 'spec', 'task', 'text', 'tokens', 'trimmed']);
    expect(p).toMatchObject({ protocolVersion: 1, spec: 'q', task: 'T1' });
    expect(p.text).toMatch(/GOOD-RULE/);
    expect(p.text).not.toMatch(/\[bad\.md\]/);
    expect(p.trimmed).toContain('steering/bad.md (bad.md is not UTF-8 text)');
    expect(steno('ctx', 'T1').out).toMatch(/^<!-- steno ctx T1 .*trimmed: .*steering\/bad\.md/);
  });

  it('lint and steer lint --json return Diagnostic lists; errors exit 2', () => {
    const { dir, steno } = project();
    steno('init'); steno('quick', 'q'); steno('new', 'b');
    const all = JSON.parse(steno('lint', 'q', '--json').out);
    expect(all).toMatchObject({ protocolVersion: 1, spec: 'q' });
    expect(new Set(all.diagnostics.map((d: { file: string }) => d.file)).size).toBeGreaterThan(1);
    const design = steno('lint', 'design', 'q', '--json');
    const one = JSON.parse(design.out);
    expect(one.diagnostics.length).toBeGreaterThan(0);
    expect(one.diagnostics.every((d: { file: string; spec: string }) => d.file === '.steno/specs/q/design.md' && d.spec === 'q')).toBe(true);
    expect(design.code).toBe(one.diagnostics.some((d: { severity: string }) => d.severity === 'error') ? 2 : 0);
    // a named Unusable spec: its read errors, exit 2
    writeFileSync(join(dir, '.steno', 'specs', 'b', 'spec.yaml'), 'phase: nope\n');
    const bad = steno('lint', 'b', '--json');
    expect(bad.code).toBe(2);
    expect(JSON.parse(bad.out)).toEqual({ protocolVersion: 1, spec: 'b', diagnostics: [
      { file: '.steno/specs/b/spec.yaml', line: 1, severity: 'error', rule: 'spec/unreadable', message: expect.any(String), spec: 'b' }] });
    // steer lint: an Unreadable steering file is a lint error, a configuration warning is listed
    writeFileSync(join(dir, '.steno', 'steering', 'bad.md'), Buffer.from([0xff, 0xfe]));
    writeFileSync(join(dir, '.steno', 'config.yaml'), readFileSync(join(dir, '.steno', 'config.yaml'), 'utf8') + 'bogusKey: 1\n');
    const steer = steno('steer', 'lint', '--json');
    expect(steer.code).toBe(2);
    const list = JSON.parse(steer.out);
    expect(list.protocolVersion).toBe(1);
    expect(list.spec).toBeUndefined();
    expect(list.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ file: '.steno/steering/bad.md', line: 1, severity: 'error', rule: 'steering/unreadable' }),
      expect.objectContaining({ file: '.steno/config.yaml', severity: 'warning', rule: 'config/unknown-key' }),
    ]));
    expect(steno('steer', 'lint').out).toMatch(/steering\/unreadable[\s\S]*config\/unknown-key/);
  });

  it('show requirements|design|tasks --json returns the outline outlineOf builds', () => {
    const { dir, steno } = project();
    steno('init'); steno('quick', 'q'); steno('new', 'crash', '--bugfix');
    for (const [spec, id, file, kind] of [['q', 'requirements', 'requirements.md', 'requirements'], ['q', 'design', 'design.md', 'design'],
      ['q', 'tasks', 'tasks.md', 'tasks'], ['crash', 'requirements', 'bugfix.md', 'bugfix']] as const) {
      const r = steno('show', id, spec, '--json');
      expect(r.code).toBe(0);
      const text = readFileSync(join(dir, '.steno', 'specs', spec, file), 'utf8');
      expect(JSON.parse(r.out)).toEqual({ protocolVersion: 1, spec, document: file, items: outlineOf(kind as DocKind, text) });
    }
  });

  it('done, reopen and approve return the change result; a blocked approve is lint-blocked with findings until --force', () => {
    const { dir, steno } = project();
    steno('init'); steno('quick', 'q'); steno('new', 'a');
    writeFileSync(join(dir, '.steno', 'specs', 'q', 'tasks.md'), '# Tasks\n\n- [ ] 1. Build\n- [ ] 2. Ship\n');
    const json = (r: { out: string }) => JSON.parse(r.out);
    expect(json(steno('done', '1', 'q', '--json'))).toEqual({ protocolVersion: 1, spec: 'q', phase: 'execute', task: 'T1', done: true });
    expect(json(steno('done', '2', 'q', '--json'))).toEqual({ protocolVersion: 1, spec: 'q', phase: 'done', task: 'T2', done: true });
    expect(json(steno('done', '2', 'q', '--undo', '--json'))).toEqual({ protocolVersion: 1, spec: 'q', phase: 'execute', task: 'T2', done: false });
    expect(steno('done', '2', 'q').out).toMatch(/^done T2\nall tasks done/);

    const blocked = steno('approve', 'requirements', 'a', '--json');
    expect(blocked.code).toBe(2);
    const err = json(blocked);
    expect(err).toMatchObject({ protocolVersion: 1, code: 'lint-blocked', spec: 'a' });
    expect(err.findings.length).toBeGreaterThan(0);
    expect(err.findings.every((d: { severity: string; file: string }) => d.severity === 'error' && d.file === '.steno/specs/a/requirements.md')).toBe(true);
    const text = steno('approve', 'requirements', 'a');
    expect(text.code).toBe(2);
    expect(text.out).toMatch(/E requirements\.md/);
    expect(json(steno('approve', 'requirements', 'a', '--force', '--json')))
      .toEqual({ protocolVersion: 1, spec: 'a', phase: 'design', approved: 'requirements', forced: true });

    steno('new', 'idea', '--brief');
    expect(json(steno('approve', 'brief', 'idea', '--json'))).toEqual({ protocolVersion: 1, spec: 'idea', phase: 'requirements', approved: 'brief' });
  });

  it('new, quick and import return a change result with the files created', () => {
    const { dir, steno } = project();
    steno('init');
    const json = (r: { out: string }) => JSON.parse(r.out);
    expect(json(steno('new', 'a', '--json'))).toEqual({ protocolVersion: 1, spec: 'a', phase: 'requirements', created: ['requirements.md', 'spec.yaml'] });
    expect(json(steno('quick', 'q', '--json'))).toEqual({ protocolVersion: 1, spec: 'q', phase: 'execute', created: ['requirements.md', 'design.md', 'tasks.md', 'spec.yaml'] });
    mkdirSync(join(dir, 'kiro', 'k1'), { recursive: true });
    writeFileSync(join(dir, 'kiro', 'k1', 'requirements.md'), '# Requirements Document\n');
    expect(json(steno('import', 'kiro/k1', 'k1', '--json'))).toEqual({ protocolVersion: 1, spec: 'k1', phase: expect.any(String), created: ['requirements.md', 'spec.yaml'] });
  });
  it('only steno lsp loads the protocol library, and it refuses --root', () => {
    const { dir, steno } = project();
    steno('init'); steno('new', 'demo');
    expect(readFileSync(BIN, 'utf8')).not.toMatch(/vscode-languageserver/);
    expect(existsSync(fileURLToPath(new URL('../bin/lsp.js', import.meta.url)))).toBe(true);
    // log every module steno resolves, then run a command other than lsp
    const hook = `import { registerHooks } from 'node:module';
      registerHooks({ resolve(s, c, next) { process.stderr.write('RESOLVE ' + s + '\\n'); return next(s, c); } });`;
    const r = spawnSync(process.execPath, ['--import', `data:text/javascript,${encodeURIComponent(hook)}`, BIN, 'list'], { cwd: dir, encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(r.stderr).toMatch(/RESOLVE commander/);
    expect(r.stderr).not.toMatch(/vscode-languageserver|lsp\.js/);
    const bad = steno('lsp', '--root', 'x');
    expect(bad.code).toBe(1);
    expect(bad.err).toMatch(/^steno: --root does not apply to steno lsp/);
    expect(JSON.parse(steno('lsp', '--root', 'x', '--json').out)).toMatchObject({ code: 'invalid-request', field: 'root', protocolVersion: 1 });
  });
});
