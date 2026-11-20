// Everything the server entry takes from steno, bundled into server/vendor/host.mjs. Paseo installs no
// dependencies for a plugin, so core's host rules and the JSON-RPC library that talks to the language server
// travel inside the plugin. Core's types come along for the server code's typechecking and add nothing at run time.
export * from '@steno/core/host';
export type { SpecTree, TreeSpec, TreeSteering, OutlineItem, Diagnostic, ChangeResult, StructuredError, Phase } from '@steno/core';
export { createMessageConnection, StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node';
export type { MessageConnection } from 'vscode-jsonrpc/node';
