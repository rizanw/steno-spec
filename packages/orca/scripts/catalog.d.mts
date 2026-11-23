export const PLUGIN_PATH: string;
export const ICON_PATH: string;
export type ImageKind = 'icon' | 'cover' | 'screenshot';
export const IMAGE_RULES: Record<ImageKind, { formats: string[]; maxBytes: number; minWidth: number; minHeight: number; square?: boolean }>;
export const MAX_SCREENSHOTS: number;
export const MAX_IMAGE_BYTES: number;
/** An image's format and size from its header, or null when the bytes are not a PNG, JPEG or WebP. */
export function imageInfo(bytes: Buffer): { format: 'png' | 'jpeg' | 'webp'; width: number; height: number } | null;
/** Why Orca refuses `bytes` as a `kind` image, or null when it takes them. */
export function imageProblem(kind: ImageKind, bytes: Buffer): string | null;
/** The catalog release for the plugin files in `dir`, committed as `commit`. */
export function releaseEntry(dir: string, commit: string, icon?: { path: string; bytes: Buffer }): Record<string, unknown> & { version: string };
/** The catalog with `release` listed first under the plugin's entry; the same object when that version is listed. */
export function addRelease<C extends { plugins?: unknown[] }>(catalog: C, release: { version: string; [field: string]: unknown }, plugin: { id: string; repository: string; description?: string }): C;
