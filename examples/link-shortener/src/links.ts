import { randomInt } from 'node:crypto';
import type { Link, LinkStore } from './store.ts';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const CODE_LENGTH = 6;
const CUSTOM_CODE = /^[A-Za-z0-9_-]{3,32}$/;
/** Codes that would shadow an API route. */
const RESERVED = new Set(['links', 'health']);
/** ISO 8601 date-time that states its zone: `Z` or a `±hh:mm` offset. */
const ZONED_ISO = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const EXPIRY_HINT = 'expiresAt must be a future ISO 8601 time with a time zone, for example 2030-01-31T12:00:00Z';

export type LinkErrorKind = 'invalid_url' | 'invalid_code' | 'invalid_expiry' | 'code_taken' | 'not_found' | 'expired';

export class LinkError extends Error {
  kind: LinkErrorKind;

  constructor(kind: LinkErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

export interface CreateLinkInput {
  url: string;
  /** Optional caller-chosen code. A random one is generated when omitted. */
  code?: string;
  /** Optional expiry time; unchecked input, validated by parseExpiry. */
  expiresAt?: unknown;
}

/** A link as shown to callers: the stored fields plus whether it is expired right now. */
export type LinkView = Link & { expired: boolean };

/** Source of the current time; tests pass their own to move time forward. */
export type Clock = () => Date;

/** True when the link has an expiry time that is equal to or earlier than `now`. */
export function isExpired(link: Link, now: Date): boolean {
  return link.expiresAt !== undefined && Date.parse(link.expiresAt) <= now.getTime();
}

export class LinkService {
  private store: LinkStore;
  private clock: Clock;

  constructor(store: LinkStore, clock: Clock = () => new Date()) {
    this.store = store;
    this.clock = clock;
  }

  create(input: CreateLinkInput): LinkView {
    const url = normalizeUrl(input.url);
    const code = input.code === undefined ? this.freshCode() : this.checkCustomCode(input.code);
    const now = this.clock();
    const expiresAt = parseExpiry(input.expiresAt, now);
    const link: Link = { code, url, clicks: 0, createdAt: now.toISOString() };
    if (expiresAt !== undefined) link.expiresAt = expiresAt;
    this.store.save(link);
    return { ...link, expired: false };
  }

  /** Looks a link up without counting a click. An expired link is returned, marked as expired. */
  get(code: string): LinkView {
    const link = this.find(code);
    return { ...link, expired: isExpired(link, this.clock()) };
  }

  /** The stored link, without the computed `expired` flag, so the flag is never saved. */
  private find(code: string): Link {
    const link = this.store.get(code);
    if (!link) throw new LinkError('not_found', `no link with code "${code}"`);
    return link;
  }

  /** Follows a link: counts one click and returns the target URL. An expired link is refused and left untouched. */
  resolve(code: string): string {
    const link = this.find(code);
    if (isExpired(link, this.clock())) throw new LinkError('expired', `link "${code}" has expired`);
    link.clicks += 1;
    this.store.save(link);
    return link.url;
  }

  remove(code: string): void {
    if (!this.store.delete(code)) throw new LinkError('not_found', `no link with code "${code}"`);
  }

  private checkCustomCode(code: string): string {
    if (!CUSTOM_CODE.test(code) || RESERVED.has(code)) {
      throw new LinkError('invalid_code', 'code must be 3-32 characters: letters, digits, "-" or "_"');
    }
    if (this.store.has(code)) throw new LinkError('code_taken', `code "${code}" is already in use`);
    return code;
  }

  private freshCode(): string {
    for (;;) {
      let code = '';
      for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
      if (!this.store.has(code) && !RESERVED.has(code)) return code;
    }
  }
}

/** Accepts only absolute http(s) URLs and returns the normalized form. */
export function normalizeUrl(raw: unknown): string {
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new LinkError('invalid_url', 'url is required');
  }
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new LinkError('invalid_url', 'url is not a valid absolute URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new LinkError('invalid_url', 'url must use http or https');
  }
  return parsed.toString();
}

/**
 * Turns the raw `expiresAt` input into the stored UTC form.
 * Returns undefined when no expiry was given; throws `invalid_expiry` for anything else that is not a zoned time later than `now`.
 */
export function parseExpiry(raw: unknown, now: Date): string | undefined {
  if (raw === undefined) return undefined;
  const match = typeof raw === 'string' ? ZONED_ISO.exec(raw) : null;
  if (!match) throw new LinkError('invalid_expiry', EXPIRY_HINT);
  const time = Date.parse(raw as string);
  // Date.parse rolls impossible days over (30 February becomes 2 March), so check the calendar date.
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(time) || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) {
    throw new LinkError('invalid_expiry', EXPIRY_HINT);
  }
  if (time <= now.getTime()) throw new LinkError('invalid_expiry', EXPIRY_HINT);
  return new Date(time).toISOString();
}
