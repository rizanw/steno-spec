// What the panel says when its request to the worker gets no answer. Orca rejects with `unavailable` when it stopped
// the worker and with `timeout` when the worker took too long; either way the change may or may not have happened,
// so the panel says the outcome is unknown rather than that it failed, and draws the tree steno reports afterwards.

/** Whether a rejected `plugin.request` left the outcome unknown, rather than the worker answering with a failure. */
export function noAnswer(err: unknown): boolean {
  const code = (err as { code?: unknown } | null | undefined)?.code;
  return code === 'unavailable' || code === 'timeout';
}

/**
 * The bar's text. `fresh` says whether the panel got the tree as it is now; until it does, the rows below are the
 * ones drawn before the action.
 */
export function unknownOutcome(label: string, fresh: boolean): string {
  return fresh
    ? `steno did not answer ${label}, so whether it ran is unknown. The specs below are as steno reports them now.`
    : `steno did not answer ${label}, so whether it ran is unknown. The specs below may be out of date.`;
}
