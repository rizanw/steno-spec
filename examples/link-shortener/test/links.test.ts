import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isExpired, LinkError, LinkService, normalizeUrl, parseExpiry } from '../src/links.ts';
import { MemoryStore, type Link } from '../src/store.ts';

function service(): LinkService {
  return new LinkService(new MemoryStore());
}

function kindOf(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    if (err instanceof LinkError) return err.kind;
    throw err;
  }
  return 'no error';
}

test('create generates a 6-character code and stores the link', () => {
  const links = service();
  const link = links.create({ url: 'https://example.com/a' });
  assert.match(link.code, /^[0-9A-Za-z]{6}$/);
  assert.equal(link.clicks, 0);
  assert.equal(links.get(link.code).url, 'https://example.com/a');
});

test('create accepts a custom code', () => {
  const link = service().create({ url: 'https://example.com', code: 'my-link' });
  assert.equal(link.code, 'my-link');
});

test('create rejects a custom code that is taken, malformed or reserved', () => {
  const links = service();
  links.create({ url: 'https://example.com', code: 'docs' });
  assert.equal(kindOf(() => links.create({ url: 'https://example.com', code: 'docs' })), 'code_taken');
  assert.equal(kindOf(() => links.create({ url: 'https://example.com', code: 'a b' })), 'invalid_code');
  assert.equal(kindOf(() => links.create({ url: 'https://example.com', code: 'links' })), 'invalid_code');
});

test('normalizeUrl accepts only absolute http(s) URLs', () => {
  assert.equal(normalizeUrl(' https://example.com '), 'https://example.com/');
  assert.equal(kindOf(() => normalizeUrl('')), 'invalid_url');
  assert.equal(kindOf(() => normalizeUrl('example.com')), 'invalid_url');
  assert.equal(kindOf(() => normalizeUrl('ftp://example.com')), 'invalid_url');
  assert.equal(kindOf(() => normalizeUrl(42)), 'invalid_url');
});

test('resolve returns the target and counts a click; get does not', () => {
  const links = service();
  const { code } = links.create({ url: 'https://example.com/a' });
  assert.equal(links.resolve(code), 'https://example.com/a');
  assert.equal(links.resolve(code), 'https://example.com/a');
  assert.equal(links.get(code).clicks, 2);
});

test('get, resolve and remove report an unknown code', () => {
  const links = service();
  assert.equal(kindOf(() => links.get('nope12')), 'not_found');
  assert.equal(kindOf(() => links.resolve('nope12')), 'not_found');
  assert.equal(kindOf(() => links.remove('nope12')), 'not_found');
});

test('remove deletes the link', () => {
  const links = service();
  const { code } = links.create({ url: 'https://example.com' });
  links.remove(code);
  assert.equal(kindOf(() => links.get(code)), 'not_found');
});

// --- link expiry ---

const T0 = new Date('2030-01-01T00:00:00.000Z');

/** A clock the test moves by hand. */
function fakeClock(start: Date = T0): { now: () => Date; advance: (ms: number) => void } {
  let current = start.getTime();
  return { now: () => new Date(current), advance: (ms) => { current += ms; } };
}

function linkWith(expiresAt?: string): Link {
  const link: Link = { code: 'abc123', url: 'https://example.com/', clicks: 3, createdAt: T0.toISOString() };
  if (expiresAt !== undefined) link.expiresAt = expiresAt;
  return link;
}

test('isExpired is true exactly when expiresAt is set and not later than now (Property 1)', () => {
  const cases: Array<[string | undefined, string, boolean]> = [
    [undefined, '2030-01-01T00:00:00.000Z', false],
    [undefined, '2999-01-01T00:00:00.000Z', false],
    ['2030-01-01T00:00:01.000Z', '2030-01-01T00:00:00.000Z', false],
    ['2030-01-01T00:00:00.001Z', '2030-01-01T00:00:00.000Z', false],
    ['2030-01-01T00:00:00.000Z', '2030-01-01T00:00:00.000Z', true],
    ['2030-01-01T00:00:00.000Z', '2030-01-01T00:00:00.001Z', true],
    ['2030-01-01T00:00:00.000Z', '2031-06-01T12:00:00.000Z', true],
  ];
  for (const [expiresAt, now, expected] of cases) {
    assert.equal(isExpired(linkWith(expiresAt), new Date(now)), expected, `${expiresAt} at ${now}`);
  }
});

