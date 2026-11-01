import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export interface Link {
  code: string;
  url: string;
  clicks: number;
  createdAt: string; // ISO 8601
  /** UTC ISO 8601 time from which the link no longer redirects. Absent means it never expires. */
  expiresAt?: string;
}

export interface LinkStore {
  get(code: string): Link | undefined;
  has(code: string): boolean;
  save(link: Link): void;
  delete(code: string): boolean;
  all(): Link[];
}

/** Keeps links in memory. Used by tests and as the base of the file store. */
export class MemoryStore implements LinkStore {
  protected links = new Map<string, Link>();

  get(code: string): Link | undefined {
    const link = this.links.get(code);
    return link ? { ...link } : undefined;
  }

  has(code: string): boolean {
    return this.links.has(code);
  }

  save(link: Link): void {
    this.links.set(link.code, { ...link });
  }

  delete(code: string): boolean {
    return this.links.delete(code);
  }

  all(): Link[] {
    return [...this.links.values()].map((l) => ({ ...l }));
  }
}

/** Memory store that also writes every change to one JSON file. */
export class FileStore extends MemoryStore {
  private path: string;

  constructor(path: string) {
    super();
    this.path = path;
    if (existsSync(path)) {
      const saved = JSON.parse(readFileSync(path, 'utf8')) as Link[];
      for (const link of saved) this.links.set(link.code, link);
    }
  }

  override save(link: Link): void {
    super.save(link);
    this.flush();
  }

  override delete(code: string): boolean {
    const removed = super.delete(code);
    if (removed) this.flush();
    return removed;
  }

  private flush(): void {
    writeFileSync(this.path, JSON.stringify(this.all(), null, 2));
  }
}
