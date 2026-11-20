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

describe('the manifest and source', () => {
  it('names the extension as the Marketplace id rizanw.steno-vscode, and is private to the workspace', () => {
    expect(manifest.name).toBe('steno-vscode');
    expect(manifest.publisher).toBe('rizanw');
    expect(manifest.displayName).toBe('steno spec');
    expect(manifest.private).toBe(true);
  });

  it('carries the version of the steno-spec release it bundles', () => {
    expect(manifest.version).toBe(cli.version);
  });

  it('bundles the server and the CLI from this workspace, so the build runs packages/cli first', () => {
    expect(manifest.devDependencies['steno-spec']).toBe('workspace:*');
  });

  it('supports VS Code 1.125 and later, with typings pinned to the same release', () => {
    expect(manifest.engines.vscode).toBe('^1.125.0');
    // equal, so the extension can never compile against an API the oldest supported editor lacks
    expect(manifest.devDependencies['@types/vscode']).toBe('1.125.0');
  });

  it('runs on the extension host alone: no browser entry, no virtual workspaces', () => {
    expect(manifest.browser).toBeUndefined();
    expect(manifest.capabilities.virtualWorkspaces).toBe(false);
  });

  it('limits Restricted Mode to the handoffs, set-up and the chooser, read in src/trust.ts alone', () => {
    const { supported, description } = manifest.capabilities.untrustedWorkspaces;
    expect(supported).toBe('limited');
    expect(description).toMatch(/Restricted Mode/);
    const reading = sources().filter(({ text }) => /isTrusted/.test(text)).map(({ path }) => path);
    expect(reading).toEqual(['trust.ts']);
  });

  it('offers no when clause that a Restricted Mode workspace would turn off', () => {
    const whens = JSON.stringify(manifest.contributes ?? {}).match(/"when":"[^"]*"/g) ?? [];
    for (const when of whens) expect(when).not.toMatch(/isTrusted|workspaceTrust/);
  });

  it('exposes approval only through the view: no language-model tool, chat participant or API', () => {
    expect(manifest.contributes?.languageModelTools).toBeUndefined();
    expect(manifest.contributes?.chatParticipants).toBeUndefined();
    // `activate` returns nothing, so no other extension can reach a SpecNode or an approve call
    const entry = sources().find(s => s.path === 'extension.ts')!;
    expect(entry.text).toMatch(/export function activate\([^)]*\): void/);
  });

  it('offers "New spec" on the view title, on a project folder and in the palette, each gated on a project', () => {
    const menus = manifest.contributes.menus;
    const of = (list: any[]) => list.filter((m: any) => m.command === 'steno.spec.new');
    expect(manifest.contributes.commands.map((c: any) => c.command)).toContain('steno.spec.new');
    expect(of(menus['view/title'])).toEqual([
      { command: 'steno.spec.new', when: 'view == steno.specs && steno.hasProject', group: 'navigation' },
    ]);
    expect(of(menus['view/item/context'])).toEqual([
      { command: 'steno.spec.new', when: 'view == steno.specs && viewItem == folder.project', group: 'inline' },
    ]);
    // the commands of this extension the palette offers, each only while a folder is a steno project
    expect(of(menus.commandPalette)).toEqual([{ command: 'steno.spec.new', when: 'steno.hasProject' }]);
    const shown = menus.commandPalette.filter((m: any) => m.when !== 'false').map((m: any) => m.command);
    expect(shown).toEqual(['steno.spec.new', 'steno.setUp', 'steno.agent.choose']);
  });

  it('offers "Set up steno" in the palette while no folder is a project or some folder is not one', () => {
    expect(manifest.contributes.commands.map((c: any) => c.command)).toContain('steno.setUp');
    expect(manifest.contributes.menus.commandPalette.filter((m: any) => m.command === 'steno.setUp'))
      .toEqual([{ command: 'steno.setUp', when: '!steno.hasProject || steno.canSetUp' }]);
  });

  it('contributes the Specs and Steering views, Steering only once a folder is a steno project', () => {
    expect(manifest.contributes.views.steno.map((v: any) => [v.id, v.name, v.when])).toEqual([
      ['steno.specs', 'Specs', undefined], ['steno.steering', 'Steering', 'steno.hasProject'],
    ]);
  });

  it('ends the empty Steering view\'s message with the "Generate steering" button', () => {
    const welcome = manifest.contributes.viewsWelcome.filter((w: any) => w.view === 'steno.steering');
    expect(welcome).toHaveLength(1);
    expect(welcome[0].when).toBe('steno.hasProject');
    expect(welcome[0].contents.split('\n').at(-1)).toBe('[Generate steering](command:steno.steering.generate)');
  });

  it('ends the empty view\'s message with the "Set up steno" button', () => {
    const welcome = manifest.contributes.viewsWelcome.filter((w: any) => w.view === 'steno.specs');
    expect(welcome).toHaveLength(1);
    expect(welcome[0]).toMatchObject({ view: 'steno.specs', when: '!steno.hasProject' });
    const lines = welcome[0].contents.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('No folder in this window is a steno project.');
    expect(lines[2]).toBe('[Set up steno](command:steno.setUp)');
  });

  it('offers "Choose Coding Agent" in the palette while a folder is a steno project', () => {
    expect(manifest.contributes.commands.map((c: any) => c.command)).toContain('steno.agent.choose');
    expect(manifest.contributes.menus.commandPalette.filter((m: any) => m.command === 'steno.agent.choose'))
      .toEqual([{ command: 'steno.agent.choose', when: 'steno.hasProject' }]);
  });

  it('refuses a spec name by the same rule as core\'s assertSlug, which the CLI would apply', () => {
    const core = readFileSync(join(HERE, '..', 'core', 'src', 'spec.ts'), 'utf8');
    const rule = (text: string) => /^const SLUG = (.+);$/m.exec(text)?.[1];
    const mine = sources().find(f => f.path === 'new-spec.ts')!.text;
    expect(rule(core)).toBeDefined();
    expect(rule(mine)).toBe(rule(core));
  });

  it('makes no network request: no http, https, net or tls import and no fetch', () => {
    const net = /(?:from\s*['"]|require\(\s*['"])(?:node:)?(?:http|https|net|tls)['"]|\bfetch\s*\(/;
    const files = sources();
    expect(files.length).toBeGreaterThan(0);
    for (const { path, text } of files) expect(text, path).not.toMatch(net);
  });
});
