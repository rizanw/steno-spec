// The language server end to end: spawns the built `steno lsp` and talks LSP to it. Needs `pnpm build` first.
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { builtinModules } from 'node:module';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { PROTOCOL_VERSION } from '@steno/core';
import { BIN, Client, cliJson, project, uri, useClients } from './lsp-client.js';

const LSP_SRC = fileURLToPath(new URL('../src/lsp/', import.meta.url));
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
const client = useClients();

describe('steno lsp: handshake and root', () => {
  it('reports the steno version and the protocol version', async () => {
    const r = await client().initialize({ rootUri: uri(project(true)) });
    expect(r.serverInfo).toEqual({ name: 'steno', version });
    expect(r.capabilities.experimental).toEqual({ steno: { protocolVersion: PROTOCOL_VERSION } });
    expect(r.capabilities).toMatchObject({ documentSymbolProvider: true, codeLensProvider: { resolveProvider: false } });
  });

  it('serves the first workspace folder and ignores the others and rootUri', async () => {
    const a = project(true, 'alpha'), b = project(true, 'beta');
    const c = client();
    await c.initialize({ rootUri: uri(b), workspaceFolders: [{ uri: uri(a), name: 'a' }, { uri: uri(b), name: 'b' }] });
    const tree = await c.request('steno/specTree');
    expect(tree.specs.map((s: any) => s.name)).toEqual(['alpha']);
  });

  it('serves rootUri when there is no workspace folder, without searching parent folders', async () => {
    const a = project(true, 'alpha');
    const c = client();
    await c.initialize({ rootUri: uri(join(a, '.steno', 'specs')), workspaceFolders: null });
    expect(await c.request('steno/specTree')).toEqual({ protocolVersion: PROTOCOL_VERSION, notSetUp: true, specs: [], steering: [] });
  });
});

