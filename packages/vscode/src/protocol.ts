// The steno requests the extension sends, and the contract types their answers carry. The types come from
// @steno/core at compile time only: the server that answers is the bundled one, not an imported library.
export type { ChangeResult, OutlineItem, SpecTree, StructuredError, TreeSpec, TreeSteering } from '@steno/core';

export const METHODS = {
  specTree: 'steno/specTree',
  taskDone: 'steno/taskDone',
  taskReopen: 'steno/taskReopen',
  approve: 'steno/approve',
} as const;

/** The server's notice that a folder's spec tree changed. */
export const TREE_CHANGED = 'steno/treeChanged';
