// Watching a folder's agent instruction files with fs.watch, folders that appear later included.
import { mkdirSync, mkdtempSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { listInstructions, type FolderReader } from '@steno/core/host';
import { watchInstructions } from '../src/watch.js';

const temp = () => mkdtempSync(join(tmpdir(), 'steno-host-watch-'));

/** Node's file system as core's folder reader, the way a host lists the files again after each report. */
const reader = (dir: string): FolderReader => ({
  exists: async path => { try { await access(join(dir, ...path.split('/'))); return true; } catch { return false; } },
  files: async sub => readdirSync(join(dir, ...sub.split('/'))).filter(name => statSync(join(dir, ...sub.split('/'), name)).isFile()),
});

const until = async (check: () => boolean | Promise<boolean>, ms = 5_000) => {
  const end = Date.now() + ms;
  while (!(await check()) && Date.now() < end) await new Promise(r => setTimeout(r, 10));
  expect(await check()).toBe(true);
};
// fs.watch on macOS starts listening a moment after it returns, so a write in that moment goes unreported
const settle = () => new Promise(r => setTimeout(r, 200));

let stop: AbortController | undefined;
afterEach(() => stop?.abort());

describe('the instruction watcher', () => {
  it('sees a rule in a folder created after the watch started', async () => {
    const dir = temp();
    stop = new AbortController();
    let changes = 0;
    watchInstructions(dir, () => { changes++; }, stop.signal);
    await settle();
    mkdirSync(join(dir, '.cursor', 'rules'), { recursive: true });
    await until(() => changes > 0);
    writeFileSync(join(dir, '.cursor', 'rules', 'x.mdc'), 'rule');
    await until(async () => (await listInstructions(reader(dir))).agent.includes('.cursor/rules/x.mdc'));
    await settle();
    // the new file is reported by the watch on the new folder, not only found by listing
    const before = changes;
    writeFileSync(join(dir, '.cursor', 'rules', 'y.mdc'), 'rule');
    await until(() => changes > before);
  });

  it('reports a root instruction file and a change to it', async () => {
    const dir = temp();
    stop = new AbortController();
    let changes = 0;
    watchInstructions(dir, () => { changes++; }, stop.signal);
    await settle();
    writeFileSync(join(dir, 'AGENTS.md'), '# agents');
    await until(() => changes > 0);
    await until(async () => (await listInstructions(reader(dir))).root.includes('AGENTS.md'));
    await settle();
    const before = changes;
    writeFileSync(join(dir, 'AGENTS.md'), '# agents, changed');
    await until(() => changes > before);
  });

  it('reports nothing more once aborted, from the root or any folder it was watching', async () => {
    const dir = temp();
    mkdirSync(join(dir, '.github', 'instructions'), { recursive: true });
    mkdirSync(join(dir, '.cursor', 'rules'), { recursive: true });
    stop = new AbortController();
    let changes = 0;
    watchInstructions(dir, () => { changes++; }, stop.signal);
    await settle();
    writeFileSync(join(dir, 'AGENTS.md'), '# agents');
    await until(() => changes > 0);
    stop.abort();
    await new Promise(r => setTimeout(r, 50));
    const after = changes;
    writeFileSync(join(dir, 'CLAUDE.md'), '# claude');
    writeFileSync(join(dir, '.github', 'instructions', 'api.instructions.md'), 'x');
    writeFileSync(join(dir, '.cursor', 'rules', 'style.mdc'), 'x');
    mkdirSync(join(dir, '.github', 'more'));
    await new Promise(r => setTimeout(r, 200));
    expect(changes).toBe(after);
  });

  it('starts no watch once already aborted', async () => {
    const dir = temp();
    const aborted = new AbortController();
    aborted.abort();
    let changes = 0;
    watchInstructions(dir, () => { changes++; }, aborted.signal);
    writeFileSync(join(dir, 'AGENTS.md'), '# agents');
    await new Promise(r => setTimeout(r, 200));
    expect(changes).toBe(0);
  });
});
