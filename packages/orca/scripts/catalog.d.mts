export const PLUGIN_PATH: string;
export const ICON_PATH: string;
/** The catalog release for the plugin files in `dir`, committed as `commit`. */
export function releaseEntry(dir: string, commit: string, icon?: { path: string; bytes: Buffer }): Record<string, unknown> & { version: string };
/** The catalog with `release` listed first under the plugin's entry; the same object when that version is listed. */
export function addRelease<C extends { plugins?: unknown[] }>(catalog: C, release: { version: string; [field: string]: unknown }, plugin: { id: string; repository: string; description?: string }): C;
