// `steno.read`: the text of one file the panel lists. Only a path in the current rows is served, so the RPC cannot
// be used to read anything else in the workspace, or outside it through `..`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FolderServer } from './pool';
import { buildSnapshot, firstTree } from './snapshot';

/** The workspace paths the panel's rows point at right now. */
export function listedPaths(server: FolderServer): Set<string> {
  const { specRows, steeringRows } = buildSnapshot(server);
  return new Set([...specRows, ...steeringRows].flatMap(row => (row.path ? [row.path] : [])));
}

/** Read a listed file; any other path is refused with "not a steno file". */
export async function readListed(server: FolderServer, path: string): Promise<{ text: string }> {
  await firstTree(server);
  if (!listedPaths(server).has(path)) throw new Error(`not a steno file: ${path}`);
  return { text: readFileSync(join(server.directory, ...path.split('/')), 'utf8') };
}
