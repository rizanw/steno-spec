// The steno requests on top of the Language Server Protocol. Handlers are registered once and answer in every state.
import type { Connection } from 'vscode-languageserver/node';
import { buildTree, type SpecTree } from '@steno/core';
import type { Session } from './session.js';

export const METHODS = {
  specTree: 'steno/specTree', taskPacket: 'steno/taskPacket',
  taskDone: 'steno/taskDone', taskReopen: 'steno/taskReopen', approve: 'steno/approve',
} as const;

export function registerRequests(conn: Connection, session: () => Session): void {
  // never checked: the saved snapshot, an empty tree marked notSetUp when the project is not set up
  conn.onRequest(METHODS.specTree, (): SpecTree => buildTree(session().saved));
}
