/**
 * The scripted part of steering generation. `scan` looks at manifests and directory names (it never
 * reads source), suggests which steering files the project needs, and lists the few files worth
 * reading for each one. The agent then writes the actual text (see the steno-steer skill).
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import picomatch from 'picomatch';
import { loadConfig, steeringRoot } from './config.js';
import { loadSteering, splitPattern, type Steering } from './steering.js';
import { estimateTokens } from './tokens.js';
import type { LintIssue } from './types.js';

// ---------------------------------------------------------------- probe

export interface Probe {
  root: string;
  /** Relative paths of every file seen, forward slashes, capped. */
  files: string[];
  /** Relative paths of every directory seen. */
  dirs: string[];
  /** Dependency names from every manifest found (npm, pip, go, cargo, gem, composer, pub, gradle, maven). */
  deps: Set<string>;
  /** Manifest files found, relative. */
  manifests: string[];
  /** Script commands from every package.json found; used to spot test runners that are not dependencies. */
  scripts?: string[];
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', 'coverage', 'vendor', 'target', '.next', '.nuxt', '.svelte-kit', '.turbo', '.cache', '.venv', 'venv', '__pycache__', '.idea', '.vscode', '.gradle', 'Pods', 'DerivedData', '.dart_tool', 'tmp']);
const MAX_DEPTH = 7, MAX_FILES = 6000;

const MANIFESTS = ['package.json', 'requirements.txt', 'pyproject.toml', 'Pipfile', 'go.mod', 'Cargo.toml', 'Gemfile', 'composer.json', 'pubspec.yaml', 'build.gradle', 'build.gradle.kts', 'pom.xml', 'mix.exs', 'Package.swift'];

export function probe(root: string): Probe {
  const files: string[] = [], dirs: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > MAX_DEPTH || files.length >= MAX_FILES) return;
    let entries: string[] = [];
    try { entries = readdirSync(dir); } catch { return; }
    for (const name of entries.sort()) {
      if (files.length >= MAX_FILES) return;
      const abs = join(dir, name);
      let st; try { st = statSync(abs); } catch { continue; }
      const rel = relative(root, abs).split('\\').join('/');
      if (st.isDirectory()) {
        if (SKIP_DIRS.has(name) || (name.startsWith('.') && !['.github', '.gitlab', '.circleci'].includes(name))) continue;
        dirs.push(rel);
        walk(abs, depth + 1);
      } else files.push(rel);
    }
  };
  walk(root, 0);
  const deps = new Set<string>();
  const manifests: string[] = [];
  const scripts: string[] = [];
  for (const f of files) {
    const base = basename(f);
    if (!MANIFESTS.includes(base) || f.split('/').length > 3) continue;
    manifests.push(f);
    let text = ''; try { text = readFileSync(join(root, f), 'utf8'); } catch { continue; }
    for (const d of depsOf(base, text)) deps.add(d.toLowerCase());
    if (base === 'package.json') {
      try { scripts.push(...Object.values((JSON.parse(text) as { scripts?: Record<string, unknown> }).scripts ?? {}).filter((v): v is string => typeof v === 'string')); } catch { /* unreadable manifest: no scripts */ }
    }
  }
  return { root, files, dirs, deps, manifests, scripts };
}