test('isExpired does not change the link', () => {
  const link = linkWith('2030-01-01T00:00:00.000Z');
  const before = { ...link };
  isExpired(link, new Date('2031-01-01T00:00:00.000Z'));
  assert.deepEqual(link, before);
});

test('create takes createdAt from the clock', () => {
  const clock = fakeClock();
  const links = new LinkService(new MemoryStore(), clock.now);
  assert.equal(links.create({ url: 'https://example.com' }).createdAt, T0.toISOString());
  clock.advance(5_000);
  assert.equal(links.create({ url: 'https://example.com' }).createdAt, '2030-01-01T00:00:05.000Z');
});

test('parseExpiry returns undefined when no expiry is given', () => {
  assert.equal(parseExpiry(undefined, T0), undefined);
});

test('parseExpiry returns the UTC form of a future zoned time', () => {
  assert.equal(parseExpiry('2030-01-01T00:00:01Z', T0), '2030-01-01T00:00:01.000Z');
  assert.equal(parseExpiry('2030-01-01T09:30:00+07:00', T0), '2030-01-01T02:30:00.000Z');
  assert.equal(parseExpiry('2030-06-01T12:00Z', T0), '2030-06-01T12:00:00.000Z');
});

test('parseExpiry rejects input that is not a zoned ISO 8601 time', () => {
  const bad: unknown[] = [
    '', 'tomorrow', '2031-01-01', '2031-01-01T00:00:00', '2031-01-01 00:00:00Z', '01/02/2031',
    '2031-13-01T00:00:00Z', '2031-02-30T00:00:00Z', '2031-01-01T25:00:00Z', 1924992000000, null, {}, true,
  ];
  for (const raw of bad) {
    assert.equal(kindOf(() => parseExpiry(raw, T0)), 'invalid_expiry', JSON.stringify(raw));
  }
});

test('parseExpiry rejects a time equal to or earlier than now', () => {
  assert.equal(kindOf(() => parseExpiry('2030-01-01T00:00:00Z', T0)), 'invalid_expiry');
  assert.equal(kindOf(() => parseExpiry('2029-12-31T23:59:59Z', T0)), 'invalid_expiry');
  assert.equal(kindOf(() => parseExpiry('2030-01-01T06:00:00+07:00', T0)), 'invalid_expiry');
});

test('create stores a future expiry in UTC form', () => {
  const store = new MemoryStore();
  const links = new LinkService(store, fakeClock().now);
  const link = links.create({ url: 'https://example.com', code: 'promo', expiresAt: '2030-01-08T07:00:00+07:00' });
  assert.equal(link.expiresAt, '2030-01-08T00:00:00.000Z');
  assert.equal(store.get('promo')?.expiresAt, '2030-01-08T00:00:00.000Z');
});

test('create without an expiry stores a link with no expiresAt field', () => {
  const store = new MemoryStore();
  new LinkService(store, fakeClock().now).create({ url: 'https://example.com', code: 'forever' });
  assert.equal('expiresAt' in store.get('forever')!, false);
});

test('a rejected expiry creates nothing (Property 3)', () => {
  const store = new MemoryStore();
  const links = new LinkService(store, fakeClock().now);
  links.create({ url: 'https://example.com', code: 'kept' });
  const before = store.all();
  for (const expiresAt of ['soon', '2031-01-01T00:00:00', '2030-01-01T00:00:00Z', '2001-01-01T00:00:00Z', 0, null]) {
    assert.equal(kindOf(() => links.create({ url: 'https://example.com', expiresAt })), 'invalid_expiry');
    assert.equal(kindOf(() => links.create({ url: 'https://example.com', code: 'new-code', expiresAt })), 'invalid_expiry');
  }
  assert.deepEqual(store.all(), before);
});

const HOUR = 60 * 60 * 1000;

/** A service at T0 holding one link, code "promo", that expires one hour later. */
function withExpiringLink() {
  const clock = fakeClock();
  const store = new MemoryStore();
  const links = new LinkService(store, clock.now);
  links.create({ url: 'https://example.com/sale', code: 'promo', expiresAt: '2030-01-01T01:00:00Z' });
  return { clock, store, links };
}

