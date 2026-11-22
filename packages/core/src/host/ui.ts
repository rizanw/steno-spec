// The part of the host layer an interface can use in a browser: wording, paths, request names and call forms.
// `./index.ts` also re-exports the process rules, which import `node:path`, so a browser bundle takes this entry.
export * from './requests.js';
export * from './wording.js';
export * from './paths.js';
export * from './calls.js';
export * from './version.js';
