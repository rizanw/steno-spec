// A minimal LSP client over the stdio of the built `steno lsp`, shared by the server tests. Needs `pnpm build` first.
import { afterEach, beforeAll } from 'vitest';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const BIN = fileURLToPath(new URL('../bin/steno.js', import.meta.url));

/** A temp project; `setUp` runs `steno init` and creates each named spec. */
export function project(setUp: boolean, ...specs: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'steno-lsp-'));
  const steno = (...args: string[]) => spawnSync(process.execPath, [BIN, ...args], { cwd: dir, encoding: 'utf8' });
  if (setUp) steno('init');
  for (const s of specs) steno('new', s);
  return dir;
}
export const uri = (path: string) => pathToFileURL(path).href;
/** The `--json` output of a CLI command run at `dir`. */
export const cliJson = (dir: string, ...args: string[]) => JSON.parse(spawnSync(process.execPath, [BIN, ...args, '--json'], { cwd: dir, encoding: 'utf8' }).stdout);

/** A minimal LSP client over the server's stdio. */
export class Client {
  proc: ChildProcessWithoutNullStreams;
  private buf = Buffer.alloc(0);
  private id = 0;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();
  exited: Promise<number | null>;
  /** every notification and request the server sent, with the time it arrived */
  received: { method: string; params: any; id?: number; at: number }[] = [];

  /** `args` and `cwd` start another server, such as the Server_Bundle; the default is `steno lsp`. */
  constructor(args: string[] = [BIN, 'lsp'], cwd?: string) {
    this.proc = spawn(process.execPath, args, { stdio: 'pipe', cwd });
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
      if (msg.method !== undefined) {
        this.received.push({ method: msg.method, params: msg.params, id: msg.id, at: Date.now() });
        if (msg.id !== undefined) this.send({ id: msg.id, result: null });   // answer server requests (registrations)
        continue;
      }
      const p = msg.id !== undefined ? this.pending.get(msg.id) : undefined;
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

  /** The first message after index `from` that matches, waiting up to `ms`. */
  async waitFor(method: string, match: (params: any) => boolean = () => true, ms = 3000, from = 0): Promise<{ params: any; at: number }> {
    const end = Date.now() + ms;
    for (;;) {
      const m = this.received.slice(from).find(r => r.method === method && match(r.params));
      if (m) return m;
      if (Date.now() > end) throw new Error(`no ${method} within ${ms} ms`);
      await new Promise(r => setTimeout(r, 20));
    }
  }

  /** The Diagnostics last published for `path`, or undefined when none were. */
  diagnostics(path: string): any[] | undefined {
    return this.received.filter(r => r.method === 'textDocument/publishDiagnostics' && r.params.uri === uri(path)).at(-1)?.params.diagnostics;
  }

  open(path: string, text: string, version = 1): void {
    this.notify('textDocument/didOpen', { textDocument: { uri: uri(path), languageId: 'markdown', version, text } });
  }

  async initialize(params: object): Promise<any> {
    const r = await this.request('initialize', { processId: null, capabilities: {}, ...params });
    this.notify('initialized');
    return r;
  }
}

/** Registers the hooks that check for the bundle and kill every client a test started; returns the client factory. */
export function useClients(): (args?: string[], cwd?: string) => Client {
  const clients: Client[] = [];
  beforeAll(() => {
    if (!existsSync(BIN)) throw new Error(`${BIN} is missing; run pnpm build before the server tests`);
  });
  afterEach(() => { for (const c of clients.splice(0)) c.proc.kill(); });
  return (args, cwd) => { const c = new Client(args, cwd); clients.push(c); return c; };
}