function depsOf(manifest: string, text: string): string[] {
  if (manifest === 'package.json') {
    try {
      const j = JSON.parse(text) as Record<string, Record<string, string> | undefined>;
      return [...Object.keys(j.dependencies ?? {}), ...Object.keys(j.devDependencies ?? {}), ...Object.keys(j.peerDependencies ?? {})];
    } catch { return []; }
  }
  if (manifest === 'composer.json') {
    try { const j = JSON.parse(text) as Record<string, Record<string, string> | undefined>; return [...Object.keys(j.require ?? {}), ...Object.keys(j['require-dev'] ?? {})]; } catch { return []; }
  }
  if (manifest === 'requirements.txt' || manifest === 'Pipfile') return text.split('\n').map(l => /^\s*([A-Za-z0-9_.-]+)/.exec(l)?.[1] ?? '').filter(Boolean);
  if (manifest === 'pyproject.toml') return [...text.matchAll(/^\s*"?([A-Za-z0-9_.-]+)"?\s*(?:[>=<~!]=|\s*=\s*["{]|,|"$|$)/gm)].map(m => m[1]).filter(d => !['name', 'version', 'python', 'description', 'readme', 'requires', 'build-backend', 'authors', 'license'].includes(d));
  if (manifest === 'go.mod') return [...text.matchAll(/^\s*([\w.-]+(?:\/[\w.-]+)+)\s+v/gm)].map(m => m[1]);
  if (manifest === 'Cargo.toml') return [...text.matchAll(/^([A-Za-z0-9_-]+)\s*=/gm)].map(m => m[1]);
  if (manifest === 'Gemfile') return [...text.matchAll(/^\s*gem\s+['"]([^'"]+)['"]/gm)].map(m => m[1]);
  if (manifest === 'pubspec.yaml') return [...text.matchAll(/^  ([a-z0-9_]+):/gm)].map(m => m[1]);
  if (manifest.startsWith('build.gradle')) return [...text.matchAll(/['"]([a-zA-Z0-9_.-]+:[a-zA-Z0-9_.-]+)(?::[^'"]+)?['"]/g)].map(m => m[1]);
  if (manifest === 'pom.xml') return [...text.matchAll(/<artifactId>([^<]+)<\/artifactId>/g)].map(m => m[1]);
  if (manifest === 'mix.exs') return [...text.matchAll(/\{:([a-z_]+),/g)].map(m => m[1]);
  if (manifest === 'Package.swift') return [...text.matchAll(/url:\s*"[^"]*\/([^/"]+?)(?:\.git)?"/g)].map(m => m[1]);
  return [];
}

// ---------------------------------------------------------------- profile

export interface Profile {
  languages: string[];
  frameworks: string[];
  packageManager?: string;
  testRunner?: string;
  monorepo: boolean;
  topLevel: { dir: string; files: number }[];
  manifests: string[];
}

const LANG_EXT: Record<string, string> = { ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript', mjs: 'javascript', py: 'python', go: 'go', rs: 'rust', rb: 'ruby', php: 'php', dart: 'dart', kt: 'kotlin', kts: 'kotlin', java: 'java', swift: 'swift', ex: 'elixir', exs: 'elixir', cs: 'csharp', sql: 'sql', vue: 'vue', svelte: 'svelte' };

const FRAMEWORKS: [string, string][] = [
  ['next', 'next'], ['nuxt', 'nuxt'], ['@remix-run/react', 'remix'], ['@sveltejs/kit', 'sveltekit'], ['astro', 'astro'], ['@angular/core', 'angular'],
  ['react', 'react'], ['vue', 'vue'], ['svelte', 'svelte'], ['solid-js', 'solid'], ['vite', 'vite'], ['expo', 'expo'], ['react-native', 'react-native'],
  ['express', 'express'], ['fastify', 'fastify'], ['hono', 'hono'], ['koa', 'koa'], ['@nestjs/core', 'nestjs'], ['@trpc/server', 'trpc'],
  ['django', 'django'], ['fastapi', 'fastapi'], ['flask', 'flask'], ['rails', 'rails'], ['laravel/framework', 'laravel'], ['flutter', 'flutter'],
  ['github.com/gin-gonic/gin', 'gin'], ['github.com/labstack/echo/v4', 'echo'], ['github.com/gofiber/fiber/v2', 'fiber'], ['actix-web', 'actix'], ['axum', 'axum'],
  ['phoenix', 'phoenix'], ['org.springframework.boot:spring-boot-starter', 'spring-boot'], ['androidx.compose.ui:ui', 'jetpack-compose'],
  ['@prisma/client', 'prisma'], ['prisma', 'prisma'], ['drizzle-orm', 'drizzle'], ['typeorm', 'typeorm'], ['sequelize', 'sequelize'], ['mongoose', 'mongoose'], ['knex', 'knex'], ['kysely', 'kysely'],
  ['tailwindcss', 'tailwind'], ['@mui/material', 'mui'], ['@chakra-ui/react', 'chakra'],
  ['next-auth', 'next-auth'], ['@auth/core', 'auth.js'], ['lucia', 'lucia'], ['better-auth', 'better-auth'], ['@clerk/nextjs', 'clerk'], ['passport', 'passport'],
  ['next-intl', 'next-intl'], ['i18next', 'i18next'], ['react-intl', 'react-intl'], ['vue-i18n', 'vue-i18n'],
];

const LOCKS: [string, string][] = [['pnpm-lock.yaml', 'pnpm'], ['yarn.lock', 'yarn'], ['bun.lockb', 'bun'], ['bun.lock', 'bun'], ['package-lock.json', 'npm'], ['uv.lock', 'uv'], ['poetry.lock', 'poetry'], ['Pipfile.lock', 'pipenv'], ['requirements.txt', 'pip'], ['go.sum', 'go modules'], ['Cargo.lock', 'cargo'], ['Gemfile.lock', 'bundler'], ['composer.lock', 'composer'], ['pubspec.lock', 'pub'], ['gradlew', 'gradle'], ['pom.xml', 'maven'], ['mix.lock', 'mix']];
/** Runners built into a runtime: they never appear as a dependency, only in a script command. */
const BUILTIN_RUNNERS: [RegExp, string][] = [[/\bnode\b[^&|;]*\s--test\b/, 'node:test'], [/\bbun\s+test\b/, 'bun test'], [/\bdeno\s+test\b/, 'deno test']];
const RUNNERS: [string, string][] = [['vitest', 'vitest'], ['jest', 'jest'], ['mocha', 'mocha'], ['@playwright/test', 'playwright'], ['cypress', 'cypress'], ['pytest', 'pytest'], ['rspec', 'rspec'], ['phpunit/phpunit', 'phpunit'], ['flutter_test', 'flutter test'], ['junit:junit', 'junit'], ['org.junit.jupiter:junit-jupiter', 'junit5']];

export function profileOf(p: Probe): Profile {
  const ext: Record<string, number> = {};
  for (const f of p.files) { const e = f.split('.').pop() ?? ''; const l = LANG_EXT[e]; if (l) ext[l] = (ext[l] ?? 0) + 1; }
  if (p.files.some(f => /^go\.mod$/.test(f))) ext.go = (ext.go ?? 0) + 1;
  const languages = Object.entries(ext).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([l]) => l);
  const frameworks = [...new Set(FRAMEWORKS.filter(([dep]) => p.deps.has(dep.toLowerCase())).map(([, name]) => name))];
  const has = (f: string) => p.files.includes(f);
  const packageManager = LOCKS.find(([f]) => has(f))?.[1];
  const testRunner = RUNNERS.find(([dep]) => p.deps.has(dep.toLowerCase()))?.[1] ?? BUILTIN_RUNNERS.find(([re]) => (p.scripts ?? []).some(c => re.test(c)))?.[1]
    ?? (p.files.some(f => /_test\.go$/.test(f)) ? 'go test' : undefined);
  const monorepo = has('pnpm-workspace.yaml') || has('turbo.json') || has('nx.json') || has('lerna.json') || p.dirs.includes('packages') || p.dirs.includes('apps');
  const counts: Record<string, number> = {};
  for (const f of p.files) { const top = f.includes('/') ? f.slice(0, f.indexOf('/')) + '/' : '(root)'; counts[top] = (counts[top] ?? 0) + 1; }
  const topLevel = Object.entries(counts).map(([dir, files]) => ({ dir, files })).sort((a, b) => b.files - a.files);
  return { languages, frameworks, packageManager, testRunner, monorepo, topLevel, manifests: p.manifests };
}

// ---------------------------------------------------------------- detectors

export interface Suggestion {
  file: string;
  inclusion: Steering['inclusion'];
  /** `core`: always suggested. `strong`: a dependency matched, or 3 or more files back it up. `weak`: one or two files; offered, not written by `--all`. */
  strength: 'core' | 'strong' | 'weak';
  /** Files found behind the evidence (under matched folders plus matched files). */
  fileCount: number;
  pattern?: string;
  reason: string;
  read: string[];
  exists: boolean;
}

interface Detector {
  file: string;
  inclusion: Steering['inclusion'];
  /** Dependency names (lower-case, any ecosystem) that trigger it. */
  deps?: string[];
  /** Directory basenames or relative paths that trigger it. Each becomes part of the pattern. */
  dirs?: string[];
  /** Globs over files that trigger it. Matched files are offered as `read`. */
  files?: string[];
  /** Extra globs always added to the pattern when triggered. */
  extraPattern?: string[];
  /** Always suggested; `read` lists what to look at. */
  core?: (p: Probe, prof: Profile) => string[];
}

const DETECTORS: Detector[] = [
  { file: 'product.md', inclusion: 'always', core: (p) => p.files.filter(f => /^(readme\.md|docs\/[^/]+\.md|package\.json|pyproject\.toml)$/i.test(f)).slice(0, 6) },
  { file: 'tech.md', inclusion: 'always', core: (p) => [...p.manifests, ...p.files.filter(f => /^(tsconfig\.json|\.nvmrc|\.tool-versions|Makefile|justfile|Taskfile\.ya?ml|\.github\/workflows\/[^/]+)$/.test(f))].slice(0, 8) },
  { file: 'structure.md', inclusion: 'always', core: (p) => p.dirs.filter(d => d.split('/').length <= 2).slice(0, 25) },
  {
    file: 'database.md', inclusion: 'fileMatch',
    deps: ['prisma', '@prisma/client', 'drizzle-orm', 'knex', 'sequelize', 'typeorm', 'mongoose', '@mikro-orm/core', 'kysely', 'pg', 'mysql2', 'better-sqlite3', 'sqlalchemy', 'alembic', 'django', 'peewee', 'tortoise-orm', 'gorm.io/gorm', 'entgo.io/ent', 'github.com/jmoiron/sqlx', 'sqlx', 'diesel', 'sea-orm', 'activerecord', 'pg', 'mysql', 'doctrine/orm', 'illuminate/database', 'drift', 'floor', 'isar', 'hive', 'sqflite', 'realm', 'androidx.room:room-runtime', 'ecto', 'ecto_sql', '@supabase/supabase-js', 'firebase-admin', 'convex'],
    dirs: ['prisma', 'drizzle', 'migrations', 'migrate', 'db', 'database', 'alembic', 'models', 'entities', 'schema', 'supabase'],
    files: ['**/schema.prisma', '**/*.sql', '**/drizzle.config.*', '**/knexfile.*', '**/alembic.ini', '**/*.dbml'],
  },
  {
    file: 'api.md', inclusion: 'fileMatch',
    deps: ['express', 'fastify', 'hono', 'koa', '@nestjs/core', '@trpc/server', 'graphql', '@apollo/server', 'fastapi', 'flask', 'djangorestframework', 'github.com/gin-gonic/gin', 'github.com/labstack/echo/v4', 'github.com/gofiber/fiber/v2', 'actix-web', 'axum', 'grpc', '@grpc/grpc-js'],
    dirs: ['api', 'routes', 'controllers', 'handlers', 'endpoints', 'resolvers', 'server/api', 'app/api', 'pages/api', 'src/api'],
    files: ['**/openapi.{yaml,yml,json}', '**/swagger.{yaml,yml,json}', '**/*.graphql', '**/*.gql', '**/*.proto'],
  },
  {
    file: 'auth.md', inclusion: 'fileMatch',
    deps: ['next-auth', '@auth/core', 'lucia', 'better-auth', '@clerk/nextjs', '@clerk/clerk-react', 'passport', 'jsonwebtoken', 'jose', '@supabase/auth-helpers-nextjs', '@supabase/ssr', 'firebase', 'django-allauth', 'devise', 'org.springframework.boot:spring-boot-starter-security', 'firebase_auth', 'guardian'],
    dirs: ['auth', 'authentication', '(auth)', 'sessions'],
    files: ['**/auth.config.*', '**/lib/auth.{ts,js}', '**/auth/[[]...nextauth[]]/**'],
  },
  {
    file: 'i18n.md', inclusion: 'fileMatch',
    deps: ['next-intl', 'i18next', 'react-i18next', 'react-intl', 'vue-i18n', '@lingui/core', 'intl', 'flutter_localizations', 'django-modeltranslation', 'rails-i18n', 'gettext'],
    dirs: ['locales', 'locale', 'messages', 'i18n', 'lang', 'translations', 'l10n'],
    files: ['**/*.arb', '**/i18n.config.*', '**/*.po'],
  },
  {
    file: 'ui.md', inclusion: 'fileMatch',
    deps: ['tailwindcss', '@mui/material', '@chakra-ui/react', 'styled-components', '@emotion/react', '@radix-ui/react-dialog', 'shadcn', 'vuetify', 'primevue', '@mantine/core', 'antd'],
    dirs: ['components', 'ui', 'design-system', 'styles', 'theme', 'widgets', 'presentation'],
    files: ['**/tailwind.config.*', '**/components.json', '**/*.css', '**/*.scss'],
    extraPattern: ['**/*.{tsx,jsx,vue,svelte}'],
  },
  {
    file: 'testing.md', inclusion: 'fileMatch',
    deps: ['vitest', 'jest', 'mocha', '@playwright/test', 'cypress', '@testing-library/react', 'pytest', 'rspec', 'phpunit/phpunit', 'flutter_test', 'junit:junit', 'org.junit.jupiter:junit-jupiter', 'github.com/stretchr/testify'],
    dirs: ['test', 'tests', '__tests__', 'e2e', 'spec', 'cypress', 'playwright', 'fixtures', 'testutil'],
    files: ['**/vitest.config.*', '**/jest.config.*', '**/playwright.config.*', '**/pytest.ini', '**/conftest.py', '**/.rspec'],
    extraPattern: ['**/*.{test,spec}.*', '**/*_test.go', '**/test_*.py'],
  },
  {
    file: 'infra.md', inclusion: 'fileMatch',
    dirs: ['terraform', 'infra', 'infrastructure', 'deploy', 'k8s', 'kubernetes', 'helm', 'cdk', 'pulumi', 'ansible', 'docker'],
    files: ['**/Chart.yaml', '**/Dockerfile*', '**/docker-compose*.{yml,yaml}', '**/compose.{yml,yaml}', '**/*.tf', '**/cdk.json', '**/serverless.{yml,yaml}', '**/fly.toml', '**/vercel.json', '**/render.yaml', '**/Procfile', '**/netlify.toml'],
  },
  {
    file: 'ci.md', inclusion: 'fileMatch',
    dirs: ['.github/workflows', '.circleci', '.gitlab'],
    files: ['**/.gitlab-ci.yml', '**/Jenkinsfile', '**/bitbucket-pipelines.yml', '**/.github/workflows/*', '**/azure-pipelines.yml', '**/.pre-commit-config.yaml'],
  },
  {
    file: 'messaging.md', inclusion: 'fileMatch',
    deps: ['bullmq', 'bull', 'kafkajs', 'amqplib', '@aws-sdk/client-sqs', 'celery', 'sidekiq', 'github.com/segmentio/kafka-go', 'github.com/nats-io/nats.go', 'rdkafka', 'oban', 'broadway'],
    dirs: ['jobs', 'workers', 'queues', 'consumers', 'subscribers'],
  },
  {
    file: 'domain.md', inclusion: 'fileMatch',
    dirs: ['domain', 'usecases', 'use_cases', 'use-cases'],
  },
];

/** Known template names, in suggestion order. */
export const STEERING_TOPICS = DETECTORS.map(d => d.file);

function globAny(files: string[], globs: string[]): string[] {
  const m = picomatch(globs, { dot: true });
  return files.filter(f => m(f));
}

/** Paths may contain glob-special characters (Next.js `(auth)`, `[id]`); bracket them so the glob matches literally. */
export function escapeGlob(path: string): string {
  return path.replace(/[()[\]{}!+@?*]/g, ch => `[${ch}]`);
}

function dirHits(p: Probe, names: string[]): string[] {
  return p.dirs.filter(d => {
    const base = d.split('/').pop()!;
    return names.some(n => n.includes('/') ? d === n || d.endsWith('/' + n) : base === n) && d.split('/').length <= 3;
  });
}

export function suggest(p: Probe, prof = profileOf(p)): Suggestion[] {
  const existing = new Set(loadSteering(p.root).map(s => s.file));
  const out: Suggestion[] = [];
  for (const d of DETECTORS) {
    if (d.core) {
      out.push({ file: d.file, inclusion: 'always', strength: 'core', fileCount: 0, reason: 'core (every project)', read: d.core(p, prof), exists: existing.has(d.file) });
      continue;
    }
    const deps = (d.deps ?? []).filter(x => p.deps.has(x.toLowerCase()));
    const allDirs = dirHits(p, d.dirs ?? []);
    const dirs = allDirs.filter(x => !allDirs.some(y => y !== x && x.startsWith(y + '/')));   // drop children of another hit
    const files = d.files ? globAny(p.files, d.files) : [];
    if (!deps.length && !dirs.length && !files.length) continue;
    const extras = (d.extraPattern ?? []).filter(g => globAny(p.files, [g]).length);
    const pattern = [...new Set([...dirs.map(x => `${escapeGlob(x)}/**`), ...(dirs.length ? [] : files.map(f => f.includes('/') ? escapeGlob(f.slice(0, f.lastIndexOf('/'))) + '/**' : escapeGlob(f))), ...extras])].slice(0, 6).join(',');
    const reason = [deps.length ? `deps: ${deps.slice(0, 3).join(', ')}` : '', dirs.length ? `dirs: ${dirs.slice(0, 3).join(', ')}` : '', files.length && !dirs.length ? `files: ${files.slice(0, 2).join(', ')}` : ''].filter(Boolean).join('; ');
    const read = [...new Set([...files, ...dirs.map(x => x + '/')])].slice(0, 6);
    const behind = new Set(files); for (const dir of dirs) for (const f of p.files) if (f.startsWith(dir + '/')) behind.add(f);
    const fileCount = behind.size;
    const strength: Suggestion['strength'] = deps.length || fileCount >= 3 ? 'strong' : 'weak';
    out.push({ file: d.file, inclusion: d.inclusion, strength, fileCount, pattern: pattern || undefined, reason: strength === 'weak' ? `${reason} (weak: ${fileCount} file${fileCount === 1 ? '' : 's'})` : reason, read, exists: existing.has(d.file) });
  }
  return out;
}

export interface Scan { profile: Profile; suggestions: Suggestion[]; scanned: { files: number; dirs: number }; /** No manifests and almost no source: nothing to record yet. */ greenfield: boolean; sourceFiles: number }

/** Source files: anything that is not docs, config or agent plumbing. */
export function sourceFiles(p: Probe): string[] {
  return p.files.filter(f => !/\.(md|txt|ya?ml|json|toml|lock|ini|cfg|env|example)$/i.test(f) && !/^(\.agents|\.claude|\.cursor|\.github|\.gemini|\.kiro|\.steno|docs)\//.test(f) && !/^(AGENTS|CLAUDE|README|LICENSE)/i.test(f));
}

/** A folder with no manifest and fewer than three source files has nothing to write steering about yet. */
export function isGreenfield(p: Probe): boolean {
  return p.manifests.length === 0 && sourceFiles(p).length < 3;
}

export const GREENFIELD_MSG = 'greenfield: no manifest and no source yet. Steering records facts about existing code, so there is nothing to record. Start with a brief (steno-brainstorm) or a spec (steno-spec); run `steno steer scan` again once the first tasks or a manifest exist.';

export function scan(root: string): Scan {
  const p = probe(root);
  const profile = profileOf(p);
  return { profile, suggestions: suggest(p, profile), scanned: { files: p.files.length, dirs: p.dirs.length }, greenfield: isGreenfield(p), sourceFiles: sourceFiles(p).length };
}

// ---------------------------------------------------------------- templates

/**
 * Skeletons for each steering file. The core three (product, tech, structure) follow the same
 * layout as Kiro's and hint at how much to write, since a near-empty file doesn't help anyone.
 * Placeholders look like `<...>`, and lint reports any that are left in.
 */
const CORE_TEMPLATES: Record<string, string> = {
  'product.md': `# Product — <name>

**<name>** is <one sentence: what kind of thing it is (web app, CLI, API, mobile PWA), where it runs or its URL, and what it lets whom do>.

## Core problem
<two or three sentences: the situation without it, and what it changes. Written for someone who has never seen the app.>

## Key features
- **<Feature>** — <what it does, with the specifics that matter: limits, formats, code lengths, supported types>
- **<Feature>** — <…>
- **<Feature>** — <…>
<5–10 bullets, one per user-visible capability. Every feature a spec might touch gets a line.>

## Audience
<who uses it, primary and secondary; locales and the default locale; platforms>

## Domain model and rules
<the concepts and invariants everything else obeys, in plain words with the real term names: e.g. "Strict double-entry: every transaction satisfies ΣDebits = ΣCredits; users see Income / Expense / Transfer, never debit/credit", base vs account currency, tenancy model. Several short paragraphs or bullets.>

## Out of scope
<what it deliberately does not do, so specs do not drift into it>
`,
  'tech.md': `# Tech stack

## <Layer, e.g. Core framework>
- **<Library> <version>** — <what it is used for; the one or two features of it relied on>
- **<Library> <version>** — <…>
<one \`## Layer\` section per concern: framework, language, database and auth, styling and UI, state and data, testing, build and deploy. Versions from the manifest, not from memory. 3–6 bullets each.>

## Commands
\`\`\`bash
<script>   # <what it does, when to run it>
<script>   # <…>
\`\`\`
<every script in the manifest plus the db / infra commands a task might need; one comment each>

## Key config files
- \`<path>\` — <what it configures>

## Conventions
- <rule the code actually follows: strict TS, no \`any\`, validation lib on every mutation, error shape, lint setup>

## Do not
- <the alternatives a newcomer would reach for and must not: wrong ORM, bypassing auth layer, hardcoded strings>
`,
  'structure.md': `# Project structure

## Top-level layout
\`\`\`
<dir>/
  <sub>/      # <responsibility, one phrase>
  <sub>/      # <…>
<file>        # <…>
\`\`\`
<every top-level folder and the important files, two levels deep, each with a comment>

## \`<main source dir>/<area>/\` — <role>
<for each major area: what lives there, what it may depend on, its internal layout as a short tree or a table of subfolder → responsibility. Repeat the section per area (domain, features, app, components, lib, …).>

| Subdirectory | Responsibility |
|---|---|
| \`<sub>/\` | <…> |

## Where new code goes
- <kind of change> → \`<path pattern>\` (<and the test location>)

## Key conventions
- **<Rule>:** <the concrete form, naming the helper, component or file to use and what never to do instead>
<6–10 bullets: data fetching vs mutation paths, session/auth helper, shared inputs and formatters, i18n, db changes. These are the rules a reviewer would cite.>
`,
};

const TOPIC_HEADINGS: Record<string, string[]> = {
  'database.md': ['Engine and client', 'Tables', 'Schema conventions', 'Migrations', 'Invariants', 'Query patterns', 'Seeds and test data'],
  'api.md': ['Style', 'Request and response shape', 'Errors', 'Auth and middleware', 'Versioning', 'Adding an endpoint'],
  'auth.md': ['Mechanism', 'Session and token rules', 'Roles and permissions', 'Protected routes', 'Do not'],
  'i18n.md': ['Locales', 'Where strings live', 'Adding a string', 'Formatting (dates, numbers, currency)', 'Do not'],
  'ui.md': ['Component library', 'Layout and spacing', 'Theming and tokens', 'State and forms', 'Accessibility', 'Do not'],
  'testing.md': ['Runner and commands', 'Where tests live', 'Unit vs integration vs e2e', 'Fixtures and factories', 'What every change must cover'],
  'infra.md': ['Environments', 'How it is deployed', 'Config and secrets', 'Local run', 'Do not'],
  'ci.md': ['Pipelines', 'What must pass', 'How to add a check', 'Caching and secrets'],
  'messaging.md': ['Broker and client', 'Topics, queues and jobs', 'Message shape', 'Retries and idempotency', 'Adding a consumer'],
  'domain.md': ['Bounded contexts', 'Core entities', 'Invariants', 'Use-case shape', 'Boundaries'],
};
const GENERIC = ['Purpose', 'Rules', 'Patterns to reuse', 'Do not'];

export const CORE_FILES = Object.keys(CORE_TEMPLATES);

export function steeringTemplate(file: string, inclusion: Steering['inclusion'], pattern?: string): string {
  const name = file.replace(/\.md$/, '');
  const fm = inclusion === 'always' ? '' : `---\ninclusion: ${inclusion}${pattern ? `\nfileMatchPattern: "${pattern}"` : ''}\n---\n`;
  if (CORE_TEMPLATES[file]) return fm + CORE_TEMPLATES[file];
  const heads = TOPIC_HEADINGS[file] ?? GENERIC;
  const HINT: Record<string, string> = { Tables: '<paste the output of `steno steer schema` in a ```schema fenced block: one line per table with foreign keys, the enums, and the parent ← children summary. Drop columns nobody queries; keep every arrow. Add one line per relation that needs words (ownership, cascade, polymorphism).>' };
  return `${fm}# ${name[0].toUpperCase() + name.slice(1)}

<two or three sentences: what this area is, which files it covers, and the one thing an agent most often gets wrong here. Only what product/tech/structure do not already say.>

${heads.map(h => `## ${h}\n${HINT[h] ?? '- <fact: the real path, command, helper or name, and the rule around it>\n- <…>'}`).join('\n\n')}
`;
}

/** The skeleton `steno steer new` would write for `file`, with the frontmatter scan suggests. */
export function templateFor(root: string, file: string): string {
  if (!file.endsWith('.md')) file += '.md';
  const s = suggest(probe(root)).find(s => s.file === file);
  return steeringTemplate(file, s?.inclusion ?? (CORE_TEMPLATES[file] ? 'always' : 'fileMatch'), s?.pattern);
}

export function writeSteering(root: string, file: string, opts: { inclusion?: Steering['inclusion']; pattern?: string; force?: boolean } = {}): { path: string; inclusion: Steering['inclusion']; pattern?: string } {
  if (!file.endsWith('.md')) file += '.md';
  if (!/^[a-z0-9][a-z0-9-]*\.md$/.test(file)) throw new Error(`steering file name must be kebab-case: ${file}`);
  const dir = steeringRoot(root);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, file);
  if (existsSync(path) && !opts.force) throw new Error(`${relative(root, path)} exists (use --force to overwrite)`);
  let inclusion = opts.inclusion, pattern = opts.pattern;
  if (!inclusion || (inclusion === 'fileMatch' && !pattern)) {
    const s = suggest(probe(root)).find(s => s.file === file);
    inclusion ??= s?.inclusion ?? (pattern ? 'fileMatch' : 'always');
    if (inclusion === 'fileMatch') pattern ??= s?.pattern;
  }
  if (inclusion === 'fileMatch' && !pattern) throw new Error(`fileMatch needs a pattern: --match "src/x/**"`);
  writeFileSync(path, steeringTemplate(file, inclusion, pattern));
  return { path, inclusion, pattern };
}

// ---------------------------------------------------------------- lint and list

export const STEERING_MAX_BYTES = 4096;
const MAX_BYTES_BY_FILE: Record<string, number> = { 'database.md': 6144 };
export const STEERING_THIN_BYTES: Record<string, number> = { 'product.md': 1200, 'tech.md': 1200, 'structure.md': 2000 };
const THIN_TOPIC_BYTES = 350;

export interface SteeringRow { file: string; inclusion: Steering['inclusion']; pattern?: string; tokens: number; bytes: number; matches?: number }

export function listSteering(root: string, p = probe(root)): { rows: SteeringRow[]; alwaysTokens: number; budget: number } {
  const cfg = loadConfig(root);
  const rows = loadSteering(root).map(s => {
    const bytes = Buffer.byteLength(s.body, 'utf8');
    const matches = s.inclusion === 'fileMatch' && s.pattern ? globAny(p.files, splitPattern(s.pattern)).length : undefined;
    return { file: s.file, inclusion: s.inclusion, pattern: s.pattern, tokens: estimateTokens(s.body), bytes, matches };
  });
  const alwaysTokens = rows.filter(r => r.inclusion === 'always').reduce((n, r) => n + r.tokens, 0);
  return { rows, alwaysTokens, budget: cfg.steeringBudget };
}

export function lintSteering(root: string, p = probe(root)): LintIssue[] {
  const issues: LintIssue[] = [];
  const dir = steeringRoot(root);
  const { rows, alwaysTokens, budget } = listSteering(root, p);
  for (const s of loadSteering(root)) {
    const file = `steering/${s.file}`;
    const raw = readFileSync(join(dir, s.file), 'utf8');
    const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw)?.[1];
    if (fm) {
      const inc = /inclusion:\s*(\S+)/.exec(fm)?.[1];
      if (inc && !['always', 'fileMatch', 'manual'].includes(inc)) issues.push({ level: 'error', rule: 'steering/inclusion', file, msg: `unknown inclusion "${inc}" (always | fileMatch | manual)` });
      if (inc === 'fileMatch' && !s.pattern) issues.push({ level: 'error', rule: 'steering/pattern', file, msg: 'inclusion: fileMatch needs fileMatchPattern' });
    }
    const row = rows.find(r => r.file === s.file)!;
    if (row.matches === 0) issues.push({ level: 'warn', rule: 'steering/no-match', file, msg: `fileMatchPattern "${s.pattern}" matches no file in the repo` });
    const maxBytes = MAX_BYTES_BY_FILE[s.file] ?? STEERING_MAX_BYTES;
    if (row.bytes > maxBytes) issues.push({ level: 'warn', rule: 'steering/size', file, msg: `${row.bytes} bytes; keep under ${maxBytes} (split by topic or move detail to a manual file)` });
    const lines = s.body.split('\n');
    let inFence = false;
    const ph = lines.findIndex(l => {
      if (/^\s*```/.test(l)) { inFence = !inFence; return false; }
      return !inFence && /<[^>\s/][^>]*>/.test(l) && !/^\s*<\/?[a-z]+[\s>]/.test(l) && !/`[^`]*<[^`]*>[^`]*`/.test(l);
    });
    if (ph >= 0) issues.push({ level: 'warn', rule: 'steering/placeholder', file, line: ph + 1, msg: 'template placeholder still present' });
    const thin = STEERING_THIN_BYTES[s.file] ?? THIN_TOPIC_BYTES;
    if (ph < 0 && row.bytes < thin && s.body.trim()) issues.push({ level: 'warn', rule: 'steering/thin', file, msg: `${row.bytes} bytes; too thin to brief an agent. Aim ${STEERING_THIN_BYTES[s.file] ? '1.5–4' : '0.5–1.5'} KB of specific facts: names, versions, paths, limits, one bullet per fact` });
    // A section whose only bullet is a semicolon chain is a list that was squashed into a line.
    const sections: number[][] = [[]];
    lines.forEach((l, i) => { if (/^#{1,6}\s/.test(l)) sections.push([]); else if (/^\s*-\s/.test(l)) sections[sections.length - 1].push(i); });
    const packed = sections.find(b => b.length === 1 && (lines[b[0]].match(/;/g) ?? []).length >= 2)?.[0];
    if (packed !== undefined) issues.push({ level: 'warn', rule: 'steering/packed', file, line: packed + 1, msg: 'a whole section squashed into one semicolon-chained bullet; one bullet per fact' });
    let fence = -1, exempt = false;   // a ```schema block (from `steno steer schema`) belongs in database.md, so don't flag it as a code dump
    lines.forEach((l, i) => {
      if (/^\s*```/.test(l)) { if (fence < 0) { fence = i; exempt = /^\s*```schema\b/.test(l); } else { if (i - fence > 16 && !exempt) issues.push({ level: 'warn', rule: 'steering/code-dump', file, line: fence + 1, msg: `${i - fence - 1}-line code block; name the file instead so ctx can fetch it` }); fence = -1; } }
    });
    if (!s.body.trim()) issues.push({ level: 'warn', rule: 'steering/empty', file, msg: 'empty' });
    if (ph < 0 && s.file === 'structure.md' && !/^\s*```/m.test(s.body) && !/^\|.*\|\s*$/m.test(s.body)) issues.push({ level: 'warn', rule: 'steering/shape', file, msg: 'no tree or table: show the layout (a fenced tree with a comment per folder, a subfolder → responsibility table), not sentences about it. `steno steer template structure.md` shows the shape' });
    if (ph < 0 && s.file === 'tech.md' && !/^\s*```(bash|sh|shell)?\s*$/m.test(s.body)) issues.push({ level: 'warn', rule: 'steering/shape', file, msg: 'no command block: list every script in a ```bash block with a comment each. `steno steer template tech.md` shows the shape' });
  }
  if (alwaysTokens > budget) issues.push({ level: 'error', rule: 'steering/budget', file: 'steering', msg: `inclusion: always files total ~${alwaysTokens} tokens, over steeringBudget ${budget}; they enter every ctx packet. Shorten, or switch some to fileMatch` });
  return issues;
}
