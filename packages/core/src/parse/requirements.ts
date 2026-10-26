import type { RequirementsDoc, Requirement, Criterion } from '../types.js';

const STENO_HEAD = /^##\s+(R\d+)\s+(.*?)\s*$/;                 // ## R1 Title
const KIRO_HEAD = /^###\s+Requirement\s+(\d+)\s*(?:[:\-–]\s*(.*?))?\s*$/i; // ### Requirement 1: Title
const STORY = /^\*\*User Story:?\*\*:?\s*(.*)$/i;
const AC_HEAD = /^#{3,4}\s+Acceptance Criteria\s*$/i;
const CRIT = /^\s*(\d+)\.\s+(.*?)\s*$/;
const TITLE = /^#\s+(.*)$/;
const GLOSS = /^\s*[-*]\s+\*\*([^*]+)\*\*\s*:\s*(.*)$/;   // - **Term**: definition

export function parseRequirements(raw: string): RequirementsDoc {
  const lines = raw.split(/\r?\n/);
  const doc: RequirementsDoc = { title: '', glossary: [], requirements: [], raw };
  let cur: Requirement | undefined;
  let inAC = false;
  let section: 'intro' | 'glossary' | 'other' = 'other';
  const intro: string[] = [];

  const close = (i: number) => { if (cur) { cur.endLine = i; cur = undefined; } };

  lines.forEach((line, idx) => {
    const ln = idx + 1;
    if (!doc.title) { const t = TITLE.exec(line); if (t) { doc.title = t[1].trim(); return; } }
    let m = STENO_HEAD.exec(line);
    if (!m) { const k = KIRO_HEAD.exec(line); if (k) m = [k[0], `R${k[1]}`, k[2] ?? ''] as unknown as RegExpExecArray; }
    if (m) {
      close(ln - 1);
      cur = { id: m[1], n: Number(m[1].slice(1)), title: (m[2] ?? '').trim(), criteria: [], line: ln, endLine: ln };
      doc.requirements.push(cur);
      inAC = false;
      return;
    }
    if (!cur) {
      if (/^##\s+Introduction\s*$/i.test(line)) { section = 'intro'; return; }
      if (/^##\s+Glossary\s*$/i.test(line)) { section = 'glossary'; return; }
      if (/^#{1,2}\s/.test(line)) { section = 'other'; return; }
      if (section === 'intro') intro.push(line);
      if (section === 'glossary') { const g = GLOSS.exec(line); if (g) doc.glossary.push({ term: g[1].trim(), definition: g[2].trim(), line: ln }); }
      return;
    }
    if (/^#{1,2}\s/.test(line)) { close(ln - 1); return; }
    const s = STORY.exec(line.trim());
    if (s) { cur.story = s[1].trim(); return; }
    if (AC_HEAD.test(line)) { inAC = true; return; }
    if (/^#{3,4}\s/.test(line)) { inAC = false; return; }
    if (inAC) {
      const c = CRIT.exec(line);
      if (c) {
        const n = Number(c[1]);
        const crit: Criterion = { id: `${cur.id}.${n}`, n, text: c[2], line: ln };
        cur.criteria.push(crit);
      }
    }
  });
  close(lines.length);
  const introText = intro.join('\n').trim();
  if (introText) doc.intro = introText;
  return doc;
}

export function findRequirement(doc: RequirementsDoc, id: string): Requirement | undefined {
  return doc.requirements.find(r => r.id === id);
}
export function findCriterion(doc: RequirementsDoc, id: string): Criterion | undefined {
  for (const r of doc.requirements) { const c = r.criteria.find(c => c.id === id); if (c) return c; }
  return undefined;
}
