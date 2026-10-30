import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scan, writeSteering, lintSteering, listSteering, matchingSteering, loadSteering, splitPattern, escapeGlob, saveConfig, loadConfig, templateFor } from '../src/index.js';

function touch(root: string, ...files: string[]) {
  for (const f of files) { mkdirSync(join(root, f, '..'), { recursive: true }); writeFileSync(join(root, f), ''); }
}

function nextProject() {
  const root = mkdtempSync(join(tmpdir(), 'steno-steer-'));
  mkdirSync(join(root, '.steno'), { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({
    dependencies: { next: '15', '@prisma/client': '6', 'next-auth': '5', 'next-intl': '3' },
    devDependencies: { prisma: '6', vitest: '3' },
  }));
  touch(root, 'pnpm-lock.yaml', 'README.md', 'prisma/schema.prisma', 'prisma/migrations/0001/migration.sql', 'src/db/client.ts',
    'src/app/api/wallets/route.ts', 'src/app/(auth)/login/page.tsx', 'messages/id.json', 'src/__tests__/a.test.ts',
    'node_modules/next/index.js', 'node_modules/pg/migrations/x.sql');
  return root;
}

describe('steer scan', () => {
  it('fingerprints the stack from manifests and folders, skipping node_modules', () => {
    const r = scan(nextProject());
    expect(r.profile.frameworks).toEqual(expect.arrayContaining(['next', 'prisma', 'next-auth', 'next-intl']));
    expect(r.profile.packageManager).toBe('pnpm');
    expect(r.profile.testRunner).toBe('vitest');
    expect(r.profile.languages[0]).toBe('typescript');
    expect(r.scanned.files).toBeLessThan(12);
  });

  it('suggests the core three as always and topic files with patterns from the folders it found', () => {
    const s = scan(nextProject()).suggestions;
    const by = Object.fromEntries(s.map(x => [x.file, x]));
    for (const f of ['product.md', 'tech.md', 'structure.md']) expect(by[f].inclusion).toBe('always');
    expect(by['database.md'].pattern).toBe('prisma/**,src/db/**');          // nested prisma/migrations folded into prisma/**
    expect(by['database.md'].reason).toContain('prisma');
    expect(by['database.md'].read).toContain('prisma/schema.prisma');
    expect(by['api.md'].pattern).toBe('src/app/api/**');
    expect(by['auth.md'].pattern).toBe('src/app/[(]auth[)]/**');           // glob-special chars escaped
    expect(by['i18n.md'].pattern).toBe('messages/**');
    expect(by['testing.md'].pattern).toContain('**/*.{test,spec}.*');
    expect(by['testing.md'].pattern).not.toContain('_test.go');            // extras that match nothing are dropped
    expect(by['infra.md']).toBeUndefined();
    expect(by['domain.md']).toBeUndefined();
    expect(by['database.md'].strength).toBe('strong');            // a dependency matched
    expect(by['api.md'].strength).toBe('weak');                   // one route file, no framework dep
    expect(by['api.md'].reason).toMatch(/weak: 1 file\)/);
    expect(by['product.md'].strength).toBe('core');
  });

  it('does not mistake a UI charts folder for Helm, and three files make a strong topic', () => {
    const root = mkdtempSync(join(tmpdir(), 'steno-charts-')); mkdirSync(join(root, '.steno'));
    touch(root, 'src/components/charts/bar.tsx', 'infra/main.tf', 'infra/vars.tf', 'infra/out.tf');
    const by = Object.fromEntries(scan(root).suggestions.map(x => [x.file, x]));
    expect(by['infra.md']).toMatchObject({ strength: 'strong', fileCount: 3, pattern: 'infra/**' });
  });

  it('calls an empty project greenfield and suggests only the core three', () => {
    const root = mkdtempSync(join(tmpdir(), 'steno-empty-'));
    mkdirSync(join(root, '.steno'));
    touch(root, 'AGENTS.md', 'README.md', '.agents/skills/x/SKILL.md', 'docs/plan.md');
    const r = scan(root);
    expect(r.greenfield).toBe(true);
    expect(r.suggestions.map(s => s.file)).toEqual(['product.md', 'tech.md', 'structure.md']);
    touch(root, 'src/a.ts', 'src/b.ts', 'src/c.ts');
    expect(scan(root).greenfield).toBe(false);          // three source files are enough to describe
    expect(scan(nextProject()).greenfield).toBe(false);  // a manifest alone is enough
  });
});

