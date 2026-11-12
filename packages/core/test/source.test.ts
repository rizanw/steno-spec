import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { diskSource, overlaySource } from '../src/index.js';

const tmp = () => mkdtempSync(join(tmpdir(), 'steno-src-'));

describe('diskSource', () => {
  it('reads UTF-8, strips the byte order mark and flags it', () => {
    const d = tmp();
    writeFileSync(join(d, 'a.md'), 'héllo');
    writeFileSync(join(d, 'b.md'), '﻿# T');
    expect(diskSource.read(join(d, 'a.md'))).toEqual({ text: 'héllo', bom: false });
    expect(diskSource.read(join(d, 'b.md'))).toEqual({ text: '# T', bom: true });
  });

  it('gives undefined for a missing file and an error for bytes that are not UTF-8 or a file that cannot be opened', () => {
    const d = tmp();
    writeFileSync(join(d, 'bad.md'), Buffer.from([0x23, 0xff, 0xfe, 0x41]));
    mkdirSync(join(d, 'dir.md'));
    expect(diskSource.read(join(d, 'none.md'))).toBeUndefined();
    expect(diskSource.read(join(d, 'bad.md'))).toEqual({ error: 'is not UTF-8 text' });
    expect(diskSource.read(join(d, 'dir.md'))).toHaveProperty('error');
    if (process.platform !== 'win32' && process.getuid?.() !== 0) {
      writeFileSync(join(d, 'locked.md'), 'x'); chmodSync(join(d, 'locked.md'), 0o000);
      expect(diskSource.read(join(d, 'locked.md'))).toEqual({ error: expect.stringMatching(/cannot be opened/) });
    }
  });

  it('lists entries sorted, and nothing for a missing folder', () => {
    const d = tmp();
    writeFileSync(join(d, 'b'), ''); mkdirSync(join(d, 'a'));
    expect(diskSource.list(d)).toEqual(['a', 'b']);
    expect(diskSource.list(join(d, 'none'))).toEqual([]);
  });
});

describe('overlaySource', () => {
  const setup = () => {
    const d = tmp();
    writeFileSync(join(d, 'saved.md'), 'disk');
    writeFileSync(join(d, 'open.md'), 'disk');
    writeFileSync(join(d, 'bad.md'), Buffer.from([0xff]));
    writeFileSync(join(d, 'spec.yaml'), 'disk');
    const open = new Map([
      [join(d, 'open.md'), 'editor'], [join(d, 'bad.md'), 'editor'], [join(d, 'new.md'), '﻿editor'],
      [join(d, 'spec.yaml'), 'editor'], [join(d, 'sub', 'x.md'), 'editor'],
    ]);
    return { d, src: overlaySource(open, p => p.endsWith('.md')) };
  };

  it('covers the four read cases', () => {
    const { d, src } = setup();
    expect(src.read(join(d, 'open.md'))).toEqual({ text: 'editor', bom: false });     // open: editor text
    expect(src.read(join(d, 'new.md'))).toEqual({ text: 'editor', bom: true });       // open, missing on disk
    expect(src.read(join(d, 'saved.md'))).toEqual({ text: 'disk', bom: false });      // not open: disk text
    expect(src.read(join(d, 'bad.md'))).toEqual({ error: 'is not UTF-8 text' });     // saved copy unreadable wins
  });

  it('reads paths outside `only` from disk even while open', () => {
    const { d, src } = setup();
    expect(src.read(join(d, 'spec.yaml'))).toEqual({ text: 'disk', bom: false });
  });

  it('lists open paths that pass `only` and are missing on disk', () => {
    const { d, src } = setup();
    expect(src.list(d)).toEqual(['bad.md', 'new.md', 'open.md', 'saved.md', 'spec.yaml', 'sub']);
    expect(src.list(join(d, 'sub'))).toEqual(['x.md']);
  });
});
