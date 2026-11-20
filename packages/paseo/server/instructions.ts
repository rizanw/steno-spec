// The agent instruction files the steering list shows, found the way the VS Code extension finds them, and the
// watches that say when that set may have changed. Paseo gives a plugin no file watcher, so this uses fs.watch
// on the few folders the files live in: none of them recursive, which some platforms cannot do.
import { existsSync, readdirSync, statSync, watch, type FSWatcher } from 'node:fs';
import { join } from 'node:path';
import { AGENT_INSTRUCTION_DIRS, AGENT_INSTRUCTION_FILES, ROOT_INSTRUCTIONS } from './vendor/host.mjs';

/** The instruction files present, as workspace paths: `root` at the top of the list, `agent` at its end. */
export interface InstructionFiles { root: string[]; agent: string[] }

const at = (directory: string, path: string) => join(directory, ...path.split('/'));

/** The files of a folder, or none when it does not exist. */
function filesIn(dir: string): string[] {
  try { return readdirSync(dir, { withFileTypes: true }).filter(e => e.isFile()).map(e => e.name); } catch { return []; }
}

export function listInstructions(directory: string): InstructionFiles {
  const present = (files: readonly string[]) => files.filter(file => existsSync(at(directory, file)));
  const inDirs = AGENT_INSTRUCTION_DIRS.flatMap(({ dir, suffix }) =>
    filesIn(at(directory, dir)).filter(name => name.endsWith(suffix)).map(name => `${dir}/${name}`));
  return { root: present(ROOT_INSTRUCTIONS), agent: [...present(AGENT_INSTRUCTION_FILES), ...inDirs] };
}

// `.cursor` is watched too, though no file is listed from it: creating `.cursor/rules` inside an existing `.cursor`
// is reported there and nowhere else.
const WATCHED = ['', '.github', '.cursor', ...AGENT_INSTRUCTION_DIRS.map(d => d.dir)];

/** Names whose arrival or removal in a watched folder can add or remove a watched folder. */
const FOLDERS = new Set(['.github', '.cursor', 'instructions', 'rules']);

/** At the root only these names matter; anything else there, such as a build writing files, is not ours. */
const AT_ROOT = new Set<string>([...ROOT_INSTRUCTIONS, ...AGENT_INSTRUCTION_FILES.filter(f => !f.includes('/')), ...FOLDERS]);

/**
 * Call `changed` whenever the instruction files may have changed, until `signal` aborts. A folder that does not
 * exist yet is skipped; when one of them appears or goes, the watches are brought up to date, so a `.cursor/rules`
 * created later is watched from then on. The caller lists the files again on each call.
 */
export function watchInstructions(directory: string, changed: () => void, signal: AbortSignal): void {
  // Each watch is kept with the folder's inode. Re-arming only touches folders that appeared, went or were replaced:
  // closing a live watch to open it again would drop whatever it reported in between.
  const watchers = new Map<string, { watcher: FSWatcher; ino: number }>();
  const drop = (dir: string) => { watchers.get(dir)?.watcher.close(); watchers.delete(dir); };
  const close = () => { for (const dir of [...watchers.keys()]) drop(dir); };
  const arm = () => {
    if (signal.aborted) return;
    for (const dir of WATCHED) {
      const path = dir ? at(directory, dir) : directory;
      let ino: number | undefined;
      try { const s = statSync(path); if (s.isDirectory()) ino = s.ino; } catch { /* not there yet */ }
      const held = watchers.get(dir);
      if (held && held.ino === ino) continue;
      drop(dir);
      if (ino === undefined) continue;
      try {
        const watcher = watch(path, (_event, name) => {
          const file = name?.toString();
          if (!dir && file && !AT_ROOT.has(file)) return;
          // some platforms give no name; the folder set may have changed, so checking it again is the safe reading
          if (!file || FOLDERS.has(file)) arm();
          changed();
        });
        // a watched folder that is removed errors on some platforms; its parent's event brings the rest up to date
        watcher.on('error', () => { if (watchers.get(dir)?.watcher === watcher) drop(dir); });
        watchers.set(dir, { watcher, ino });
      } catch {
        // removed between the check and the watch; its parent reports it if it comes back
      }
    }
  };
  signal.addEventListener('abort', close, { once: true });
  arm();
}
