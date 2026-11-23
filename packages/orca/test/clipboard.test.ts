import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { copyPrograms, copyText } from '../src/worker/clipboard.js';

// stands in for a copy program: Node itself, writing what it is given to a file the test reads back
const fakeCopier = (out: string) => ({ file: process.execPath, args: ['-e', `require('fs').writeFileSync(${JSON.stringify(out)}, require('fs').readFileSync(0))`] });

describe('clipboard', () => {
  it('names the copy program each platform ships, and every Linux one for the session it runs in', () => {
    expect(copyPrograms('darwin', {}).map(p => p.file)).toEqual(['pbcopy']);
    expect(copyPrograms('win32', {}).map(p => p.file)).toEqual(['clip']);
    expect(copyPrograms('linux', {}).map(p => p.file)).toEqual(['xclip', 'xsel']);
    expect(copyPrograms('linux', { WAYLAND_DISPLAY: 'wayland-0' }).map(p => p.file)).toEqual(['wl-copy', 'xclip', 'xsel']);
  });

  it('hands the text to the first program that is installed', async () => {
    const out = join(mkdtempSync(join(tmpdir(), 'steno-clip-')), 'copied.txt');
    expect(await copyText('/steno-run T1 a', [{ file: 'steno-no-such-copier', args: [] }, fakeCopier(out)])).toBe(true);
    expect(readFileSync(out, 'utf8')).toBe('/steno-run T1 a');
  });

  it('reports a copy that no program took, without throwing', async () => {
    const failing = { file: process.execPath, args: ['-e', 'process.exit(1)'] };
    expect(await copyText('x', [{ file: 'steno-no-such-copier', args: [] }, failing])).toBe(false);
    expect(await copyText('x', [])).toBe(false);
  });
});
