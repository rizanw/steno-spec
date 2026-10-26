import { existsSync, readdirSync, readFileSync } from 'node:fs';
import picomatch from 'picomatch';
import { steeringRoot } from './config.js';

export interface Steering { file: string; inclusion: 'always' | 'fileMatch' | 'manual'; pattern?: string; body: string }

const FM = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?/; // LF or CRLF

/** Kiro-compatible steering files: optional frontmatter `inclusion` + `fileMatchPattern`. */
export function loadSteering(projectRoot: string): Steering[] {
  const dir = steeringRoot(projectRoot);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => f.endsWith('.md')).sort().map(f => {
    const raw = readFileSync(`${dir}/${f}`, 'utf8');
    const m = FM.exec(raw);
    let inclusion: Steering['inclusion'] = 'always', pattern: string | undefined;
    if (m) {
      const inc = /inclusion:\s*(\w+)/.exec(m[1])?.[1];
      if (inc === 'fileMatch' || inc === 'manual' || inc === 'always') inclusion = inc;
      pattern = /fileMatchPattern:\s*['"]?([^'"\n]+)/.exec(m[1])?.[1]?.trim();
    }
    return { file: f, inclusion, pattern, body: raw.replace(FM, '').replace(/\r\n/g, '\n').trim() };
  });
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
