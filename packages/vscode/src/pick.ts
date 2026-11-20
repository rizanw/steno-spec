// Which steno project a command acts on when the window has more than one. Pure, and free of
// `vscode`: the hints arrive as folder paths, so the rule can be read and tested on its own.

/**
 * The project to create the Spec in: the tree item's folder when the command came from one, else the
 * active editor's folder when that folder is a project, else the only project there is. `undefined`
 * means neither hint settled it and the caller has to ask.
 */
export function pickProject(projects: string[], fromItem?: string, fromEditor?: string): string | undefined {
  if (fromItem !== undefined) return fromItem;
  if (fromEditor !== undefined && projects.includes(fromEditor)) return fromEditor;
  return projects.length === 1 ? projects[0] : undefined;
}
