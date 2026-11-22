import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// Listing a workspace's agent instruction files from disk; the watcher is tested in @steno/host.
import { describe, expect, it } from 'vitest';
import { listInstructions } from '../server/instructions';

function project(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'steno-paseo-instr-'));
  for (const [path, text] of Object.entries(files)) {
    const file = join(dir, ...path.split('/'));
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, text);
  }
  return dir;
}

describe('the instruction files', () => {
  it('lists the root files apart from those only one agent reads', async () => {
    const dir = project({
      'CLAUDE.md': '', 'AGENTS.md': '', 'README.md': '', '.cursorrules': '', '.github/copilot-instructions.md': '',
      '.github/instructions/api.instructions.md': '', '.github/instructions/notes.md': '', '.cursor/rules/style.mdc': '',
    });
    const found = await listInstructions(dir);
    expect(found.root.sort()).toEqual(['AGENTS.md', 'CLAUDE.md']);
    expect(found.agent.sort()).toEqual([
      '.cursor/rules/style.mdc', '.cursorrules', '.github/copilot-instructions.md', '.github/instructions/api.instructions.md',
    ]);
  });

  it('lists nothing in an empty folder', async () => {
    expect(await listInstructions(project({}))).toEqual({ root: [], agent: [] });
  });
});
