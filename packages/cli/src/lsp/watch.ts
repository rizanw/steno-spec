// Learns of disk changes to watched files: through the Client's file watcher when it can register one, else with fs.watch.
import { existsSync, readdirSync, watch, type FSWatcher } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DidChangeWatchedFilesNotification, type Connection, type Disposable } from 'vscode-languageserver/node';
import { configPath } from '@steno/core';
import type { Session } from './session.js';

export interface Watcher { close(): void }

/** The folders and files to watch, from the saved snapshot's configuration. Absent when there is no root. */
function watchTargets(s: Session): { root: string; steno: string; config: string; specs: string; steering: string } | undefined {
  if (s.root === undefined) return undefined;
  const { config } = s.saved;
  return {
    root: s.root, steno: join(s.root, '.steno'), config: configPath(s.root),
    specs: resolve(s.root, config.specsDir), steering: resolve(s.root, config.steeringDir),
  };
}

/**
 * Whether fs.watch can watch a folder tree in one call. Node 22's recursive watch on Linux watches each file by itself
 * and goes deaf to a file once a rename replaces it, which is how steno writes a document; a watch on the folder
 * reports such a file by name. So on Linux each folder of the tree gets a watch of its own.
 */
const RECURSIVE = process.platform !== 'linux';

/** `dir` and every folder below it, parents first; none when `dir` cannot be listed. */
function folders(dir: string): string[] {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  return [dir, ...entries.filter(e => e.isDirectory()).flatMap(e => folders(join(dir, e.name)))];
}

/** The folders fs.watch is given for a tree: its root, or on Linux each folder in it. */
const treeFolders = (dir: string) => (RECURSIVE ? [dir] : folders(dir));

/**
 * A key that changes when the watcher must be replaced: a configured folder moved, or (for fs.watch) a folder appeared
 * or went, which on Linux includes any folder inside the specs and steering folders, such as a new spec.
 */
export function watchKey(s: Session, client: boolean): string {
  const t = watchTargets(s);
  if (!t) return '';
  const dirs = [t.steno, t.specs, t.steering];
  if (client) return JSON.stringify(dirs);
  return JSON.stringify([...dirs.map(d => [d, existsSync(d)]), ...(RECURSIVE ? [] : [t.specs, t.steering].map(folders))]);
}

const glob = (p: string) => p.split('\\').join('/');

/**
 * Watch the `.steno` folder, the configuration file, the specs folder and the steering folder. With `client`, ask the
 * Client to watch them; otherwise use fs.watch on the specs and steering folder trees, and on the root for `.steno`.
 * `onChange` receives the absolute paths that changed.
 */
export function watchProject(conn: Connection, s: Session, onChange: (paths: string[]) => void, client = false): Watcher {
  const t = watchTargets(s);
  if (!t) return { close() {} };
  let closed = false;

  if (client) {
    let registration: Disposable | undefined;
    conn.onDidChangeWatchedFiles(p => { if (!closed) onChange(p.changes.map(c => fileURLToPath(c.uri))); });
    const watchers = [t.steno, t.config, t.specs, `${t.specs}/**`, t.steering, `${t.steering}/**`].map(p => ({ globPattern: glob(p) }));
    conn.client.register(DidChangeWatchedFilesNotification.type, { watchers })
      .then(d => { if (closed) d.dispose(); else registration = d; }, () => {});
    return { close() { closed = true; registration?.dispose(); } };
  }

  const watchers: FSWatcher[] = [];
  const add = (dir: string, recursive: boolean, keep: (name: string) => boolean = () => true) => {
    if (!existsSync(dir)) return;
    try {
      const w = watch(dir, { recursive }, (_event, name) => {
        if (closed) return;
        const file = name === null ? dir : join(dir, name.toString());
        if (name === null || keep(name.toString())) onChange([file]);
      });
      w.on('error', () => {});
      watchers.push(w);
    } catch { /* a folder that cannot be watched is skipped */ }
  };
  add(t.root, false, name => name === '.steno');
  add(t.steno, false);
  for (const dir of new Set([t.specs, t.steering].flatMap(treeFolders))) add(dir, RECURSIVE);
  return { close() { closed = true; for (const w of watchers) w.close(); } };
}
