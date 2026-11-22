// The agent instruction files the steering list shows, found the way the VS Code extension finds them, and the
// watches that say when that set may have changed.
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { listInstructions as listWith, type FolderReader, type InstructionFiles } from './vendor/host.mjs';

export type { InstructionFiles };

const at = (directory: string, path: string) => join(directory, ...path.split('/'));

/** Core's listing over the disk: a missing folder or a read error lists nothing for it. */
export function listInstructions(directory: string): Promise<InstructionFiles> {
  const reader: FolderReader = {
    exists: path => stat(at(directory, path)).then(() => true, () => false),
    files: dir => readdir(at(directory, dir), { withFileTypes: true }).then(es => es.filter(e => e.isFile()).map(e => e.name), () => []),
  };
  return listWith(reader);
}

// Paseo gives a plugin no file watcher, so @steno/host's fs.watch-based one says when the set may have changed.
export { watchInstructions } from './vendor/host.mjs';
