import { afterEach, describe, expect, it } from 'vitest';
import type { PanelSnapshot } from '../shared/contracts';
import { createIntents } from '../server/intent';
import { createPool, type ServerPool } from '../server/pool';
import { streamPanel } from '../server/snapshot';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('the intent store', () => {
  it('gives an intent to one take only, per workspace', () => {
    const intents = createIntents();
    intents.set('a', 'approve');
    intents.set('b', 'done');
    expect(intents.take('a')).toBe('approve');
    expect(intents.take('a')).toBeUndefined();
    expect(intents.take('b')).toBe('done');
  });

  it('keeps only the latest intent', () => {
    const intents = createIntents();
    intents.set('a', 'approve');
    intents.set('a', 'run');
    expect(intents.take('a')).toBe('run');
  });
});

/** A pool whose server never starts, so the panel pushes at once; the intent is all these tests look at. */
let pool: ServerPool;
afterEach(() => pool?.dispose());

function subscribe(intents: ReturnType<typeof createIntents>, directory: string) {
  const events: PanelSnapshot[] = [];
  const stop = new AbortController();
  const opened = streamPanel(pool, { workspaceId: 'ws', directory, signal: stop.signal, push: async s => { events.push(s); } }, { intents, throttleMs: 10, log: () => {} });
  return { events, opened, stop: () => stop.abort() };
}

const until = async (check: () => boolean) => {
  const end = Date.now() + 2_000;
  while (!check() && Date.now() < end) await new Promise(r => setTimeout(r, 5));
  expect(check()).toBe(true);
};

describe('an intent in the panel stream', () => {
  const directory = () => mkdtempSync(join(tmpdir(), 'steno-paseo-intent-'));
  const stopped = () => createPool({ start: () => { throw new Error('no server here'); }, log: () => {} });

  it('rides in one push, set before or while the panel is open', async () => {
    pool = stopped();
    const intents = createIntents();
    intents.set('ws', 'approve');
    const sub = subscribe(intents, directory());
    await sub.opened;
    expect(sub.events.map(e => e.intent)).toEqual(['approve']);

    intents.set('ws', 'done');
    await until(() => sub.events.length === 2);
    expect(sub.events[1].intent).toBe('done');
    sub.stop();
  });

  it('is not repeated to a panel that reconnects', async () => {
    pool = stopped();
    const intents = createIntents();
    const dir = directory();
    intents.set('ws', 'review');
    const first = subscribe(intents, dir);
    await first.opened;
    first.stop();
    const second = subscribe(intents, dir);
    await second.opened;
    expect(first.events[0].intent).toBe('review');
    expect(second.events[0].intent).toBeUndefined();
    second.stop();
  });

  it('drops an intent replaced before any push', async () => {
    pool = stopped();
    const intents = createIntents();
    intents.set('ws', 'approve');
    intents.set('ws', 'reopen');
    const sub = subscribe(intents, directory());
    await sub.opened;
    intents.set('ws', 'run');
    intents.set('ws', 'write');
    await until(() => sub.events.length === 2);
    await new Promise(r => setTimeout(r, 50));
    expect(sub.events.map(e => e.intent)).toEqual(['reopen', 'write']);
    sub.stop();
  });
});
