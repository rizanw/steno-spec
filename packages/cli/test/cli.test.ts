// End-to-end wiring: runs the built bin/steno.js in a temp project. Needs `pnpm build` first (CI builds before testing).
import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

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

  it('lint and approve requirements on a bugfix spec name bugfix.md', () => {
    const { dir, steno } = project();
    steno('init'); steno('new', 'crash', '--bugfix');
    const json = JSON.parse(steno('lint', '--json').out);
    expect(json.issues.length).toBeGreaterThan(0);
    expect(json.issues.every((i: { file: string }) => i.file === 'bugfix.md')).toBe(true);
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
});
