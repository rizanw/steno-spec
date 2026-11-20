import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { relative, isAbsolute, sep } from 'node:path';

/** A file's text with any leading byte order mark removed (`bom` says one was there), or why it cannot be read. */
export type ReadResult = { text: string; bom: boolean } | { error: string };

/** One way to read a file, so the same loader serves saved (disk) and unsaved (editor) text. Paths are absolute. */
export interface FileSource {
  /** `undefined` when there is no such file. */
  read(path: string): ReadResult | undefined;
  /** Names of the entries directly inside `dir`, sorted; `[]` when it is missing or not a folder. */
  list(dir: string): string[];
}

const BOM = '﻿';
const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

/** Strip a leading byte order mark so parsers never see it. */
export function decodeText(raw: string): { text: string; bom: boolean } {
  return raw.startsWith(BOM) ? { text: raw.slice(1), bom: true } : { text: raw, bom: false };
}

const isMissing = (e: unknown) => (e as NodeJS.ErrnoException)?.code === 'ENOENT' || (e as NodeJS.ErrnoException)?.code === 'ENOTDIR';

export const diskSource: FileSource = {
  read(path) {
    let bytes: Buffer;
    try { bytes = readFileSync(path); } catch (e) {
      if (isMissing(e)) return undefined;
      return { error: `cannot be opened (${(e as NodeJS.ErrnoException).code ?? (e as Error).message})` };
    }
    try { return decodeText(utf8.decode(bytes)); } catch { return { error: 'is not UTF-8 text' }; }
  },
  list(dir) {
    try { return readdirSync(dir).sort(); } catch { return []; }
  },
};

/** The first path segment of `path` below `dir`, or undefined when `path` is not below it. */
function childOf(dir: string, path: string): string | undefined {
  const rel = relative(dir, path);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return undefined;
  return rel.split(sep)[0];
}

/**
 * Editor snapshot source. For a path that passes `only` (spec documents and steering files): the disk error when the saved
 * copy cannot be read, else the open text when the file is open (also when it is missing on disk), else the disk text.
 * Every other path (a `spec.yaml`, the configuration) is read from disk only.
 */
export function overlaySource(open: Map<string, string>, only: (path: string) => boolean): FileSource {
  return {
    read(path) {
      const disk = diskSource.read(path);
      if (!only(path)) return disk;
      if (disk && 'error' in disk) return disk;
      const text = open.get(path);
      return text === undefined ? disk : decodeText(text);
    },
    list(dir) {
      const names = new Set(diskSource.list(dir));
      for (const p of open.keys()) {
        if (!only(p) || existsSync(p)) continue;
        const name = childOf(dir, p);
        if (name) names.add(name);
      }
      return [...names].sort();
    },
  };
}