describe('steer new + list + lint', () => {
  it('writes a skeleton whose pattern really matches, and lint flags the placeholders', () => {
    const root = nextProject();
    const w = writeSteering(root, 'database');
    expect(w.inclusion).toBe('fileMatch');
    const text = readFileSync(w.path, 'utf8');
    expect(text).toMatch(/^---\ninclusion: fileMatch\nfileMatchPattern: "prisma\/\*\*,src\/db\/\*\*"\n---/);
    expect(text).toContain('## Migrations');
    expect(() => writeSteering(root, 'database')).toThrow(/exists/);
    expect(() => writeSteering(root, 'Bad Name')).toThrow(/kebab-case/);
    expect(() => writeSteering(root, 'custom', { inclusion: 'fileMatch' })).toThrow(/pattern/);

    const rows = listSteering(root).rows;
    expect(rows[0]).toMatchObject({ file: 'database.md', inclusion: 'fileMatch', matches: 3 });

    const issues = lintSteering(root);
    expect(issues.map(i => i.rule)).toEqual(['steering/placeholder']);
    expect(matchingSteering(loadSteering(root), ['src/db/client.ts']).map(s => s.file)).toEqual(['database.md']);
    expect(matchingSteering(loadSteering(root), ['src/ui/x.tsx'])).toEqual([]);
  });

  it('errors on bad frontmatter, warns on no-match and size, errors when always files exceed the budget', () => {
    const root = nextProject();
    const dir = join(root, '.steno', 'steering');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'a.md'), '---\ninclusion: sometimes\n---\nx');
    writeFileSync(join(dir, 'b.md'), '---\ninclusion: fileMatch\n---\nx');
    writeFileSync(join(dir, 'c.md'), '---\ninclusion: fileMatch\nfileMatchPattern: "nope/**"\n---\nx');
    writeFileSync(join(dir, 'big.md'), 'word '.repeat(3500));   // ~4375 tokens, over the 4000 budget on its own
    writeFileSync(join(dir, 'dump.md'), '```\n' + 'line\n'.repeat(20) + '```');
    writeFileSync(join(dir, 'database.md'), '---\ninclusion: fileMatch\nfileMatchPattern: "prisma/**"\n---\n# Database\nPostgres.\n```schema\n' + 't(id): a:int\n'.repeat(30) + '```\n' + 'Rule.\n'.repeat(500));
    const rules = lintSteering(root).map(i => `${i.level}:${i.rule}`);
    expect(rules).toEqual(expect.arrayContaining(['error:steering/inclusion', 'error:steering/pattern', 'warn:steering/no-match', 'warn:steering/size', 'warn:steering/code-dump', 'error:steering/budget']));
    expect(lintSteering(root).filter(i => i.file === 'steering/database.md')).toEqual([]);   // ~3.3 KB with a schema block: no size, no code-dump
  });

  it('warns when a file is too thin or packs facts into one bullet, and accepts a Kiro-sized file', () => {
    const root = nextProject();
    const dir = join(root, '.steno', 'steering');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'product.md'), '# Product\n- welfam: tracker; double-entry; budgets/bills/goals.\n');
    writeFileSync(join(dir, 'tech.md'), '# Tech stack\n\n## Core\n' + Array.from({ length: 30 }, (_, i) => `- **Lib${i} 1.${i}** — used for thing ${i} in src/lib/${i}.ts`).join('\n') + '\n\n## Commands\n```bash\nnpm test   # vitest\n```\n');
    writeFileSync(join(dir, 'structure.md'), '# Structure\n' + Array.from({ length: 40 }, (_, i) => `- folder ${i} holds the ${i}th kind of thing and nothing else at all`).join('\n') + '\n');
    const issues = lintSteering(root);
    expect(issues.filter(i => i.file === 'steering/product.md').map(i => i.rule).sort()).toEqual(['steering/packed', 'steering/thin']);
    expect(issues.filter(i => i.file === 'steering/tech.md')).toEqual([]);
    expect(issues.filter(i => i.file === 'steering/structure.md').map(i => i.rule)).toEqual(['steering/shape']);
  });

  it('prints the skeleton for an existing file without writing, with scan-derived frontmatter', () => {
    const root = nextProject();
    writeSteering(root, 'database');
    const t = templateFor(root, 'database');
    expect(t).toMatch(/^---\ninclusion: fileMatch\nfileMatchPattern: "prisma\/\*\*,src\/db\/\*\*"/);
    expect(templateFor(root, 'structure.md')).toContain('## Top-level layout');
    expect(readFileSync(join(root, '.steno', 'steering', 'database.md'), 'utf8')).toBe(t);
  });

  it('init-style saves keep defaults implicit', () => {
    const root = nextProject();
    saveConfig(root, { agents: ['claude'] });
    const raw = readFileSync(join(root, '.steno', 'config.yaml'), 'utf8');
    expect(raw).toContain('steeringBudget: 4000');   // from the template comment line, not a baked value
    expect(loadConfig(root).agents).toEqual(['claude']);
  });

  it('honours steeringDir so the folder can be shared with Kiro', () => {
    const root = nextProject();
    saveConfig(root, { ...loadConfig(root), steeringDir: '.kiro/steering' });
    const w = writeSteering(root, 'tech');
    expect(w.path).toBe(join(root, '.kiro', 'steering', 'tech.md'));
    expect(loadSteering(root).map(s => s.file)).toEqual(['tech.md']);
    expect(scan(root).suggestions.find(s => s.file === 'tech.md')?.exists).toBe(true);
  });
});

