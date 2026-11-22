// The contract types the server's answers carry. They come from @steno/core at compile time only: the server that
// answers is the bundled one, not an imported library. The request names come from `@steno/core/host`.
export type { ChangeResult, OutlineItem, SpecTree, StructuredError, TreeSpec, TreeSteering } from '@steno/core';
