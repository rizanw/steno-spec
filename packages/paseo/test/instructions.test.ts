import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { listInstructions, watchInstructions } from '../server/instructions';

function project(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'steno-paseo-instr-'));
  for (const [path, text] of Object.entries(files)) {
    const file = join(dir, ...path.split('/'));
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, text);
  }
  return dir;
}

const until = async (check: () => boolean, ms = 5_000) => {
  const end = Date.now() + ms;
  while (!check() && Date.now() < end) await new Promise(r => setTimeout(r, 10));
  expect(check()).toBe(true);
};
// fs.watch on macOS starts listening a moment after it returns, so a write in that moment goes unreported
const settle = () => new Promise(r => setTimeout(r, 200));

let stop: AbortController | undefined;
afterEach(() => stop?.abort());

describe('the instruction files', () => {
  it('lists the root files apart from those only one agent reads', () => {
    const dir = project({
      'CLAUDE.md': '', 'AGENTS.md': '', 'README.md': '', '.cursorrules': '', '.github/copilot-instructions.md': '',
      '.github/instructions/api.instructions.md': '', '.github/instructions/notes.md': '', '.cursor/rules/style.mdc': '',
    });
    const found = listInstructions(dir);
    expect(found.root.sort()).toEqual(['AGENTS.md', 'CLAUDE.md']);
    expect(found.agent.sort()).toEqual([
      '.cursor/rules/style.mdc', '.cursorrules', '.github/copilot-instructions.md', '.github/instructions/api.instructions.md',
    ]);
  });

  it('lists nothing in an empty folder', () => {
    expect(listInstructions(project({}))).toEqual({ root: [], agent: [] });
  });

  it('sees a rule in a folder created after the watch started', async () => {
    const dir = project({});
    stop = new AbortController();
    let changes = 0;
    watchInstructions(dir, () => { changes++; }, stop.signal);
    await settle();
    mkdirSync(join(dir, '.cursor', 'rules'), { recursive: true });
    await until(() => changes > 0);
    writeFileSync(join(dir, '.cursor', 'rules', 'x.mdc'), 'rule');
    await until(() => listInstructions(dir).agent.includes('.cursor/rules/x.mdc'));
    await settle();
    // the new file is reported by the watch on the new folder, not only found by listing
    const before = changes;
    writeFileSync(join(dir, '.cursor', 'rules', 'y.mdc'), 'rule');
    await until(() => changes > before);
  });

  it('reports a root instruction file and stops once aborted', async () => {
    const dir = project({});
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
    await new Promise(r => setTimeout(r, 200));
    expect(changes).toBe(after);
  });
});