describe('patterns', () => {
  it('splits comma lists but not commas inside braces', () => {
    expect(splitPattern('a/**, b/**')).toEqual(['a/**', 'b/**']);
    expect(splitPattern('**/*.{test,spec}.*,src/**')).toEqual(['**/*.{test,spec}.*', 'src/**']);
  });
  it('escapes glob metacharacters in real paths', () => {
    expect(escapeGlob('app/(auth)/[id]')).toBe('app/[(]auth[)]/[[]id[]]');
  });
});

describe('steer scan: runners built into the runtime', () => {
  const projectWith = (scripts: Record<string, string>) => {
    const root = mkdtempSync(join(tmpdir(), 'steno-steer-'));
    writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts, devDependencies: { typescript: '5' } }));
    touch(root, 'src/a.ts', 'test/a.test.ts');
    return root;
  };

  it('recognises node:test, bun test and deno test from package.json scripts', () => {
    expect(scan(projectWith({ test: 'node --test "test/**/*.test.ts"' })).profile.testRunner).toBe('node:test');
    expect(scan(projectWith({ test: 'node --experimental-strip-types --test' })).profile.testRunner).toBe('node:test');
    expect(scan(projectWith({ test: 'bun test' })).profile.testRunner).toBe('bun test');
    expect(scan(projectWith({ check: 'deno test -A' })).profile.testRunner).toBe('deno test');
  });

  it('leaves the runner unknown when no script runs tests', () => {
    expect(scan(projectWith({ start: 'node src/a.ts', build: 'tsc && node --version' })).profile.testRunner).toBeUndefined();
  });
});

describe('steering frontmatter with CRLF', () => {
  it('reads inclusion and pattern from a CRLF file', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const { loadSteering } = await import('../src/index.js');
    const r = mkdtempSync(join(tmpdir(), 'steno-crlf-'));
    mkdirSync(join(r, '.steno', 'steering'), { recursive: true });
    writeFileSync(join(r, '.steno', 'steering', 'db.md'), '---\r\ninclusion: fileMatch\r\nfileMatchPattern: "src/db/**"\r\n---\r\n# DB\r\nUse migrations.\r\n');
    const [s] = loadSteering(r);
    expect(s.inclusion).toBe('fileMatch');
    expect(s.pattern).toBe('src/db/**');
    expect(s.body.startsWith('# DB')).toBe(true);
  });
});