test('resolve redirects and counts clicks until the expiry time', () => {
  const { clock, store, links } = withExpiringLink();
  assert.equal(links.resolve('promo'), 'https://example.com/sale');
  clock.advance(HOUR - 1);
  assert.equal(links.resolve('promo'), 'https://example.com/sale');
  assert.equal(store.get('promo')?.clicks, 2);
});

test('resolve refuses a link at and after its expiry time', () => {
  const { clock, links } = withExpiringLink();
  clock.advance(HOUR);
  assert.equal(kindOf(() => links.resolve('promo')), 'expired');
  clock.advance(365 * 24 * HOUR);
  assert.equal(kindOf(() => links.resolve('promo')), 'expired');
});

test('visits to an expired link never change it (Property 2)', () => {
  const { clock, store, links } = withExpiringLink();
  links.resolve('promo');
  clock.advance(HOUR);
  const before = store.get('promo');
  for (let i = 0; i < 5; i++) assert.equal(kindOf(() => links.resolve('promo')), 'expired');
  assert.deepEqual(store.get('promo'), before);
  assert.equal(before?.clicks, 1);
});

test('an expired link is reported differently from an unknown code', () => {
  const { clock, links } = withExpiringLink();
  clock.advance(HOUR);
  assert.equal(kindOf(() => links.resolve('promo')), 'expired');
  assert.equal(kindOf(() => links.resolve('never-made')), 'not_found');
});

test('a link without an expiry keeps redirecting', () => {
  const clock = fakeClock();
  const links = new LinkService(new MemoryStore(), clock.now);
  links.create({ url: 'https://example.com', code: 'forever' });
  clock.advance(100 * 365 * 24 * HOUR);
  assert.equal(links.resolve('forever'), 'https://example.com/');
});

test('get shows the expiry time and marks the link as not expired before it', () => {
  const { links } = withExpiringLink();
  const view = links.get('promo');
  assert.equal(view.expiresAt, '2030-01-01T01:00:00.000Z');
  assert.equal(view.expired, false);
});

test('get returns an expired link marked as expired instead of failing', () => {
  const { clock, links } = withExpiringLink();
  clock.advance(HOUR);
  const view = links.get('promo');
  assert.equal(view.expired, true);
  assert.equal(view.url, 'https://example.com/sale');
});

test('get shows no expiry time for a link that never expires', () => {
  const links = new LinkService(new MemoryStore(), fakeClock().now);
  links.create({ url: 'https://example.com', code: 'forever' });
  const view = links.get('forever');
  assert.equal('expiresAt' in view, false);
  assert.equal(view.expired, false);
});

test('create returns the link marked as not expired', () => {
  const { links } = withExpiringLink();
  assert.equal(links.create({ url: 'https://example.com' }).expired, false);
});

test('the expired flag is never written to the store', () => {
  const { clock, store, links } = withExpiringLink();
  links.get('promo');
  links.resolve('promo');
  clock.advance(HOUR);
  links.get('promo');
  for (const link of store.all()) assert.equal('expired' in link, false);
});

test('a custom code held by an expired link is still taken', () => {
  const { clock, links } = withExpiringLink();
  clock.advance(HOUR);
  assert.equal(kindOf(() => links.create({ url: 'https://example.com/new', code: 'promo' })), 'code_taken');
  assert.equal(links.get('promo').url, 'https://example.com/sale');
});

test('a generated code is never one the store already holds, expired or not', () => {
  // The store reports the first candidate code as held, which is how an expired link's code looks to the service.
  const offered: string[] = [];
  class OneCodeHeld extends MemoryStore {
    override has(code: string): boolean {
      offered.push(code);
      return offered.length === 1 || super.has(code);
    }
  }
  const link = new LinkService(new OneCodeHeld(), fakeClock().now).create({ url: 'https://example.com' });
  assert.equal(offered.length, 2);
  assert.notEqual(link.code, offered[0]);
  assert.equal(link.code, offered[1]);
});

test('an expired link can be removed, and its code can then be used again', () => {
  const { clock, links } = withExpiringLink();
  clock.advance(HOUR);
  links.remove('promo');
  assert.equal(kindOf(() => links.get('promo')), 'not_found');
  const reused = links.create({ url: 'https://example.com/new', code: 'promo' });
  assert.equal(reused.url, 'https://example.com/new');
  assert.equal(links.resolve('promo'), 'https://example.com/new');
});
