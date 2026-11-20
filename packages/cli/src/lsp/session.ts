// The server's state: the root, the open documents and the two snapshots (saved: disk only; editor: open text over disk).
import { readdirSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { ARTIFACTS, DEFAULT_CONFIG, decodeText, diskSource, loadProject, overlaySource, readConfig, type ProjectSnapshot } from '@steno/core';

export interface Session {
  /** absent when the Client named no usable folder at the handshake; the session then stays on `NO_PROJECT` */
  root?: string;
  /** open documents by absolute path */
  open: Map<string, string>;
  saved: ProjectSnapshot; editor: ProjectSnapshot;
}

export const NO_PROJECT: ProjectSnapshot = Object.freeze({
  root: '', setUp: false, reason: 'the editor named no project folder', config: DEFAULT_CONFIG, configWarnings: [], specs: [], steering: [],
}) as ProjectSnapshot;

// a folder that exists and can be listed
const readable = (p: string) => { try { readdirSync(p); return true; } catch { return false; } };

/** A session for the folder the Client named; `NO_PROJECT` for good when there is none or it is missing or unreadable. */
export function createSession(root?: string): Session {
  const usable = root !== undefined && readable(root);
  const s: Session = { root: usable ? resolve(root) : undefined, open: new Map(), saved: NO_PROJECT, editor: NO_PROJECT };
  reload(s);
  return s;
}

/** Spec documents and steering files, the only files whose open text counts in the editor snapshot. */
function documentFilter(root: string): (path: string) => boolean {
  const { config } = readConfig(root);
  const specs = resolve(root, config.specsDir), steering = resolve(root, config.steeringDir);
  return p => (dirname(dirname(p)) === specs && (ARTIFACTS as readonly string[]).includes(basename(p)))
    || (dirname(p) === steering && p.endsWith('.md'));
}

/** Load both snapshots in full from the current files and open texts; says whether the set-up state flipped. */
export function reload(s: Session): { becameSetUp: boolean; becameNotSetUp: boolean } {
  if (s.root === undefined) return { becameSetUp: false, becameNotSetUp: false };
  const was = s.saved.setUp;
  s.saved = loadProject(s.root, diskSource);
  s.editor = loadProject(s.root, overlaySource(s.open, documentFilter(s.root)));
  return { becameSetUp: !was && s.saved.setUp, becameNotSetUp: was && !s.saved.setUp };
}

/** The first of `paths` that is open with text different from its saved copy. */
export function unsaved(s: Session, paths: string[]): string | undefined {
  return paths.find(p => {
    const text = s.open.get(p);
    if (text === undefined) return false;
    const disk = diskSource.read(p);
    return !disk || 'error' in disk || disk.text !== decodeText(text).text;
  });
}

/** What asked for a reload: an open, edit or close of a document, or a watcher event. */
export type ReloadCause = 'edit' | 'event';
/** Per cause: wait this long after the latest request, and never longer than `cap` after the first one not yet served. */
const RELOAD_DELAYS: Record<ReloadCause, { quiet: number; cap: number }> = {
  edit: { quiet: 100, cap: 300 },
  event: { quiet: 150, cap: 500 },
};

export interface ReloadTimer {
  request(cause: ReloadCause): void;
  dispose(): void;
}

/**
 * The one reload timer: it fires at the earliest pending deadline, and one run serves every pending request of both
 * causes. `run` learns which causes it served.
 */
export function createReloadTimer(run: (served: Set<ReloadCause>) => void, delays = RELOAD_DELAYS): ReloadTimer {
  const pending = new Map<ReloadCause, { first: number; last: number }>();
  let timer: NodeJS.Timeout | undefined;
  const arm = () => {
    if (timer) clearTimeout(timer);
    let due = Infinity;
    for (const [cause, p] of pending) due = Math.min(due, p.last + delays[cause].quiet, p.first + delays[cause].cap);
    timer = setTimeout(fire, Math.max(0, due - Date.now()));
  };
  const fire = () => {
    timer = undefined;
    const served = new Set(pending.keys());
    pending.clear();
    run(served);
  };
  return {
    request(cause) {
      const now = Date.now();
      const p = pending.get(cause);
      if (p) p.last = now; else pending.set(cause, { first: now, last: now });
      arm();
    },
    dispose() { if (timer) clearTimeout(timer); timer = undefined; pending.clear(); },
  };
}
