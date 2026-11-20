import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runToEnd, unpack } from '../server/programs';

const base = () => mkdtempSync(join(tmpdir(), 'steno-paseo-'));

describe('the bundled programs', () => {
  it('unpacks the server, the CLI and the skills beside them', () => {
    const dir = unpack(base());
    for (const file of ['steno-lsp.mjs', 'steno-cli.mjs']) expect(existsSync(join(dir, 'vendor', file)), file).toBe(true);
    expect(existsSync(join(dir, 'skills', 'steno-run', 'SKILL.md'))).toBe(true);
  });

  it('reuses an unpacked folder instead of writing it again', () => {
    const root = base();
    const dir = unpack(root);
    const written = statSync(join(dir, 'vendor', 'steno-cli.mjs')).mtimeMs;
    expect(unpack(root)).toBe(dir);
    expect(statSync(join(dir, 'vendor', 'steno-cli.mjs')).mtimeMs).toBe(written);
    expect(readdirSync(root)).toEqual([readdirSync(root)[0]]);
  });

  it('runs the CLI it unpacked', async () => {
    const { code, stdout } = await runToEnd('steno-cli.mjs', ['--version'], { base: base() });
    expect(code).toBe(0);
    expect(stdout).toMatch(/\(protocol \d+\)/);
  });
});

describe('the host bundle', () => {
  it('carries core rules and the JSON-RPC library on its own', async () => {
    const host = await import('../server/vendor/host.mjs');
    expect(typeof host.canApprove).toBe('function');
    expect(typeof host.createMessageConnection).toBe('function');
  });
});
