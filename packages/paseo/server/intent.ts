// What the Command Center asked the panel to do next, such as "pick a task to mark done". It rides in exactly one
// push: a reconnecting panel must not open a picker the user already dealt with, and an intent replaced before
// any push went out is simply dropped.
import type { Action } from '../shared/contracts';

export interface IntentStore {
  /** Hold `action` for the workspace, replacing any it held, and tell its panels to push. */
  set(workspaceId: string, action: Action): void;
  /** The workspace's held intent, which is cleared by taking it. */
  take(workspaceId: string): Action | undefined;
  /** Hear of each `set` for the workspace. Returns the way to stop hearing. */
  onSet(workspaceId: string, listener: () => void): () => void;
}

export function createIntents(): IntentStore {
  const held = new Map<string, Action>();
  const listeners = new Map<string, Set<() => void>>();
  return {
    set(workspaceId, action) {
      held.set(workspaceId, action);
      for (const listener of [...(listeners.get(workspaceId) ?? [])]) listener();
    },
    take(workspaceId) {
      const action = held.get(workspaceId);
      held.delete(workspaceId);
      return action;
    },
    onSet(workspaceId, listener) {
      let set = listeners.get(workspaceId);
      if (!set) { set = new Set(); listeners.set(workspaceId, set); }
      set.add(listener);
      return () => {
        set.delete(listener);
        if (!set.size && listeners.get(workspaceId) === set) listeners.delete(workspaceId);
      };
    },
  };
}
