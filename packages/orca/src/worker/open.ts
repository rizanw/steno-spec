// Opening a row's file in Orca's editor. `editor.open` takes a workspace and a folder-relative path and no line, so a
// task row opens its spec's tasks.md at the top. A file that went away since the panel last drew says so instead of
// opening an empty tab.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { OrcaWorkerApi } from 'orca/worker';
import { documentPath, type PanelRow } from '@steno/core/host';
import type { ActResult } from '../shared/messages.js';
import { orNotify } from './errors.js';
import type { Active } from './worktree.js';

/** The folder-relative file a row opens, if it opens one. */
export function rowFile(row: PanelRow, tree: { specsDir?: string } | undefined): string | undefined {
  if (row.kind === 'task' && row.target) return documentPath(tree, row.target.spec, 'tasks.md');
  return row.path;
}

/**
 * Open `row`'s file in the active worktree's editor. Rows folded in from an enclosing project are not the worktree's
 * files, so they open nothing. `exists` is for tests.
 */
export async function openRow(orca: Pick<OrcaWorkerApi, 'host'>, active: Active, row: PanelRow | undefined,
  exists: (path: string) => boolean = existsSync): Promise<ActResult> {
  const path = row && !row.key.startsWith('inside:') ? rowFile(row, active.server.tree) : undefined;
  if (path === undefined) return { nothing: 'This row has no file to open.' };
  return openPath(orca, active, path, exists);
}

/** Open the active worktree's file at the folder-relative `path`, or say it is missing. */
export async function openPath(orca: Pick<OrcaWorkerApi, 'host'>, active: Active, path: string,
  exists: (path: string) => boolean = existsSync): Promise<ActResult> {
  if (!exists(join(active.folder, ...path.split('/')))) {
    await orca.host.call('notifications.show', { title: `${path} no longer exists`, body: 'Nothing was opened.' });
    return { done: true };
  }
  await orNotify(orca, `Opening ${path}`, () => orca.host.call('editor.open', { workspaceId: active.workspaceId, path }));
  return { done: true };
}
