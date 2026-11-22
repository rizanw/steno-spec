// Everything the panel's client takes from steno, bundled into client/vendor/host.mjs. The client runs in Paseo's
// app, not in Node, so it takes core's browser-safe entry: wording, paths, request names and call forms.
export * from '@steno/core/host/ui';
