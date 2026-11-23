// The panel imports its stylesheet so esbuild writes it beside panel.js; the import itself has no value.
declare module '*.css';
// An SVG is bundled as its own text (build.mjs's `.svg` loader), ready to put into the page as it is.
declare module '*.svg' { const text: string; export default text; }
