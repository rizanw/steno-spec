// Fetches a folder's spec tree from its language server. The server sends a change notice on every save, often
// several in a burst; asking for the tree on each would pile requests up and could apply an older answer after a
// newer one. So one fetch runs at a time, and the notices that arrive during it fold into one more fetch.

export class TreeFetcher<T> {
  private running = false;
  private owed = false;
  private disposed = false;

  constructor(
    // not named `fetch`: the VS Code manifest test bans that call shape outright, to keep the extension offline
    private readonly load: () => Promise<T | undefined>,
    private readonly apply: (tree: T) => void,
  ) {}

  /** A change notice: fetch now, or owe one more fetch once the one in flight finishes. */
  request(): void {
    if (this.disposed) return;
    if (this.running) { this.owed = true; return; }
    void this.run();
  }

  /** The folder closed: an owed fetch is dropped and the one in flight never reaches `apply`. */
  dispose(): void { this.disposed = true; this.owed = false; }

  private async run(): Promise<void> {
    this.running = true;
    try {
      do {
        this.owed = false;
        // a throw or an empty answer counts as a failed fetch: the folder keeps the last tree it had. Paseo's
        // `load` answers `undefined` when the connection it asked went stale, and a language client can answer
        // `null`, so both land here.
        let tree: T | undefined;
        try { tree = await this.load(); } catch { tree = undefined; }
        if (tree != null && !this.disposed) this.apply(tree);
      } while (this.owed && !this.disposed);
    } finally {
      this.running = false;
    }
  }
}
