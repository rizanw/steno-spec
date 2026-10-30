import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { AGENTS, reviewerAgent, REVIEWER_AGENT_PREFIX } from '../src/index.js';

const reviewersDir = join(__dirname, '..', '..', 'skills', 'skills', 'steno-review', 'reviewers');

describe('reviewer agents', () => {
  it('turns a persona into a read-only agent definition', () => {
    const { file, content } = reviewerAgent('clarity', '# Reviewer: clarity  (stages: requirements, design, tasks)\nFlag ambiguity.\nOutput: `- [high] id: x`.\n');
    expect(file).toBe('steno-reviewer-clarity.md');
    const [, frontmatter, body] = content.split('---\n');
    expect(frontmatter).toContain('name: steno-reviewer-clarity\n');
    expect(frontmatter).toContain('tools: Read, Grep, Glob\n');
    expect(frontmatter).toMatch(/description: .*Stages - requirements, design, tasks\./);
    expect(frontmatter).not.toMatch(/Write|Edit|Bash/);
    expect(body).toContain('Flag ambiguity.');
    expect(body).toContain('never create or edit a file');
  });

  it('produces a valid single-line description for every shipped persona', () => {
    const personas = readdirSync(reviewersDir).filter(f => f.endsWith('.md'));
    expect(personas.length).toBeGreaterThanOrEqual(5);
    for (const f of personas) {
      const { file, content } = reviewerAgent(f.replace(/\.md$/, ''), readFileSync(join(reviewersDir, f), 'utf8'));
      expect(file.startsWith(REVIEWER_AGENT_PREFIX)).toBe(true);
      const description = content.split('\n').find(l => l.startsWith('description: '))!;
      expect(description).not.toContain('Stages - any');
      expect(description.slice('description: '.length)).not.toMatch(/[:#]\s|^\s|["']/);   // stays a plain YAML scalar
    }
  });

  it('is installed only for agents with a known sub-agent folder', () => {
    expect(AGENTS.filter(a => a.subagentsDir).map(a => a.key)).toEqual(['claude']);
  });
});

describe('reviewer config', () => {
  it("defaults to steno's own reviewers and only an explicit egm hands off", async () => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { loadConfig, configTemplate } = await import('../src/index.js');
    const project = (line?: string) => {
      const root = mkdtempSync(join(tmpdir(), 'steno-cfg-'));
      mkdirSync(join(root, '.steno'));
      if (line !== undefined) writeFileSync(join(root, '.steno', 'config.yaml'), `${line}\n`);
      return root;
    };
    expect(loadConfig(project()).reviewer).toBe('default');
    expect(loadConfig(project('reviewer: default')).reviewer).toBe('default');
    expect(loadConfig(project('reviewer: something-else')).reviewer).toBe('default');
    expect(loadConfig(project('reviewer: egm')).reviewer).toBe('egm');
    expect(configTemplate()).toMatch(/^reviewer: default\b/m);
  });
});

describe('linkOrCopy', () => {
  async function setup() {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const r = mkdtempSync(join(tmpdir(), 'steno-link-'));
    mkdirSync(join(r, 'canonical', 'skill'), { recursive: true });
    writeFileSync(join(r, 'canonical', 'skill', 'SKILL.md'), 'hi');
    mkdirSync(join(r, 'agent'));
    return { r, dst: join(r, 'agent', 'skill'), target: join('..', 'canonical', 'skill') };
  }
  const throwing = (code: string) => (() => { throw Object.assign(new Error(code), { code }); }) as never;

  it('copies when symlinks are refused with EPERM (Windows without Developer Mode)', async () => {
    const { linkOrCopy } = await import('../src/index.js');
    const { readFileSync, lstatSync } = await import('node:fs');
    const { dst, target } = await setup();
    expect(linkOrCopy(target, dst, false, throwing('EPERM'))).toBe('copy');
    expect(lstatSync(dst).isSymbolicLink()).toBe(false);
    expect(readFileSync(`${dst}/SKILL.md`, 'utf8')).toBe('hi');
  });

  it('rethrows other errors and links when allowed', async () => {
    const { linkOrCopy } = await import('../src/index.js');
    const { lstatSync } = await import('node:fs');
    const { dst, target } = await setup();
    expect(() => linkOrCopy(target, dst, false, throwing('ENOSPC'))).toThrow('ENOSPC');
    expect(linkOrCopy(target, dst, true)).toBe('copy');
    const second = await setup();
    if (process.platform !== 'win32') {
      expect(linkOrCopy(second.target, second.dst, false)).toBe('link');
      expect(lstatSync(second.dst).isSymbolicLink()).toBe(true);
    }
  });
});
