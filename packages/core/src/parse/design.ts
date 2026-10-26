import type { DesignDoc, DesignSection } from '../types.js';
import { normReqId } from '../ids.js';

const HEAD = /^(#{1,4})\s+(.*?)(?:\s*\{#(D-[\w-]+)\})?\s*$/;
/** `_Satisfies: 1.1_`, `_Validates: 1.2_`, or Kiro's bold `**Validates: Requirements 1.2, 3.4**`. */
const SATISFIES = /(?:_|\*\*)(?:Satisfies|Validates):\s*(?:Requirements?\s*)?([^_*\n]*?)\s*(?:_|\*\*)/i;

/** Slug an H2/H3 heading into an implicit D-id when none is declared. */
export function implicitDesignId(heading: string): string {
  const slug = heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return `D-${slug || 'section'}`;
}

export function parseDesign(raw: string): DesignDoc {
  const lines = raw.split(/\r?\n/);
  const doc: DesignDoc = { title: '', sections: [], raw };
  const open: DesignSection[] = [];

  const closeDeeper = (level: number, endLine: number) => {
    while (open.length && open[open.length - 1].level >= level) {
      const s = open.pop()!;
      s.endLine = endLine;
      s.body = lines.slice(s.line, s.endLine).join('\n').trim();
    }
  };

  lines.forEach((line, idx) => {
    const ln = idx + 1;
    const m = HEAD.exec(line);
    if (!m) {
      const sat = SATISFIES.exec(line);
      if (sat && open.length) {
        const target = open[open.length - 1];
        target.satisfies.push(...sat[1].split(',').map(s => normReqId(s)).filter(Boolean));
      }
      return;
    }
    const level = m[1].length;
    if (level === 1) { doc.title ||= m[2].trim(); return; }
    closeDeeper(level, ln - 1);
    const sec: DesignSection = {
      id: m[3] ?? implicitDesignId(m[2]), heading: m[2].trim(), level, satisfies: [],
      line: ln, endLine: ln, body: '',
    };
    doc.sections.push(sec);
    open.push(sec);
  });
  closeDeeper(0, lines.length);
  // de-duplicate implicit ids
  const seen = new Map<string, number>();
  for (const s of doc.sections) {
    const n = seen.get(s.id!) ?? 0;
    if (n > 0) s.id = `${s.id}-${n + 1}`;
    seen.set(s.id!.replace(/-\d+$/, ''), n + 1);
  }
  return doc;
}

export function findSection(doc: DesignDoc, id: string): DesignSection | undefined {
  return doc.sections.find(s => s.id === id);
}
