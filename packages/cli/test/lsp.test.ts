// The language server end to end: spawns the built `steno lsp` and talks LSP to it. Needs `pnpm build` first.
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PROTOCOL_VERSION } from '@steno/core';

const BIN = fileURLToPath(new URL('../bin/steno.js', import.meta.url));
const LSP_SRC = fileURLToPath(new URL('../src/lsp/', import.meta.url));
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };

/** A temp project; `setUp` runs `steno init` and creates each named spec. */
function project(setUp: boolean, ...specs: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'steno-lsp-'));
  const steno = (...args: string[]) => spawnSync(process.execPath, [BIN, ...args], { cwd: dir, encoding: 'utf8' });
  if (setUp) steno('init');
  for (const s of specs) steno('new', s);
  return dir;
}
const uri = (path: string) => pathToFileURL(path).href;

/** A minimal LSP client over the server's stdio. */
class Client {
  proc: ChildProcessWithoutNullStreams;
  private buf = Buffer.alloc(0);
  private id = 0;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();
  exited: Promise<number | null>;

  constructor() {
    this.proc = spawn(process.execPath, [BIN, 'lsp'], { stdio: 'pipe' });
    this.exited = new Promise(r => this.proc.on('exit', code => r(code)));
    this.proc.stdout.on('data', (d: Buffer) => { this.buf = Buffer.concat([this.buf, d]); this.drain(); });
  }

  private drain(): void {
    for (;;) {
      const head = this.buf.indexOf('\r\n\r\n');
      if (head < 0) return;
      const len = Number(/Content-Length: (\d+)/i.exec(this.buf.subarray(0, head).toString())![1]);
      if (this.buf.length < head + 4 + len) return;
      const msg = JSON.parse(this.buf.subarray(head + 4, head + 4 + len).toString());
      this.buf = this.buf.subarray(head + 4 + len);
      const p = msg.id !== undefined && msg.method === undefined ? this.pending.get(msg.id) : undefined;
      if (p) { this.pending.delete(msg.id); if (msg.error) p.reject(msg.error); else p.resolve(msg.result); }
    }
  }

  private send(msg: object): void {
    const body = JSON.stringify({ jsonrpc: '2.0', ...msg });
    this.proc.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
  }

  request(method: string, params: unknown = {}): Promise<any> {
    const id = ++this.id;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.send({ id, method, params }); });
  }

  notify(method: string, params: unknown = {}): void { this.send({ method, params }); }

  async initialize(params: object): Promise<any> {
    const r = await this.request('initialize', { processId: null, capabilities: {}, ...params });
    this.notify('initialized');
    return r;
  }
}

const clients: Client[] = [];
const client = () => { const c = new Client(); clients.push(c); return c; };
afterEach(() => { for (const c of clients.splice(0)) c.proc.kill(); });

beforeAll(() => {
  if (!existsSync(BIN)) throw new Error(`${BIN} is missing; run pnpm build before the server tests`);
});

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
