// Which worktree the panel shows, and the servers that keeps alive. Orca says which workspace has focus but not
// where it lives (`workspace.changed` carries no path), so every change is looked up in `workspace.list`. Only the
// focused worktree's server is held, plus the enclosing project's while the worktree is not set up, because the
// panel then offers that project's specs; every other server is released and left to the pool's idle stop.
import { existsSync } from 'node:fs';
import type { Disposable, OrcaWorkerApi } from 'orca/worker';
import { parentProject } from '@steno/core/host';
import type { FolderServer, ServerPool } from '@steno/host';

export interface Active { workspaceId: string; folder: string; server: FolderServer; enclosing?: FolderServer }

/** The part of Orca's worker API the tracker uses. */
export type Orca = Pick<OrcaWorkerApi, 'events' | 'host'>;

type Context = { workspaceId?: string } | null;

/** One held server and the way to let it go. */
interface Held { server: FolderServer; release: () => void }

const hold = (pool: ServerPool, folder: string): Held => {
  const server = pool.serverFor(folder);
  return { server, release: server.hold() };
};

/**
 * Follow the focused workspace and call `changed` whenever the active worktree or its enclosing project changes,
 * with `undefined` while no worktree is focused or Orca cannot say where it is. `exists` is for tests.
 */
export function trackWorktree(orca: Orca, pool: ServerPool, changed: (a: Active | undefined) => void,
  exists: (path: string) => boolean = existsSync): Disposable {
  let current: { workspaceId: string; main: Held; enclosing?: Held; off: () => void } | undefined;
  // Each lookup awaits Orca, so a slow answer can land after a newer change; only the latest one may switch.
  let latest = 0;
  let disposed = false;

  const active = (): Active | undefined => current && {
    workspaceId: current.workspaceId, folder: current.main.server.folder, server: current.main.server, enclosing: current.enclosing?.server,
  };

  const releaseAll = () => {
    if (!current) return;
    current.off();
    current.main.release();
    current.enclosing?.release();
    current = undefined;
  };

  /** Hold the enclosing project's server exactly while the worktree's tree says it is not set up. */
  const syncEnclosing = (): boolean => {
    if (!current) return false;
    const { server } = current.main;
    const want = server.tree?.notSetUp ? parentProject(server.folder, exists) : undefined;
    if (want === current.enclosing?.server.folder) return false;
    current.enclosing?.release();
    current.enclosing = want === undefined ? undefined : hold(pool, want);
    return true;
  };

  const switchTo = (workspaceId: string | undefined, folder: string | undefined) => {
    if (current && current.workspaceId === workspaceId && current.main.server.folder === folder) return;
    releaseAll();
    if (workspaceId !== undefined && folder !== undefined) {
      const main = hold(pool, folder);
      current = { workspaceId, main, off: main.server.onChange(() => { if (syncEnclosing()) changed(active()); }) };
      syncEnclosing();
    }
    changed(active());
  };

  const follow = async (context: Context) => {
    const ticket = ++latest;
    const workspaceId = context?.workspaceId;
    let folder: string | undefined;
    if (workspaceId !== undefined) {
      try {
        const { workspaces } = await orca.host.call('workspace.list');
        folder = workspaces.find(w => w.id === workspaceId)?.path;
      } catch {
        // Orca could not list its workspaces; with no path there is nothing to show, so nothing is held.
      }
    }
    if (disposed || ticket !== latest) return;
    switchTo(folder === undefined ? undefined : workspaceId, folder);
  };

  const subscription = orca.events.on('workspace.changed', ({ context }) => follow(context));
  // A worker's subscription hears only later changes, so the worktree focused at start is read once here.
  const startTicket = latest;
  orca.host.call('workspace.readContext').then(context => { if (latest === startTicket) return follow(context); }, () => {});

  return {
    dispose() {
      disposed = true;
      subscription.dispose();
      releaseAll();
    },
  };
}
