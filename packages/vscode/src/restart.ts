// How often a server may crash before the extension gives up on it: five unexpected exits inside any
// three-minute period. One window per folder, so a noisy folder never silences a healthy one.

export const WINDOW_MS = 180_000;
export const MAX_EXITS = 5;

export class RestartWindow {
  /** the exits still inside the window, oldest first */
  private exits: number[] = [];

  /**
   * Record an unexpected exit at `now` and say what to do about it. `'stop'` once this exit is the
   * fifth within the 180 s ending at it; `'restart'` otherwise.
   */
  record(now: number): 'restart' | 'stop' {
    // an exit older than the window no longer counts against the server
    this.exits = this.exits.filter(t => now - t < WINDOW_MS);
    this.exits.push(now);
    return this.exits.length >= MAX_EXITS ? 'stop' : 'restart';
  }

  /** Forget every exit: the user asked for a restart, so the server starts with a clean record. */
  reset(): void {
    this.exits = [];
  }
}
