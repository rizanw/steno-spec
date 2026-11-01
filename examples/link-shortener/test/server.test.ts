import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { LinkService } from '../src/links.ts';
import { createApp } from '../src/server.ts';
import { MemoryStore } from '../src/store.ts';

let base = '';
// The app's clock is the real time plus an offset the expiry tests move forward.
let clockOffsetMs = 0;
const clock = () => new Date(Date.now() + clockOffsetMs);
const app = createApp(new LinkService(new MemoryStore(), clock), 'http://short.test/');

before(async () => {
  await new Promise<void>((resolve) => app.listen(0, resolve));
  base = `http://localhost:${(app.address() as AddressInfo).port}`;
});

after(() => {
  app.close();
});

function post(body: unknown): Promise<Response> {
  return fetch(`${base}/links`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

test('POST /links creates a link and returns its short URL', async () => {
  const res = await post({ url: 'https://example.com/docs', code: 'docs' });
  assert.equal(res.status, 201);
  const link = await res.json();
  assert.equal(link.code, 'docs');
  assert.equal(link.shortUrl, 'http://short.test/docs');
});

test('POST /links rejects bad input', async () => {
  assert.equal((await post({ url: 'not a url' })).status, 400);
  assert.equal((await post('{not json')).status, 400);
  await post({ url: 'https://example.com', code: 'taken' });
  const dup = await post({ url: 'https://example.com', code: 'taken' });
  assert.equal(dup.status, 409);
  assert.equal((await dup.json()).error, 'code_taken');
});

test('GET /:code redirects and counts the click', async () => {
  await post({ url: 'https://example.com/target', code: 'goto' });
  const res = await fetch(`${base}/goto`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), 'https://example.com/target');
  const info = await (await fetch(`${base}/links/goto`)).json();
  assert.equal(info.clicks, 1);
});

test('unknown codes and routes return 404', async () => {
  assert.equal((await fetch(`${base}/missing`, { redirect: 'manual' })).status, 404);
  assert.equal((await fetch(`${base}/links/missing`)).status, 404);
  assert.equal((await fetch(`${base}/a/b/c`)).status, 404);
});

test('DELETE /links/:code removes the link', async () => {
  await post({ url: 'https://example.com', code: 'temp' });
  assert.equal((await fetch(`${base}/links/temp`, { method: 'DELETE' })).status, 204);
  assert.equal((await fetch(`${base}/links/temp`)).status, 404);
});

// --- link expiry ---

const HOUR = 60 * 60 * 1000;

test('POST /links with a future expiresAt returns it in the link details', async () => {
  const expiresAt = new Date(clock().getTime() + HOUR).toISOString();
  const res = await post({ url: 'https://example.com/sale', code: 'sale', expiresAt });
  assert.equal(res.status, 201);
  const link = await res.json();
  assert.equal(link.expiresAt, expiresAt);
  assert.equal(link.expired, false);
  assert.equal(link.shortUrl, 'http://short.test/sale');
});

test('POST /links without expiresAt returns details with no expiry', async () => {
  const link = await (await post({ url: 'https://example.com', code: 'no-expiry' })).json();
  assert.equal('expiresAt' in link, false);
  assert.equal(link.expired, false);
});

test('POST /links rejects an invalid or past expiresAt with 400 invalid_expiry', async () => {
  for (const expiresAt of ['next week', '2031-01-01T00:00:00', '2001-01-01T00:00:00Z', 12345]) {
    const res = await post({ url: 'https://example.com', code: 'bad-expiry', expiresAt });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, 'invalid_expiry');
  }
  assert.equal((await fetch(`${base}/links/bad-expiry`)).status, 404);
});

test('an expired link answers 410 expired, stays inspectable, and is not counted', async () => {
  const expiresAt = new Date(clock().getTime() + HOUR).toISOString();
  await post({ url: 'https://example.com/flash', code: 'flash', expiresAt });
  assert.equal((await fetch(`${base}/flash`, { redirect: 'manual' })).status, 302);

  clockOffsetMs += HOUR;
  const res = await fetch(`${base}/flash`, { redirect: 'manual' });
  assert.equal(res.status, 410);
  assert.equal(res.headers.get('location'), null);
  assert.equal((await res.json()).error, 'expired');
  assert.equal((await fetch(`${base}/never-made`, { redirect: 'manual' })).status, 404);

  const info = await fetch(`${base}/links/flash`);
  assert.equal(info.status, 200);
  const link = await info.json();
  assert.equal(link.expired, true);
  assert.equal(link.expiresAt, expiresAt);
  assert.equal(link.clicks, 1);
});
