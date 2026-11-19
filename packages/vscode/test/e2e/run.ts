// Launches VS Code with the built extension on a temp project and runs the `*.e2e.ts` files inside it.
// Run by `pnpm test:e2e` after `pnpm build`. VS Code's version comes from VSCODE_VERSION (default `stable`),
// so CI can run the oldest supported release (1.125.0) and the current one with the same script.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runTests } from '@vscode/test-electron';

const PACKAGE = join(__dirname, '..', '..');
const CLI = join(PACKAGE, 'dist', 'steno-cli.mjs');

const REQUIREMENTS = `# Requirements Document

## Requirements

### Requirement 1: Login

**User Story:** As a user, I want to log in, so that I can work.

#### Acceptance Criteria

1. WHEN a user submits valid credentials, THE system SHALL create a session.
2. WHEN a user logs out, THE system SHALL end the session.
`;

const DESIGN = `# Design

## Overview

Short.

## Sessions {#D-session}
_Satisfies: 1.1, 1.2_

The store.
`;

// T1.1 is done, so it carries the done lens; T1.2 is open, for the State_Change test to tick
const TASKS = `# Tasks

- [ ] 1. Sessions
  - [x] 1.1 Add the session store
    - _Requirements: 1.1_ _Design: D-session_
  - [ ] 1.2 Add logout
    - _Requirements: 1.2_ _Design: D-session_
`;

/** A steno project at `dir` with one quick Spec, made with the bundled CLI the extension ships. */
function project(dir: string, slug: string, title: string, docs?: Record<string, string>): void {
  mkdirSync(join(dir, '.steno'), { recursive: true });
  writeFileSync(join(dir, '.steno', 'config.yaml'), 'specsDir: .steno/specs\nsteeringDir: .steno/steering\n');
  const made = spawnSync(process.execPath, [CLI, 'quick', slug, '--title', title], { cwd: dir, encoding: 'utf8' });
  if (made.status !== 0) throw new Error(`steno quick ${slug} failed: ${made.stderr}`);
  for (const [file, text] of Object.entries(docs ?? {})) writeFileSync(join(dir, '.steno', 'specs', slug, file), text);
}

async function main(): Promise<void> {
  if (!existsSync(join(PACKAGE, 'dist', 'extension.js')) || !existsSync(CLI)) {
    throw new Error('dist/ is missing: run `pnpm build` first');
  }
  // the real path: on macOS the temp folder is a symlink, and on a Windows runner it is an 8.3 short name
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'steno-e2e-')));
  try {
    const alpha = join(root, 'alpha');
    const beta = join(root, 'beta');
    project(alpha, 'demo', 'Login', { 'requirements.md': REQUIREMENTS, 'design.md': DESIGN, 'tasks.md': TASKS });
    project(beta, 'billing', 'Billing');
    // a plain folder with no .steno, for set-up to turn into a project
    const gamma = join(root, 'gamma');
    mkdirSync(gamma);
    // a workspace file, not a bare folder: adding a second folder to a single-folder window
    // turns it into a workspace and restarts the extension host, which would end the run
    const workspace = join(root, 'e2e.code-workspace');
    writeFileSync(workspace, JSON.stringify({ folders: [{ path: alpha }] }));
    await runTests({
      version: process.env.VSCODE_VERSION || 'stable',
      extensionDevelopmentPath: PACKAGE,
      extensionTestsPath: join(__dirname, 'index.js'),
      launchArgs: [workspace, '--disable-extensions', '--disable-workspace-trust', '--skip-welcome', '--skip-release-notes'],
      extensionTestsEnv: { STENO_E2E_ALPHA: alpha, STENO_E2E_BETA: beta, STENO_E2E_GAMMA: gamma },
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
