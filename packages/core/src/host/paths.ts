// Where a project keeps its specs and steering, relative to the project with `/`. The tree names the folders when
// the project's config moves them; an older server or a tree not yet loaded names none, so the defaults apply.
import { DEFAULT_SPECS_DIR } from './rows.js';

export const DEFAULT_STEERING_DIR = '.steno/steering';

export const specsDir = (tree?: { specsDir?: string }): string => tree?.specsDir ?? DEFAULT_SPECS_DIR;
export const steeringDir = (tree?: { steeringDir?: string }): string => tree?.steeringDir ?? DEFAULT_STEERING_DIR;

/** A spec document's project-relative path, such as `.steno/specs/auth/tasks.md`. */
export function documentPath(tree: { specsDir?: string } | undefined, spec: string, file: string): string {
  return [...specsDir(tree).split('/').filter(Boolean), spec, file].join('/');
}