describe('steno lsp: stopping', () => {
  it('exits on the exit notification', async () => {
    const c = client();
    await c.initialize({ rootUri: uri(project(true)) });
    await c.request('shutdown', null);
    c.notify('exit');
    expect(await c.exited).toBe(0);
  });

  it('exits when its input closes', async () => {
    const c = client();
    await c.initialize({ rootUri: uri(project(true)) });
    c.proc.stdin.end();
    expect(await c.exited).not.toBeNull();
  });

  it('imports no network module', () => {
    const net = /from ['"](node:)?(net|http|https|http2|dgram|tls|dns)['"]|require\(['"](node:)?(net|http|https|http2|dgram|tls|dns)['"]\)/;
    const files = readdirSync(LSP_SRC, { recursive: true }).map(String).filter(f => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(readFileSync(join(LSP_SRC, f), 'utf8'), f).not.toMatch(net);
  });
});

describe('the server bundle', () => {
  const BUNDLE = fileURLToPath(new URL('../bin/steno-lsp.mjs', import.meta.url));

  it('runs alone from a CommonJS package folder and answers as steno lsp does', async () => {
    // a folder with nothing but the bundle and a package.json that makes .js files CommonJS
    const alone = mkdtempSync(join(tmpdir(), 'steno-bundle-'));
    cpSync(BUNDLE, join(alone, 'server.mjs'));
    writeFileSync(join(alone, 'package.json'), '{ "type": "commonjs" }\n');
    const dir = project(true, 'demo');
    const answers = async (c: Client) => {
      const init = await c.initialize({ rootUri: uri(dir) });
      return { init, tree: await c.request('steno/specTree'), packet: await c.request('steno/taskPacket', { spec: 'demo', task: 'T1' }).catch(e => e) };
    };
    const bundled = await answers(client([join(alone, 'server.mjs')], alone));
    expect(bundled.init.serverInfo).toEqual({ name: 'steno', version });
    expect(bundled.tree.specs.map((s: any) => s.name)).toEqual(['demo']);
    expect(bundled).toEqual(await answers(client()));
  });

  it('inlines every dependency: it loads Node built-ins only', () => {
    const specifiers = [...readFileSync(BUNDLE, 'utf8').matchAll(/(?:from |require\()['"]([^'"]+)['"]/g)].map(m => m[1]);
    expect(specifiers.length).toBeGreaterThan(0);
    for (const s of specifiers) expect(builtinModules, s).toContain(s.replace(/^node:/, ''));
  });
});

describe('the CLI bundle', () => {
  const BUNDLE = fileURLToPath(new URL('../bin/steno-cli.mjs', import.meta.url));

  it('runs alone from a CommonJS package folder and answers as steno does', () => {
    // a folder with nothing but the bundle and a package.json that makes .js files CommonJS
    const alone = mkdtempSync(join(tmpdir(), 'steno-cli-bundle-'));
    cpSync(BUNDLE, join(alone, 'cli.mjs'));
    writeFileSync(join(alone, 'package.json'), '{ "type": "commonjs" }\n');
    const dir = project(true);
    const run = (...args: string[]) =>
      JSON.parse(spawnSync(process.execPath, [join(alone, 'cli.mjs'), ...args, '--json'], { cwd: dir, encoding: 'utf8' }).stdout);
    expect(run('new', 'demo')).toEqual(cliJson(project(true), 'new', 'demo'));
    expect(existsSync(join(dir, '.steno', 'specs', 'demo', 'requirements.md'))).toBe(true);
  });

  it('reports the package version, with no package.json beside it', () => {
    const alone = mkdtempSync(join(tmpdir(), 'steno-cli-version-'));
    cpSync(BUNDLE, join(alone, 'cli.mjs'));
    const out = spawnSync(process.execPath, [join(alone, 'cli.mjs'), '--version'], { encoding: 'utf8' });
    expect(out.stdout.trim()).toBe(`${version} (protocol ${PROTOCOL_VERSION})`);
  });

  // Mirrors how the VS Code extension ships the CLI: the bundle in dist/, the skills folder next to dist.
  const extensionLayout = (withSkills: boolean) => {
    const ext = mkdtempSync(join(tmpdir(), 'steno-cli-ext-'));
    cpSync(BUNDLE, join(ext, 'dist', 'steno-cli.mjs'));
    if (withSkills) cpSync(fileURLToPath(new URL('../../skills/skills', import.meta.url)), join(ext, 'skills'), { recursive: true });
    const dir = mkdtempSync(join(tmpdir(), 'steno-cli-init-'));
    // pnpm sets NODE_PATH when it runs the tests, which would let the bundle find the workspace's skills package.
    // VS Code doesn't set it, so we drop it here too.
    const { NODE_PATH: _, ...env } = process.env;
    const run = (...args: string[]) =>
      spawnSync(process.execPath, [join(ext, 'dist', 'steno-cli.mjs'), ...args, '--root', dir, '--json'], { cwd: dir, env, encoding: 'utf8' });
    return { dir, run };
  };

  it('sets a folder up from dist/ with the skills folder beside dist', () => {
    const { dir, run } = extensionLayout(true);
    const r = run('init', '-a', '');
    expect(r.status, r.stderr).toBe(0);
    expect(JSON.parse(r.stdout).skills).toContain('steno-spec');
    expect(existsSync(join(dir, '.steno', 'config.yaml'))).toBe(true);
    expect(existsSync(join(dir, '.agents', 'skills', 'steno-spec', 'SKILL.md'))).toBe(true);
  });

  it('fails without the skills folder and leaves no .steno', () => {
    const { dir, run } = extensionLayout(false);
    const r = run('init', '-a', '');
    expect(r.status, r.stdout).toBe(1);
    expect(r.stdout).toMatch(/@steno\/skills/);
    expect(readdirSync(dir)).toEqual([]);
  });

  it('lists the agents with --list-agents, touching nothing', () => {
    const { dir, run } = extensionLayout(false);
    const r = run('init', '--list-agents');
    expect(r.status, r.stderr).toBe(0);
    expect(JSON.parse(r.stdout).agents).toContainEqual({ key: 'claude', label: 'Claude Code' });
    expect(readdirSync(dir)).toEqual([]);
  });

  it('inlines every dependency: it loads Node built-ins only', () => {
    // the CLI's help text quotes module-like strings, so only whole import statements and `require()` calls count
    const source = readFileSync(BUNDLE, 'utf8');
    const specifiers = [
      ...[...source.matchAll(/^import\b[^\n]*?from\s*['"]([^'"]+)['"]/gm)].map(m => m[1]),
      ...[...source.matchAll(/\brequire\(['"]([^'"]+)['"]\)/g)].map(m => m[1]),
    ];
    expect(specifiers.length).toBeGreaterThan(0);
    for (const s of specifiers) expect(builtinModules, s).toContain(s.replace(/^node:/, ''));
  });
});

describe('steno lsp: spec tree', () => {
  it('returns the tree of a set-up project', async () => {
    const dir = project(true, 'demo');
    const c = client();
    await c.initialize({ workspaceFolders: [{ uri: uri(dir), name: 'p' }] });
    const tree = await c.request('steno/specTree');
    expect(tree.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(tree.notSetUp).toBeUndefined();
    expect(tree.specs).toEqual([expect.objectContaining({ name: 'demo', phase: 'requirements', documents: ['requirements.md'] })]);
  });

  it('returns an empty tree marked notSetUp when the Client names no root, or the root is not set up', async () => {
    const empty = { protocolVersion: PROTOCOL_VERSION, notSetUp: true, specs: [], steering: [] };
    const none = client();
    await none.initialize({ rootUri: null });
    expect(await none.request('steno/specTree')).toEqual(empty);
    const missing = client();
    await missing.initialize({ rootUri: uri(join(tmpdir(), 'steno-lsp-missing-folder')) });
    expect(await missing.request('steno/specTree')).toEqual(empty);
    const bare = client();
    await bare.initialize({ rootUri: uri(project(false)) });
    expect(await bare.request('steno/specTree')).toEqual(empty);
  });

  it('builds the tree from saved files only, ignoring unsaved text', async () => {
    const dir = project(true, 'demo');
    const tasks = join(dir, '.steno', 'specs', 'demo', 'tasks.md');
    writeFileSync(tasks, '# Implementation Plan\n\n- [ ] 1. One\n- [ ] 2. Two\n');
    const c = client();
    await c.initialize({ rootUri: uri(dir) });
    c.notify('textDocument/didOpen', { textDocument: { uri: uri(tasks), languageId: 'markdown', version: 1, text: '# Implementation Plan\n\n- [x] 1. One\n- [x] 2. Two\n- [ ] 3. Three\n' } });
    const tree = await c.request('steno/specTree');
    expect(tree.specs[0].tasks).toEqual({ total: 2, done: 0, optionalTotal: 0, optionalDone: 0 });
    expect(tree.specs[0].next).toEqual({ id: 'T1', title: 'One' });
  });
});

// --- server views ------------------------------------------------------------------------------
const REQ = '# Requirements Document\n\n## Requirements\n\n### Requirement 1: Login\n\n**User Story:** As a user, I want to log in, so that I can work.\n\n#### Acceptance Criteria\n\n1. WHEN a user submits valid credentials, THE system SHALL create a session.\n';
const REQ2 = REQ + '2. WHEN a user logs out, THE system SHALL end the session.\n';
// cites R1.2, which REQ lacks: one `design/unknown-req` finding on line 7
const DESIGN = '# Design\n\n## Overview\n\nShort.\n\n## Sessions {#D-session}\n_Satisfies: 1.1, 1.2_\n\nThe store.\n';
const PUBLISH = 'textDocument/publishDiagnostics';
const TREE = 'steno/treeChanged';
const pause = (ms: number) => new Promise(r => setTimeout(r, ms));

/** A set-up project with Spec `demo` holding REQ and DESIGN; returns its paths. */
function demo() {
  const dir = project(true, 'demo');
  const spec = join(dir, '.steno', 'specs', 'demo');
  const p = { dir, spec, req: join(spec, 'requirements.md'), design: join(spec, 'design.md'), tasks: join(spec, 'tasks.md'), config: join(dir, '.steno', 'config.yaml') };
  writeFileSync(p.req, REQ);
  writeFileSync(p.design, DESIGN);
  return p;
}
const watchCaps = { workspace: { didChangeWatchedFiles: { dynamicRegistration: true } } };
const has = (rule: string) => (ps: any) => ps.diagnostics.some((d: any) => d.code === rule);
const empty = (ps: any) => ps.diagnostics.length === 0;

describe('steno lsp: diagnostics', () => {
  it('publishes the Diagnostics of unopened files at start, as protocol diagnostics', async () => {
    const p = demo();
    const c = client();
    await c.initialize({ rootUri: uri(p.dir) });
    const { params } = await c.waitFor(PUBLISH, ps => ps.uri === uri(p.design));
    expect(params.diagnostics).toEqual([{
      range: { start: { line: 6, character: 0 }, end: { line: 7, character: 0 } },
      severity: 1, source: 'steno', code: 'design/unknown-req', message: expect.stringContaining('R1.2'),
    }]);
    expect(c.diagnostics(p.req)).toBeUndefined();   // a file with no findings is never sent
  });

  it('clears a finding fixed by an edit', async () => {
    const p = demo();
    const c = client();
    await c.initialize({ rootUri: uri(p.dir) });
    await c.waitFor(PUBLISH, ps => ps.uri === uri(p.design));
    const from = c.received.length;
    const sent = Date.now();
    c.open(p.design, DESIGN.replace('1.1, 1.2', '1.1'));
    const { at } = await c.waitFor(PUBLISH, ps => ps.uri === uri(p.design) && empty(ps), 3000, from);
    expect(at - sent).toBeLessThan(1000);
  });

  it('refreshes another file of the same Spec when an edit changes its findings', async () => {
    const p = demo();
    const c = client();
    await c.initialize({ rootUri: uri(p.dir) });
    await c.waitFor(PUBLISH, ps => ps.uri === uri(p.design));
    const from = c.received.length;
    c.open(p.req, REQ);
    c.notify('textDocument/didChange', { textDocument: { uri: uri(p.req), version: 2 }, contentChanges: [{ text: REQ2 }] });
    await c.waitFor(PUBLISH, ps => ps.uri === uri(p.design) && empty(ps), 3000, from);
    // closing the unsaved edit brings the saved text, and its finding, back
    c.notify('textDocument/didClose', { textDocument: { uri: uri(p.req) } });
    await c.waitFor(PUBLISH, ps => ps.uri === uri(p.design) && has('design/unknown-req')(ps), 3000, from);
  });

  it('publishes no lint Diagnostic when the project is not set up', async () => {
    const dir = project(false);
    const c = client();
    await c.initialize({ rootUri: uri(dir) });
    c.open(join(dir, 'notes.md'), '# Notes\n');
    await pause(600);
    expect(c.received.filter(r => r.method === PUBLISH)).toEqual([]);
  });
});

describe('steno lsp: watching', () => {
  it('without the registration capability, a file changed on disk refreshes Diagnostics and sends one notice', async () => {
    const p = demo();
    const c = client();
    await c.initialize({ rootUri: uri(p.dir) });
    await c.waitFor(PUBLISH, ps => ps.uri === uri(p.design));
    const from = c.received.length;
    expect(c.received.some(r => r.method === 'client/registerCapability')).toBe(false);
    writeFileSync(p.design, DESIGN.replace('1.1, 1.2', '1.1'));
    await c.waitFor(PUBLISH, ps => ps.uri === uri(p.design) && empty(ps), 3000, from);
    await c.waitFor(TREE, undefined, 3000, from);
    await pause(700);
    expect(c.received.slice(from).filter(r => r.method === TREE)).toHaveLength(1);
  });

  it('with the capability, registers the watched folders and reloads on the Client events', async () => {
    const p = demo();
    const c = client();
    await c.initialize({ rootUri: uri(p.dir), capabilities: watchCaps });
    const reg = await c.waitFor('client/registerCapability');
    const [registration] = reg.params.registrations;
    expect(registration.method).toBe('workspace/didChangeWatchedFiles');
    const globs = registration.registerOptions.watchers.map((w: any) => w.globPattern);
    const fwd = (s: string) => s.split('\\').join('/');
    expect(globs).toEqual(expect.arrayContaining([fwd(join(p.dir, '.steno')), fwd(p.config), fwd(join(p.dir, '.steno', 'specs')) + '/**', fwd(join(p.dir, '.steno', 'steering')) + '/**']));
    await c.waitFor(PUBLISH, ps => ps.uri === uri(p.design));
    const from = c.received.length;
    writeFileSync(p.design, DESIGN.replace('1.1, 1.2', '1.1'));
    c.notify('workspace/didChangeWatchedFiles', { changes: [{ uri: uri(p.design), type: 2 }] });
    await c.waitFor(PUBLISH, ps => ps.uri === uri(p.design) && empty(ps), 3000, from);
    await c.waitFor(TREE, undefined, 1000, from);
  });

  it('sends a notice after the last change of a burst', async () => {
    const p = demo();
    const c = client();
    await c.initialize({ rootUri: uri(p.dir), capabilities: watchCaps });
    await c.waitFor(PUBLISH, ps => ps.uri === uri(p.design));
    const from = c.received.length;
    let last = 0;
    for (let i = 0; i < 8; i++) {
      writeFileSync(p.design, DESIGN + `\nedit ${i}\n`);
      c.notify('workspace/didChangeWatchedFiles', { changes: [{ uri: uri(p.design), type: 2 }] });
      last = Date.now();
      await pause(100);
    }
    const notices = () => c.received.slice(from).filter(r => r.method === TREE);
    await pause(1000);
    expect(notices().at(-1)!.at).toBeGreaterThanOrEqual(last);
    expect(notices().at(-1)!.at - last).toBeLessThan(1000);
    // the burst lasted 800 ms, so the 500 ms cap gave a notice before its end too
    expect(notices()[0].at).toBeLessThan(last);
  });
});

describe('steno lsp: set-up changes and removed files', () => {
  it('sees a spec written before its watcher started', async () => {
    // written after the handshake answer and before serving begins, when no watcher runs yet: no event will report it
    const dir = project(true);
    const c = client();
    await c.request('initialize', { processId: null, capabilities: {}, rootUri: uri(dir) });
    spawnSync(process.execPath, [BIN, 'new', 'late'], { cwd: dir });
    c.notify('initialized');
    expect((await c.request('steno/specTree')).specs.map((s: any) => s.name)).toEqual(['late']);
  });

  it('serves a project that becomes set up after start', async () => {
    const dir = project(false);
    const c = client();
    await c.initialize({ rootUri: uri(dir) });
    await pause(200);
    spawnSync(process.execPath, [BIN, 'init'], { cwd: dir });
    spawnSync(process.execPath, [BIN, 'new', 'demo'], { cwd: dir });
    await c.waitFor(TREE);
    const req = join(dir, '.steno', 'specs', 'demo', 'requirements.md');
    await c.waitFor(PUBLISH, ps => ps.uri === uri(req) && has('spec/placeholder')(ps));
    // a reload that ran while `steno new` was still writing can hold a tree without the spec; the next one has it
    await expect.poll(async () => (await c.request('steno/specTree')).specs.map((s: any) => s.name), { timeout: 3000 }).toEqual(['demo']);
  });

  it('keeps only the configuration error when the configuration breaks, and sends a notice', async () => {
    const p = demo();
    const c = client();
    await c.initialize({ rootUri: uri(p.dir) });
    await c.waitFor(PUBLISH, ps => ps.uri === uri(p.design));
    const from = c.received.length;
    writeFileSync(p.config, 'specsDir: [unclosed\n');
    const { params } = await c.waitFor(PUBLISH, ps => ps.uri === uri(p.config), 3000, from);
    expect(params.diagnostics).toEqual([expect.objectContaining({ code: 'config/unreadable', severity: 1, range: { start: { line: 0, character: 0 }, end: { line: 1, character: 0 } } })]);
    await c.waitFor(PUBLISH, ps => ps.uri === uri(p.design) && empty(ps), 3000, from);
    await c.waitFor(TREE, undefined, 3000, from);
  });

  it('keeps the Diagnostics of a deleted file while it is open, and clears them on close', async () => {
    const p = demo();
    const c = client();
    await c.initialize({ rootUri: uri(p.dir) });
    await c.waitFor(PUBLISH, ps => ps.uri === uri(p.design));
    c.open(p.design, DESIGN);
    rmSync(p.design);
    const from = c.received.length;
    await c.waitFor(TREE, undefined, 3000, from);
    await pause(300);
    expect(c.diagnostics(p.design)).toEqual([expect.objectContaining({ code: 'design/unknown-req' })]);
    c.notify('textDocument/didClose', { textDocument: { uri: uri(p.design) } });
    await c.waitFor(PUBLISH, ps => ps.uri === uri(p.design) && empty(ps), 3000, from);
  });
});

describe('steno lsp: document symbols', () => {
  const symbols = (c: Client, path: string) => c.request('textDocument/documentSymbol', { textDocument: { uri: uri(path) } });

  it('outlines each document kind from its current text', async () => {
    const p = demo();
    spawnSync(process.execPath, [BIN, 'new', 'fix', '--bugfix'], { cwd: p.dir });
    const steering = join(p.dir, '.steno', 'steering', 'product.md');
    writeFileSync(steering, '# Product\n\n## Users\n\nText.\n\n### Admins\n\nMore.\n');
    writeFileSync(p.tasks, '# Tasks\n\n- [ ] 1. Session\n  - [ ] 1.1 Add store\n');
    const c = client();
    await c.initialize({ rootUri: uri(p.dir) });

    const req = await symbols(c, p.req);
    expect(req).toEqual([expect.objectContaining({ name: 'Login', detail: 'R1', kind: 2, range: { start: { line: 4, character: 0 }, end: expect.any(Object) } })]);
    expect(req[0].children.map((s: any) => s.detail)).toEqual(['R1.1']);
    expect((await symbols(c, p.design)).map((s: any) => s.detail)).toEqual(['D-overview', 'D-session']);
    expect((await symbols(c, steering)).map((s: any) => [s.name, s.children.map((k: any) => k.name)])).toEqual([['Users', ['Admins']]]);
    const bugfix = await symbols(c, join(p.dir, '.steno', 'specs', 'fix', 'bugfix.md'));
    expect(bugfix.length).toBeGreaterThan(0);
    // the open text, not the saved file
    c.open(p.tasks, '# Tasks\n\n- [ ] 1. Session\n  - [ ] 1.1 Add store\n- [ ] 2. Logout\n');
    const tasks = await symbols(c, p.tasks);
    expect(tasks.map((s: any) => [s.detail, s.name, s.children.map((k: any) => k.detail)])).toEqual([['T1', 'Session', ['T1.1']], ['T2', 'Logout', []]]);
  });

  it('refuses a document that neither exists nor is open with not-found', async () => {
    const p = demo();
    const c = client();
    await c.initialize({ rootUri: uri(p.dir) });
    const err = await symbols(c, p.tasks).then(() => undefined, e => e);
    expect(err).toMatchObject({ code: -32803, data: { protocolVersion: PROTOCOL_VERSION, code: 'not-found', file: p.tasks } });
  });

  it('returns an empty list outside the specs and steering folders, for an Unusable Spec, and when not set up', async () => {
    const p = demo();
    writeFileSync(join(p.dir, 'README.md'), '# Readme\n\n## Part\n');
    writeFileSync(p.req, Buffer.from([0x23, 0x20, 0xff, 0xfe, 0x0a]));   // not UTF-8: the Spec is Unusable
    const c = client();
    await c.initialize({ rootUri: uri(p.dir) });
    expect(await symbols(c, join(p.dir, 'README.md'))).toEqual([]);
    expect(await symbols(c, join(tmpdir(), 'elsewhere', '.steno', 'specs', 'demo', 'design.md'))).toEqual([]);
    expect(await symbols(c, p.design)).toEqual([]);
    const bare = project(false);
    const b = client();
    await b.initialize({ rootUri: uri(bare) });
    expect(await symbols(b, join(bare, '.steno', 'specs', 'demo', 'design.md'))).toEqual([]);
  });
});

describe('steno lsp: task lenses', () => {
  const lenses = (c: Client, path: string) => c.request('textDocument/codeLens', { textDocument: { uri: uri(path) } });

  it('gives data-only lenses with the contract command IDs, and registers no handler for them', async () => {
    const p = demo();
    const text = '# Tasks\n\n- [ ] 1. Session\n  - [ ] 1.1 Add store\n  - [x] 1.2 Done one\n- [ ]* 2. Extra\n';
    writeFileSync(p.tasks, text);
    const c = client();
    const init = await c.initialize({ rootUri: uri(p.dir) });
    expect(init.capabilities.executeCommandProvider).toBeUndefined();
    expect(await lenses(c, p.tasks)).toEqual([]);   // only while the document is open
    c.open(p.tasks, text);
    expect(await lenses(c, p.tasks)).toEqual([
      { range: { start: { line: 3, character: 0 }, end: { line: 3, character: 0 } }, command: { title: 'Run T1.1', command: 'steno.task.run', arguments: [{ spec: 'demo', task: 'T1.1', optional: false }] } },
      { range: { start: { line: 4, character: 0 }, end: { line: 4, character: 0 } }, command: { title: 'Done', command: 'steno.task.done', arguments: [{ spec: 'demo', task: 'T1.2', optional: false }] } },
      { range: { start: { line: 5, character: 0 }, end: { line: 5, character: 0 } }, command: { title: 'Run T2 (optional)', command: 'steno.task.run', arguments: [{ spec: 'demo', task: 'T2', optional: true }] } },
    ]);
    const err = await c.request('workspace/executeCommand', { command: 'steno.task.run', arguments: [] }).then(() => undefined, e => e);
    expect(err).toMatchObject({ code: -32601 });
  });

  it('gives no lens when the project is not set up', async () => {
    const dir = project(false);
    const c = client();
    await c.initialize({ rootUri: uri(dir) });
    const tasks = join(dir, '.steno', 'specs', 'demo', 'tasks.md');
    c.open(tasks, '# Tasks\n\n- [ ] 1. One\n');
    expect(await lenses(c, tasks)).toEqual([]);
  });
});

// --- server requests ---------------------------------------------------------------------------
const TASKS = '# Tasks\n\n- [ ] 1. Session\n  - [ ] 1.1 Add the store\n    - _Requirements: 1.1_ _Design: D-session_\n  - [ ] 1.2 Add expiry\n    - _Requirements: 1.1_\n- [ ] 2. Logout\n';
const refusal = (p: Promise<any>) => p.then(() => { throw new Error('expected a refusal'); }, e => e);

/** `demo()` with TASKS written and a valid design, ready for packets and changes. */
function withTasks() {
  const p = demo();
  writeFileSync(p.design, DESIGN.replace('1.1, 1.2', '1.1'));
  writeFileSync(p.tasks, TASKS);
  return { ...p, steering: join(p.dir, '.steno', 'steering') };
}

describe('steno lsp: task packets', () => {
  const packet = (c: Client, params: object) => c.request('steno/taskPacket', params);

  it('returns the packet steno ctx builds from the saved files, with the configured budget by default', async () => {
    const p = withTasks();
    writeFileSync(join(p.steering, 'tech.md'), '# Tech\n\nNode.\n');
    const c = client();
    await c.initialize({ rootUri: uri(p.dir) });
    // an open document whose text matches its saved copy has no unsaved edits
    c.open(p.req, REQ);
    const r = await packet(c, { spec: 'demo', task: 'T1.1' });
    expect(r).toEqual(cliJson(p.dir, 'ctx', 'T1.1', 'demo'));
    expect(r.budget).toBe(1500);
    expect(r.text).toContain('[tech.md]');
    const small = await packet(c, { spec: 'demo', task: 'T1.1', budget: 200 });
    expect(small).toEqual(cliJson(p.dir, 'ctx', 'T1.1', 'demo', '--budget', '200'));
  });

  it('refuses a budget that is not a positive whole number', async () => {
    const p = withTasks();
    const c = client();
    await c.initialize({ rootUri: uri(p.dir) });
    for (const budget of [0, -5, 1.5, 'ten']) {
      const err = await refusal(packet(c, { spec: 'demo', task: 'T1.1', budget }));
      expect(err).toMatchObject({ code: -32803, data: { protocolVersion: PROTOCOL_VERSION, code: 'invalid-request', field: 'budget' } });
    }
  });

  it('refuses a spec document with unsaved edits, naming the file', async () => {
    const p = withTasks();
    const c = client();
    await c.initialize({ rootUri: uri(p.dir) });
    c.open(p.design, DESIGN + '\nMore.\n');
    const err = await refusal(packet(c, { spec: 'demo', task: 'T1.1' }));
    expect(err).toMatchObject({ code: -32803, data: { code: 'unsaved-edits', spec: 'demo', file: p.design } });
  });

  it('leaves out an included steering file with unsaved edits and an Unreadable one, listing both', async () => {
    const p = withTasks();
    writeFileSync(join(p.steering, 'tech.md'), '# Tech\n\nNode.\n');
    writeFileSync(join(p.steering, 'notes.md'), '---\ninclusion: manual\n---\n# Notes\n');
    writeFileSync(join(p.steering, 'bad.md'), Buffer.from([0x23, 0x20, 0xff, 0xfe, 0x0a]));
    const c = client();
    await c.initialize({ rootUri: uri(p.dir) });
    c.open(join(p.steering, 'tech.md'), '# Tech\n\nDeno.\n');
    c.open(join(p.steering, 'notes.md'), '---\ninclusion: manual\n---\n# Notes, edited\n');
    const r = await packet(c, { spec: 'demo', task: 'T1.1' });
    expect(r.text).not.toContain('[tech.md]');
    expect(r.text).not.toContain('Deno');
    expect(r.trimmed).toContain('steering/tech.md (unsaved edits)');
    expect(r.trimmed).toContainEqual(expect.stringMatching(/^steering\/bad\.md \(.+\)$/));
    // a manual file the packet would not include is not listed, edited or not
    expect(r.trimmed.some((t: string) => t.startsWith('steering/notes.md'))).toBe(false);
  });

  it('refuses with not-set-up when the project is not set up', async () => {
    const c = client();
    await c.initialize({ rootUri: uri(project(false)) });
    const err = await refusal(packet(c, { spec: 'demo', task: 'T1.1' }));
    expect(err).toMatchObject({ code: -32803, data: { code: 'not-set-up' } });
  });
});

describe('steno lsp: state changes', () => {
  const done = (c: Client, task: string) => c.request('steno/taskDone', { spec: 'demo', task });

  it('marks a task done and reopens it, reloading and sending the notice', async () => {
    const p = withTasks();
    const c = client();
    await c.initialize({ rootUri: uri(p.dir) });
    let from = c.received.length;
    expect(await done(c, 'T1.1')).toEqual({ protocolVersion: PROTOCOL_VERSION, spec: 'demo', phase: 'requirements', task: 'T1.1', done: true });
    expect(readFileSync(p.tasks, 'utf8')).toContain('- [x] 1.1 Add the store');
    await c.waitFor(TREE, undefined, 1000, from);
    expect((await c.request('steno/specTree')).specs[0].next).toEqual({ id: 'T1.2', title: 'Add expiry' });
    from = c.received.length;
    expect(await c.request('steno/taskReopen', { spec: 'demo', task: 'T1.1' })).toMatchObject({ task: 'T1.1', done: false });
    expect(readFileSync(p.tasks, 'utf8')).toContain('- [ ] 1.1 Add the store');
    await c.waitFor(TREE, undefined, 1000, from);
  });

  it('reopens a done spec, and refuses one in another phase', async () => {
    const p = withTasks();
    const c = client();
    await c.initialize({ rootUri: uri(p.dir) });
    expect(await refusal(c.request('steno/specReopen', { spec: 'demo' }))).toMatchObject({ data: { code: 'invalid-request', field: 'spec' } });
    writeFileSync(join(p.spec, 'spec.yaml'), 'name: demo\nkind: feature\nmode: gated\nphase: done\ncreated: 2026-01-01\napprovals: {}\n');
    writeFileSync(p.tasks, TASKS.replaceAll('[ ]', '[x]'));
    const from = c.received.length;
    expect(await c.request('steno/specReopen', { spec: 'demo' })).toEqual({ protocolVersion: PROTOCOL_VERSION, spec: 'demo', phase: 'execute' });
    expect(readFileSync(join(p.spec, 'spec.yaml'), 'utf8')).toMatch(/phase: execute/);
    await c.waitFor(TREE, undefined, 1000, from);
  });

  it('applies two changes sent back to back, one after the other', async () => {
    const p = withTasks();
    const c = client();
    await c.initialize({ rootUri: uri(p.dir) });
    const [a, b] = await Promise.all([done(c, 'T1.1'), done(c, 'T1.2')]);
    expect([a.task, b.task]).toEqual(['T1.1', 'T1.2']);
    const text = readFileSync(p.tasks, 'utf8');
    expect(text).toContain('- [x] 1.1 Add the store');
    expect(text).toContain('- [x] 1.2 Add expiry');
    expect(text).toContain('- [x] 1. Session');
  });

  it('refuses a change for unsaved edits, an Unusable Spec and a project not set up, writing nothing', async () => {
    const p = withTasks();
    const c = client();
    await c.initialize({ rootUri: uri(p.dir) });
    c.open(p.tasks, TASKS + '- [ ] 3. More\n');
    expect(await refusal(done(c, 'T1.1'))).toMatchObject({ code: -32803, data: { protocolVersion: PROTOCOL_VERSION, code: 'unsaved-edits', file: p.tasks } });
    expect(readFileSync(p.tasks, 'utf8')).toBe(TASKS);

    const q = withTasks();
    writeFileSync(q.req, Buffer.from([0x23, 0x20, 0xff, 0xfe, 0x0a]));
    const u = client();
    await u.initialize({ rootUri: uri(q.dir) });
    expect(await refusal(done(u, 'T1.1'))).toMatchObject({ code: -32803, data: { code: 'unreadable', spec: 'demo', file: q.req, reason: expect.any(String) } });
    expect(readFileSync(q.tasks, 'utf8')).toBe(TASKS);

    const bare = client();
    await bare.initialize({ rootUri: uri(project(false)) });
    expect(await refusal(done(bare, 'T1.1'))).toMatchObject({ code: -32803, data: { code: 'not-set-up' } });
  });
});

describe('steno lsp: approve', () => {
  const approve = (c: Client, phase: string) => c.request('steno/approve', { spec: 'demo', phase });
  const stateOf = (p: { spec: string }) => readFileSync(join(p.spec, 'spec.yaml'), 'utf8');

  it('approves the current stage', async () => {
    const p = demo();
    const c = client();
    await c.initialize({ rootUri: uri(p.dir) });
    const from = c.received.length;
    expect(await approve(c, 'requirements')).toEqual({ protocolVersion: PROTOCOL_VERSION, spec: 'demo', phase: 'design', approved: 'requirements' });
    expect(stateOf(p)).toMatch(/phase: design/);
    await c.waitFor(TREE, undefined, 1000, from);
  });

  it('refuses an approval blocked by lint, and takes no force', async () => {
    const p = demo();
    writeFileSync(p.req, '# Requirements Document\n\n## Requirements\n');
    const before = stateOf(p);
    const c = client();
    await c.initialize({ rootUri: uri(p.dir) });
    const err = await refusal(c.request('steno/approve', { spec: 'demo', phase: 'requirements', force: true }));
    expect(err).toMatchObject({ code: -32803, data: { code: 'lint-blocked', spec: 'demo', findings: [expect.objectContaining({ rule: 'req/empty' })] } });
    expect(stateOf(p)).toBe(before);
  });

  it('refuses an approval while any spec document of the Spec has unsaved edits', async () => {
    const p = demo();
    const before = stateOf(p);
    const c = client();
    await c.initialize({ rootUri: uri(p.dir) });
    c.open(p.design, DESIGN + '\nMore.\n');
    expect(await refusal(approve(c, 'requirements'))).toMatchObject({ code: -32803, data: { code: 'unsaved-edits', file: p.design } });
    expect(stateOf(p)).toBe(before);
  });

  it('finishes a change before exiting on an exit message sent right after it', async () => {
    const p = withTasks();
    const c = client();
    await c.initialize({ rootUri: uri(p.dir) });
    void c.request('steno/taskDone', { spec: 'demo', task: 'T1.1' }).catch(() => {});
    c.notify('exit');
    await c.exited;
    expect(readFileSync(p.tasks, 'utf8')).toContain('- [x] 1.1 Add the store');
  });
});

describe('steno lsp: end to end on the example project', () => {
  const EXAMPLE = fileURLToPath(new URL('../../../examples/link-shortener', import.meta.url));
  const gitStatus = () => spawnSync('git', ['status', '--porcelain', '--', EXAMPLE], { cwd: EXAMPLE, encoding: 'utf8' }).stdout;

  it('publishes Diagnostics, lists the Spec and ticks a task in a copy, leaving the repository clean', async () => {
    const before = gitStatus();
    const dir = mkdtempSync(join(tmpdir(), 'steno-lsp-example-'));
    cpSync(EXAMPLE, dir, { recursive: true, filter: src => !src.includes('node_modules') });
    const spec = join(dir, '.steno', 'specs', 'link-expiry');
    const tasks = join(spec, 'tasks.md');
    // every task of the example is done: reopen the first leaf in the copy so there is one to tick
    spawnSync(process.execPath, [BIN, 'done', 'T1.1', 'link-expiry', '--undo'], { cwd: dir });
    expect(readFileSync(tasks, 'utf8')).toContain('- [ ] 1.1 ');

    const c = client();
    await c.initialize({ rootUri: uri(dir) });
    // the example lints clean, so a finding is added in the open text of its design
    const design = join(spec, 'design.md');
    c.open(design, readFileSync(design, 'utf8') + '\n## Extra {#D-extra}\n_Satisfies: 99.1_\n\nText.\n');
    await c.waitFor(PUBLISH, has('design/unknown-req'));

    const tree = await c.request('steno/specTree');
    expect(tree.specs.map((s: any) => s.name)).toEqual(['link-expiry']);
    expect(tree.specs[0].next).toEqual(expect.objectContaining({ id: 'T1.1' }));

    const from = c.received.length;
    expect(await c.request('steno/taskDone', { spec: 'link-expiry', task: 'T1.1' })).toMatchObject({ spec: 'link-expiry', task: 'T1.1', done: true });
    expect(readFileSync(tasks, 'utf8')).toContain('- [x] 1.1 ');
    await c.waitFor(TREE, undefined, 1000, from);
    await pause(800);
    expect(c.received.slice(from).filter(r => r.method === TREE)).toHaveLength(1);
    expect(gitStatus()).toBe(before);
  });
});
