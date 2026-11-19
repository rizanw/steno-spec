// The manifest and the extension's own source, read as text: the promises that are kept by what the files
// say rather than by what the code does at run time.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('../', import.meta.url));
const SRC = join(HERE, 'src');
const manifest = JSON.parse(readFileSync(join(HERE, 'package.json'), 'utf8'));
const cli = JSON.parse(readFileSync(join(HERE, '..', 'cli', 'package.json'), 'utf8'));

/** Every `.ts` file of the extension's own source, path and text. */
function sources(dir: string = SRC): { path: string; text: string }[] {
  return readdirSync(dir).flatMap(entry => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sources(path);
    return entry.endsWith('.ts') ? [{ path: path.slice(SRC.length + 1), text: readFileSync(path, 'utf8') }] : [];
  });
}

describe('the manifest and source (R2.1, R2.2, R5.3, R6.1, R6.2, R6.4)', () => {
  it('names the extension as the Marketplace id rizanw.steno-vscode, and is private to the workspace (R6.2)', () => {
    expect(manifest.name).toBe('steno-vscode');
    expect(manifest.publisher).toBe('rizanw');
    expect(manifest.displayName).toBe('steno spec');
    expect(manifest.private).toBe(true);
  });

  it('carries the version of the steno-spec release it bundles (R6.2)', () => {
    expect(manifest.version).toBe(cli.version);
  });

  it('bundles the server and the CLI from this workspace, so the build runs packages/cli first (R6.2)', () => {
    expect(manifest.devDependencies['steno-spec']).toBe('workspace:*');
  });

  it('supports VS Code 1.125 and later, with typings pinned to the same release (R6.1)', () => {
    expect(manifest.engines.vscode).toBe('^1.125.0');
    // equal, so the extension can never compile against an API the oldest supported editor lacks
    expect(manifest.devDependencies['@types/vscode']).toBe('1.125.0');
  });

  it('runs on the extension host alone: no browser entry, no virtual workspaces (R6.1)', () => {
    expect(manifest.browser).toBeUndefined();
    expect(manifest.capabilities.virtualWorkspaces).toBe(false);
  });

  it('works the same in a Restricted Mode workspace (R2.1, R2.2)', () => {
    expect(manifest.capabilities.untrustedWorkspaces).toEqual({ supported: true });
    for (const { path, text } of sources()) expect(text, path).not.toMatch(/isTrusted/);
  });

  it('offers no when clause that a Restricted Mode workspace would turn off (R2.2)', () => {
    const whens = JSON.stringify(manifest.contributes ?? {}).match(/"when":"[^"]*"/g) ?? [];
    for (const when of whens) expect(when).not.toMatch(/isTrusted|workspaceTrust/);
  });

  it('exposes approval only through the view: no language-model tool, chat participant or API (R5.3)', () => {
    expect(manifest.contributes?.languageModelTools).toBeUndefined();
    expect(manifest.contributes?.chatParticipants).toBeUndefined();
    // `activate` returns nothing, so no other extension can reach a SpecNode or an approve call
    const entry = sources().find(s => s.path === 'extension.ts')!;
    expect(entry.text).toMatch(/export function activate\([^)]*\): void/);
  });

  it('makes no network request: no http, https, net or tls import and no fetch (R6.4)', () => {
    const net = /(?:from\s*['"]|require\(\s*['"])(?:node:)?(?:http|https|net|tls)['"]|\bfetch\s*\(/;
    const files = sources();
    expect(files.length).toBeGreaterThan(0);
    for (const { path, text } of files) expect(text, path).not.toMatch(net);
  });
});
