import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { LinkError, LinkService } from '../src/links.ts';
import { FileStore } from '../src/store.ts';

const dir = mkdtempSync(join(tmpdir(), 'link-shortener-'));
after(() => rmSync(dir, { recursive: true, force: true }));

const T0 = new Date('2030-01-01T00:00:00.000Z');
const HOUR = 60 * 60 * 1000;
const at = (ms: number) => () => new Date(T0.getTime() + ms);

/** A fresh FileStore on the same file stands for the process restarting. */
function restart(file: string, clock: () => Date): LinkService {
  return new LinkService(new FileStore(file), clock);
}

test('the expiry time survives a restart', () => {
  const file = join(dir, 'survives.json');
  restart(file, at(0)).create({ url: 'https://example.com/sale', code: 'promo', expiresAt: '2030-01-01T01:00:00Z' });

  const view = restart(file, at(1)).get('promo');
  assert.equal(view.expiresAt, '2030-01-01T01:00:00.000Z');
  assert.equal(view.expired, false);
});

test('a link whose expiry time passed while the service was down is expired after the restart', () => {
  const file = join(dir, 'passed.json');
  const before = restart(file, at(0));
  before.create({ url: 'https://example.com/sale', code: 'promo', expiresAt: '2030-01-01T01:00:00Z' });
  before.resolve('promo');

  const afterRestart = restart(file, at(2 * HOUR));
  assert.throws(() => afterRestart.resolve('promo'), (err) => err instanceof LinkError && err.kind === 'expired');
  const view = afterRestart.get('promo');
  assert.equal(view.expired, true);
  assert.equal(view.clicks, 1);
  assert.equal(view.createdAt, T0.toISOString());
});

test('a link stored before the feature existed never expires', () => {
  const file = join(dir, 'legacy.json');
  const legacy = [{ code: 'old-link', url: 'https://example.com/old', clicks: 7, createdAt: '2020-05-01T00:00:00.000Z' }];
  writeFileSync(file, JSON.stringify(legacy));

  const links = restart(file, at(50 * 365 * 24 * HOUR));
  const view = links.get('old-link');
  assert.equal('expiresAt' in view, false);
  assert.equal(view.expired, false);
  assert.equal(links.resolve('old-link'), 'https://example.com/old');
  assert.equal(links.get('old-link').clicks, 8);
});
