import { join } from 'node:path';
import picomatch from 'picomatch';
import { steeringRoot } from './config.js';
import { diskSource, type FileSource } from './source.js';

export interface Steering { file: string; inclusion: 'always' | 'fileMatch' | 'manual'; pattern?: string; body: string }

/** A steering file as loaded: its parsed content, or why it cannot be read. */
export interface SteeringEntry { file: string; steering?: Steering; unreadable?: string }

const FM = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?/; // LF or CRLF

/** Parse one steering file: optional frontmatter `inclusion` + `fileMatchPattern` (Kiro-compatible). */
export function parseSteering(file: string, raw: string): Steering {
  const m = FM.exec(raw);
  let inclusion: Steering['inclusion'] = 'always', pattern: string | undefined;
  if (m) {
    const inc = /inclusion:\s*(\w+)/.exec(m[1])?.[1];
    if (inc === 'fileMatch' || inc === 'manual' || inc === 'always') inclusion = inc;
    pattern = /fileMatchPattern:\s*['"]?([^'"\n]+)/.exec(m[1])?.[1]?.trim();
  }
  return { file, inclusion, pattern, body: raw.replace(FM, '').replace(/\r\n/g, '\n').trim() };
}

/** One entry per markdown file in the steering folder, each loaded on its own; `file` is absolute. */
export function loadSteeringEntries(dir: string, src: FileSource = diskSource): SteeringEntry[] {
  return src.list(dir).filter(f => f.endsWith('.md')).flatMap((f): SteeringEntry[] => {
    const path = join(dir, f);
    const r = src.read(path);
    if (!r) return [];
    return ['error' in r ? { file: path, unreadable: `${f} ${r.error}` } : { file: path, steering: parseSteering(f, r.text) }];
  });
}

/** Kiro-compatible steering files: optional frontmatter `inclusion` + `fileMatchPattern`. Files that cannot be read are skipped. */
export function loadSteering(projectRoot: string, src: FileSource = diskSource): Steering[] {
  return loadSteeringEntries(steeringRoot(projectRoot), src).flatMap(e => (e.steering ? [e.steering] : []));
}

export function matchingSteering(all: Steering[], files: string[]): Steering[] {
  return all.filter(s => {
    if (s.inclusion === 'always') return true;
    if (s.inclusion === 'manual' || !s.pattern) return false;
    const isMatch = picomatch(splitPattern(s.pattern));
    return files.some(f => isMatch(f));
  });
}

/** `fileMatchPattern` may be one glob, a comma list, or a brace group; picomatch takes the list. */
export function splitPattern(pattern: string): string[] {
  const out: string[] = []; let depth = 0, cur = '';
  for (const ch of pattern) {
    if (ch === '{') depth++; else if (ch === '}') depth--;
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out.map(p => p.trim()).filter(Boolean);
}
