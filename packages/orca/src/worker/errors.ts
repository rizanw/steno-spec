// What the worker does when Orca itself refuses a call steno asked of it, such as opening a file in the editor or
// starting an agent. That is not steno saying no, so it is no Refusal: the user gets Orca's own reason in a
// notification, and the panel only hears that the action is over.
import type { OrcaWorkerApi } from 'orca/worker';

const reason = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/**
 * Run `call` and, if Orca rejects it, show `what` and Orca's message in a notification. Resolves to whether the call
 * went through. A notification Orca cannot show either is dropped: there is nowhere left to say it.
 */
export async function orNotify(orca: Pick<OrcaWorkerApi, 'host'>, what: string, call: () => Promise<unknown>): Promise<boolean> {
  try {
    await call();
    return true;
  } catch (err) {
    await orca.host.call('notifications.show', { title: `${what} failed`, body: reason(err) }).catch(() => undefined);
    return false;
  }
}
