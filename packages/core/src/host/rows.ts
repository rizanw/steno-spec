// How an editor shows a folder's spec tree: the text of each row and the order of the rows, as plain data. The
// VS Code extension maps these onto its tree items; another host can show the same rows the same way.
import type { OutlineItem, TreeSpec, TreeSteering } from '../contract.js';

/** What a row's icon means; each host picks its own picture for it. */
export type RowIcon = 'spec' | 'execute' | 'done' | 'warning' | 'document' | 'finished' | 'next' | 'task' | 'steering' | 'instruction';

/** The text and icon of one row. */
export interface RowText { label: string; description?: string; tooltip?: string; icon: RowIcon }

/** One task's row, nested as the task is in `tasks.md`. `line` is 1-based; `leaf` is a task with no subtasks. */
export interface TaskRow extends RowText { id: string; line?: number; done: boolean; optional: boolean; leaf: boolean; next: boolean; children: TaskRow[] }

/** Where specs live when the server did not say; only a set-up folder reaches the builders below. */
export const DEFAULT_SPECS_DIR = '.steno/specs';

/** The agent instruction files at a folder's root, listed first in the Steering view when the folder has them. */
export const ROOT_INSTRUCTIONS = ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md'] as const;

/** Instruction files only one agent reads, listed last in the Steering view when the folder has them. */
export const AGENT_INSTRUCTION_FILES = ['.cursorrules', '.github/copilot-instructions.md'] as const;

/** Folders of instruction files only one agent reads: every file in the folder whose name ends with `suffix`. */
export const AGENT_INSTRUCTION_DIRS = [
  { dir: '.cursor/rules', suffix: '.mdc' },
  { dir: '.github/instructions', suffix: '.instructions.md' },
] as const;

/** Every agent instruction file the Steering view lists, as one glob for the watcher that redraws it. */
export const INSTRUCTION_GLOB = `**/{${[
  ...ROOT_INSTRUCTIONS, ...AGENT_INSTRUCTION_FILES, ...AGENT_INSTRUCTION_DIRS.map(d => `${d.dir}/*${d.suffix}`),
].join(',')}}`;

/** The phases in the order a spec moves through them. */
export const PHASE_ORDER = ['brief', 'requirements', 'design', 'tasks', 'execute', 'done'] as const;

/** The phase each spec document is written in; `bugfix.md` takes the place of `requirements.md`. */
export const DOCUMENT_PHASE: Record<string, 'brief' | 'requirements' | 'design' | 'tasks'> = {
  'brief.md': 'brief', 'requirements.md': 'requirements', 'bugfix.md': 'requirements', 'design.md': 'design', 'tasks.md': 'tasks',
};

/** Whether the server could read this spec at all. */
export function unusable(spec: TreeSpec): boolean {
  return spec.unsupported === true || spec.unreadable === true;
}

/**
 * Whether a spec document's stage is behind the spec: approved, or the spec has moved past its phase. A quick
 * spec records no approvals, so the phase is what tells for it; a gated one only moves on by approving.
 */
export function documentDone(spec: TreeSpec, document: string): boolean {
  const stage = DOCUMENT_PHASE[document];
  if (stage === undefined) return false;
  if (stage !== 'brief' && spec.approvals?.[stage] !== undefined) return true;
  const at = PHASE_ORDER.indexOf(spec.phase as (typeof PHASE_ORDER)[number]);
  return at > PHASE_ORDER.indexOf(stage);
}

/** A file name without its `.md`, as the views label documents: `tasks.md` reads `tasks`. */
export function bareName(file: string): string {
  return file.replace(/\.md$/i, '');
}

/** The file name of a steering entry, without its folder. */
function fileName(path: string): string {
  return path.split('/').pop() ?? path;
}

/** "18 of 19 tasks", from the required tasks only. */
function taskProgress(spec: TreeSpec): string | undefined {
  const counts = spec.tasks;
  if (!counts || counts.total === 0) return undefined;
  return `${counts.done} of ${counts.total} ${counts.total === 1 ? 'task' : 'tasks'}`;
}

/**
 * The one fact a spec's row shows beside its title: the phase while it is being written, the required tasks
 * left while they run, nothing once it is done (its icon says so).
 */
function specDescription(spec: TreeSpec): string | undefined {
  if (spec.phase === undefined || spec.phase === 'done') return undefined;
  if (spec.phase !== 'execute') return spec.phase;
  const counts = spec.tasks;
  const left = counts ? counts.total - counts.done : 0;
  if (left <= 0) return 'all tasks done';
  return `${left} ${left === 1 ? 'task' : 'tasks'} left`;
}

/**
 * The hover of a spec: its folder name (the row already shows the title), then `execute | 18 of 19 tasks | gated`,
 * then the next task when there is one.
 */
function specTooltip(spec: TreeSpec): string {
  const status = [spec.phase, taskProgress(spec), spec.mode]
    .filter((part): part is string => typeof part === 'string' && part.length > 0).join(' | ');
  const next = spec.next ? `next: ${spec.next.id} ${spec.next.title}` : undefined;
  return [spec.name, status, next].filter(Boolean).join('\n');
}

/**
 * A spec's row: its title with the one fact `specDescription` picks, or, for a spec the server could not use,
 * its folder name and why. The icon is a pen while its documents are written, a play button while its tasks run,
 * a tick once done.
 */
