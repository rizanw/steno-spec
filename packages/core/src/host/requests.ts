// The language server's request names and the parameters each takes, as `steno lsp` answers them. A host sends
// these to the bundled server, so they only change together with the server's own list.

export const REQUESTS = {
  specTree: 'steno/specTree',
  taskDone: 'steno/taskDone',
  taskReopen: 'steno/taskReopen',
  approve: 'steno/approve',
  specReopen: 'steno/specReopen',
} as const;

/** What each request takes; the tree takes nothing. `approve` names the phase being approved. */
export interface RequestParams {
  specTree: undefined;
  taskDone: { spec: string; task: string };
  taskReopen: { spec: string; task: string };
  approve: { spec: string; phase?: string };
  specReopen: { spec: string };
}

/** The server's notice that a folder's spec tree changed. */
export const TREE_CHANGED = 'steno/treeChanged';
