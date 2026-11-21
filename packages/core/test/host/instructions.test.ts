// Listing a folder's agent instruction files through the host's reader: which files count, in what order, and
// what a missing or unreadable folder does to the list.
import { describe, it, expect } from 'vitest';
import { listInstructions, type FolderReader } from '../../src/host/instructions.js';

/** A reader over an in-memory folder of `/` paths; `broken` paths throw when touched. */
function memory(paths: string[], broken: string[] = []): FolderReader {
  const fail = (p: string) => { if (broken.includes(p)) throw new Error(`EACCES: ${p}`); };
  return {
    exists: async p => { fail(p); return paths.includes(p); },
    files: async dir => {
      fail(dir);
      const prefix = `${dir}/`;
      return paths.filter(p => p.startsWith(prefix) && !p.slice(prefix.length).includes('/')).map(p => p.slice(prefix.length));
    },
  };
}

describe('listInstructions', () => {
  it('lists root files and agent files A to Z with folder-relative / paths', async () => {
    const read = memory([
      'GEMINI.md', 'AGENTS.md', 'README.md', '.cursorrules', '.github/copilot-instructions.md',
      '.cursor/rules/zeta.mdc', '.cursor/rules/Alpha.mdc', '.cursor/rules/notes.txt',
      '.github/instructions/api.instructions.md', '.github/instructions/api.md',
    ]);
    expect(await listInstructions(read)).toEqual({
      root: ['AGENTS.md', 'GEMINI.md'],
      agent: ['.cursor/rules/Alpha.mdc', '.cursor/rules/zeta.mdc', '.cursorrules', '.github/copilot-instructions.md',
        '.github/instructions/api.instructions.md'],
    });
  });

  it('does not recurse into a folder inside an instruction folder', async () => {
    const read = memory(['.cursor/rules/nested/deep.mdc']);
    expect((await listInstructions(read)).agent).toEqual([]);
  });

  it('lists nothing for a missing folder', async () => {
    expect(await listInstructions(memory([]))).toEqual({ root: [], agent: [] });
  });

  it('lists nothing for a folder or file it cannot read, and still lists the rest', async () => {
    const read = memory(['CLAUDE.md', 'AGENTS.md', '.cursor/rules/a.mdc', '.github/instructions/b.instructions.md'],
      ['AGENTS.md', '.cursor/rules']);
    expect(await listInstructions(read)).toEqual({ root: ['CLAUDE.md'], agent: ['.github/instructions/b.instructions.md'] });
  });
});