export function specRow(spec: TreeSpec): RowText {
  if (unusable(spec)) {
    return { label: spec.name, description: spec.unsupported ? 'unsupported' : 'unreadable', tooltip: spec.files?.[0]?.reason, icon: 'warning' };
  }
  const icon: RowIcon = spec.phase === 'done' ? 'done' : spec.phase === 'execute' ? 'execute' : 'spec';
  return { label: spec.title ?? spec.name, description: specDescription(spec), tooltip: specTooltip(spec), icon };
}

/** A spec document's row, ticked once its stage is done. */
export function documentRow(spec: TreeSpec, document: string): RowText {
  const done = documentDone(spec, document);
  return { label: documentLabel(document), tooltip: done ? `${document} · done` : document, icon: done ? 'finished' : 'document' };
}

/** A steering file's row: its name, with when it reaches the agent, or the reason it could not be read. */
export function steeringRow(entry: TreeSteering): RowText {
  const label = bareName(fileName(entry.path));
  if (entry.unreadable) {
    return { label, description: 'unreadable', tooltip: `${entry.path}: ${entry.reason ?? 'could not be read'}`, icon: 'warning' };
  }
  const when = inclusionText(entry);
  return { label, description: when.short, tooltip: `${entry.path}\n${when.long}`, icon: 'steering' };
}

/**
 * An agent instruction file's row. One at the folder's root, such as `AGENTS.md`, reads by its name; one inside
 * a folder, such as `.github/copilot-instructions.md`, by its path.
 */
export function instructionRow(path: string): RowText {
  return { label: path.includes('/') ? path : bareName(path), tooltip: `${path}: instructions your coding agent reads`, icon: 'instruction' };
}

/** One task's row, given whether it is the spec's next task and the rows of its subtasks. */
export function taskRow(item: OutlineItem, next: boolean, children: TaskRow[] = []): TaskRow {
  const done = item.done === true, optional = item.optional === true;
  return {
    id: item.id ?? '', line: item.line, label: item.title, done, optional, leaf: item.children.length === 0, next, children,
    icon: next ? 'next' : done ? 'finished' : 'task',
    description: [optional && 'optional', next && 'next'].filter(Boolean).join(' · '),
  };
}

/**
 * A spec's tasks as rows, keeping the ids, order and nesting of `items` (the spec's own tasks by default). At most
 * one row is marked `next`: the first in outline order whose id is the spec's `next.id`.
 */
export function taskRows(spec: TreeSpec, items: readonly OutlineItem[] = spec.taskItems ?? []): TaskRow[] {
  const nextId = spec.next?.id;
  let marked = false;
  const build = (item: OutlineItem): TaskRow => {
    // the flag, and deciding before recursing, keep the mark on the first match in outline order
    const next = !marked && item.id !== undefined && item.id === nextId;
    if (next) marked = true;
    return taskRow(item, next, item.children.map(build));
  };
  return items.map(build);
}

/** A to Z, ignoring case; two names that differ only in case keep a fixed order. */
function alphabetical(a: string, b: string): number {
  const la = a.toLowerCase(), lb = b.toLowerCase();
  if (la !== lb) return la < lb ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The Steering view's rows in order, in three groups: the instruction files found at the folder's root A to Z,
 * the steering files by file name then path, then the instruction files only one agent reads A to Z. The host
 * says which instruction files exist; this only orders them.
 */
export function steeringOrder(steering: readonly TreeSteering[], rootFound: readonly string[], agentFound: readonly string[]):
  Array<{ kind: 'instruction' | 'steering'; path: string }> {
  const instructions = (files: readonly string[]) => [...files].sort(alphabetical).map(path => ({ kind: 'instruction' as const, path }));
  const files = [...steering].sort((a, b) => alphabetical(fileName(a.path), fileName(b.path)) || alphabetical(a.path, b.path))
    .map(entry => ({ kind: 'steering' as const, path: entry.path }));
  return [...instructions(rootFound), ...files, ...instructions(agentFound)];
}

/** A spec document's label: its name without `.md`, capitalised, so `requirements.md` reads `Requirements`. */
export function documentLabel(document: string): string {
  const name = bareName(document);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** When a steering file reaches the coding agent, in a few words for its row and a sentence for its hover. */
export function inclusionText(entry: TreeSteering): { short: string; long: string } {
  switch (entry.inclusion) {
    case 'fileMatch': {
      const files = entry.pattern ? `: ${entry.pattern.split(',').map(p => p.trim()).join(', ')}` : '';
      return { short: 'matching files', long: `Given to the agent for a task that touches matching files${files}` };
    }
    case 'manual': {
      const file = fileName(entry.path);
      return { short: 'on request', long: `Never given to the agent on its own; fetch it with \`steno show steering/${file}\`` };
    }
    default: return { short: 'always on', long: 'Given to the agent with every task' };
  }
}

/**
 * The specs of a tree in the order the Specs view lists them: the ones still in progress first, the done ones
 * last. Each group keeps the server's order, newest `created` first and the ones with no date after, so an
 * undated spec in progress sits just above the done ones.
 */
export function specOrder(specs: readonly TreeSpec[]): TreeSpec[] {
  return [...specs.filter(s => s.phase !== 'done'), ...specs.filter(s => s.phase === 'done')];
}
