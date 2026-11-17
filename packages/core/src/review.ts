import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Spec } from './types.js';
import { sha } from './state.js';

export type ReviewStage = 'requirements' | 'design' | 'tasks';

/** A review is one full round plus at most one verify round; after that the stage is approved or the user asks for a new full review. */
export const MAX_REVIEW_ROUNDS = 2;
/** Growth since round 1 (as a fraction) above which `steno review` warns that the review is adding scope. */
export const REVIEW_GROWTH_WARN = 0.25;

export interface ReviewRoundEntry { round: number; date: string; sha: string; count: number }
/** Per-stage review history, kept next to the packets as `reviews/<stage>-rounds.json`. `items` are the reviewed items of the latest round. */
export interface ReviewLog { rounds: ReviewRoundEntry[]; items: Record<string, string> }
export interface ReviewDelta { added: string[]; changed: string[]; removed: string[] }

export interface ReviewRound {
  round: number;
  /** A verify round checks only what changed since the previous round. */
  verify: boolean;
  /** The document is byte-identical to the one the previous round reviewed: there is nothing new to review. */
  unchanged: boolean;
  count: number;
  firstCount: number;
  delta?: ReviewDelta;
  overLimit: boolean;
  log: ReviewLog;
}

const UNIT: Record<ReviewStage, string> = { requirements: 'criteria', design: 'sections', tasks: 'tasks' };

/** The reviewable items of a stage (criteria, design sections, tasks) as id → hash of their text. */
export function reviewItems(spec: Spec, stage: ReviewStage): Record<string, string> {
  const out: Record<string, string> = {};
  if (stage === 'requirements') for (const r of spec.requirements?.requirements ?? []) for (const c of r.criteria) out[c.id] = sha(c.text.trim());
  if (stage === 'design') for (const s of spec.design?.sections ?? []) if (s.id) out[s.id] = sha(`${s.heading}\n${s.body.trim()}`);
  if (stage === 'tasks' && spec.tasks) {
    const lines = spec.tasks.raw.split(/\r?\n/), tasks = spec.tasks.tasks;
    tasks.forEach((t, i) => { out[t.id] = sha(taskText(lines, t.line, tasks[i + 1]?.line ?? lines.length + 1)); });
  }
  return out;
}

/**
 * A task's own lines: its checkbox line and the detail lines under it, up to the next task or a `#`/`##` heading.
 * The checkbox is normalised, so ticking a task off is not a change to review.
 */
function taskText(lines: string[], line: number, nextLine: number): string {
  const own = [lines[line - 1].replace(/\[[ xX]\]/, '[ ]')];
  for (let i = line; i < nextLine - 1 && !/^#{1,2}\s/.test(lines[i]); i++) own.push(lines[i]);
  return own.map(l => l.trimEnd()).join('\n').trim();
}

const logPath = (specRoot: string, stage: ReviewStage) => join(specRoot, 'reviews', `${stage}-rounds.json`);

export function loadReviewLog(specRoot: string, stage: ReviewStage): ReviewLog {
  try {
    const log = JSON.parse(readFileSync(logPath(specRoot, stage), 'utf8')) as ReviewLog;
    if (Array.isArray(log.rounds) && log.items && typeof log.items === 'object') return log;
  } catch { /* missing or damaged: start again from round 1 */ }
  return { rounds: [], items: {} };
}

export function saveReviewLog(specRoot: string, stage: ReviewStage, log: ReviewLog): void {
  mkdirSync(join(specRoot, 'reviews'), { recursive: true });
  writeFileSync(logPath(specRoot, stage), JSON.stringify(log, null, 1) + '\n');
}

/** Keep the document as round `round` reviewed it (`reviews/<stage>-round<N>.md`), so text a review cuts or moves to another spec can be recovered. */
export function saveReviewSnapshot(specRoot: string, stage: ReviewStage, round: number, doc: string): string {
  mkdirSync(join(specRoot, 'reviews'), { recursive: true });
  const p = join(specRoot, 'reviews', `${stage}-round${round}.md`);
  writeFileSync(p, doc);
  return p;
}

/**
 * Work out which review round `doc` starts. Round 1 is a full review; later rounds are verify rounds scoped to the
 * items that changed. `full` forgets the history and starts again at round 1. The returned `log` is not saved.
 */
export function nextReviewRound(spec: Spec, stage: ReviewStage, doc: string, opts: { full?: boolean; date?: string } = {}): ReviewRound {
  const prev = opts.full ? { rounds: [], items: {} } : loadReviewLog(spec.root, stage);
  const items = reviewItems(spec, stage);
  const count = Object.keys(items).length, docSha = sha(doc);
  const last = prev.rounds.at(-1);
  const firstCount = prev.rounds[0]?.count ?? count;
  if (last && last.sha === docSha) return { round: last.round, verify: last.round > 1, unchanged: true, count, firstCount, overLimit: last.round > MAX_REVIEW_ROUNDS, log: prev };
  const round = (last?.round ?? 0) + 1;
  const delta: ReviewDelta | undefined = last ? {
    added: Object.keys(items).filter(id => !(id in prev.items)),
    changed: Object.keys(items).filter(id => id in prev.items && prev.items[id] !== items[id]),
    removed: Object.keys(prev.items).filter(id => !(id in items)),
  } : undefined;
  const log: ReviewLog = { rounds: [...prev.rounds, { round, date: opts.date ?? new Date().toISOString().slice(0, 10), sha: docSha, count }], items };
  return { round, verify: round > 1, unchanged: false, count, firstCount, delta, overLimit: round > MAX_REVIEW_ROUNDS, log };
}

/** `62 criteria (round 1: 40, +22)`. */
export function reviewSize(r: ReviewRound, stage: ReviewStage): string {
  const d = r.count - r.firstCount;
  return `${r.count} ${UNIT[stage]}${r.round > 1 ? ` (round 1: ${r.firstCount}, ${d >= 0 ? '+' : ''}${d})` : ''}`;
}

/** True when the document has grown since round 1 by more than `REVIEW_GROWTH_WARN`. */
export function reviewGrew(r: ReviewRound): boolean {
  return r.firstCount > 0 && (r.count - r.firstCount) / r.firstCount > REVIEW_GROWTH_WARN;
}

/** The packet section that tells a reviewer which round this is and, in a verify round, what it may report. */
export function reviewRoundSection(r: ReviewRound, stage: ReviewStage): string {
  const lines = [`## Review round ${r.round} (${r.verify ? 'verify' : 'full'})`, `Size: ${reviewSize(r, stage)}.`];
  if (r.verify && r.delta) {
    const list = (label: string, ids: string[]) => ids.length ? `${label}: ${ids.join(', ')}` : '';
    const changes = [list('added', r.delta.added), list('changed', r.delta.changed), list('removed', r.delta.removed)].filter(Boolean).join('; ');
    lines.push(`Since round ${r.round - 1}: ${changes || `no ${UNIT[stage]} changed; only the surrounding text did`}.`);
    lines.push('This is a verify round. Report only a contradiction, a gap or an untestable statement that is in the added and changed items or that they cause elsewhere, plus any high finding. Report nothing med or low on items that did not change.');
  }
  return lines.join('\n');
}

/** Decisions the user has already taken in this stage's review (`reviews/<stage>-decisions.md`), for the packet. */
export function reviewDecisions(specRoot: string, stage: ReviewStage): string | undefined {
  const p = join(specRoot, 'reviews', `${stage}-decisions.md`);
  const text = existsSync(p) ? readFileSync(p, 'utf8').trim() : '';
  return text || undefined;
}
