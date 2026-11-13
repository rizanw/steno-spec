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

/** Spec_Documents and Steering_Files, the only files whose open text counts in the editor snapshot. */
function documentFilter(root: string): (path: string) => boolean {
  const { config } = readConfig(root);
  const specs = resolve(root, config.specsDir), steering = resolve(root, config.steeringDir);
  return p => (dirname(dirname(p)) === specs && (ARTIFACTS as readonly string[]).includes(basename(p)))
    || (dirname(p) === steering && p.endsWith('.md'));
}

/** Load both snapshots in full from the current files and open texts; says whether the Set_Up state flipped. */
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
