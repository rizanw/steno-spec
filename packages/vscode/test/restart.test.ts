// How the pool acts on the restart window: a crashed server comes back until five exits land inside three minutes.
import { describe, it, expect, beforeEach } from 'vitest';
import { answers, folder, recorded, resetRecorded } from './vscode-stub.js';
import { MAX_EXITS } from '@steno/core/host';
import { CloseAction, ErrorAction } from './languageclient-stub.js';
import { ServerPool, type ClientHandlers, type CreateClient, type StenoClient } from '../src/servers.js';

const SERVER = '/ext/dist/steno-lsp.mjs';

beforeEach(() => resetRecorded());

/** A pool whose one client records its calls and hands back the handlers the pool gave it. */
function pooled() {
  const log: string[] = [];
  let handlers!: ClientHandlers;
  const create: CreateClient = (_folder, _path, _selector, h) => {
    handlers = h;
    const client: StenoClient = {
      start: async () => { log.push('start'); },
      stop: async () => { log.push('stop'); },
      sendRequest: async <T>() => undefined as T,
      onNotification: () => ({ dispose: () => {} }),
    };
    return client;
  };
  const pool = new ServerPool(SERVER, create);
  return { pool, log, handlers: () => handlers };
}

describe('the pool\'s handlers', () => {
  it('keeps going on a protocol error: the server has not exited', async () => {
    const { pool, handlers } = pooled();
    await pool.start(folder('/work/a'));
    expect(handlers().errorHandler.error(new Error('bad'), undefined, 1).action).toBe(ErrorAction.Continue);
  });

  it('restarts an unexpected exit until the fifth, then stops and names the folder', async () => {
    const { pool, handlers } = pooled();
    await pool.start(folder('/work/a'));
    const h = handlers().errorHandler;
    for (let i = 0; i < MAX_EXITS - 1; i++) expect(h.closed().action).toBe(CloseAction.Restart);
    expect(h.closed().action).toBe(CloseAction.DoNotRestart);
    expect(pool.all()[0].state).toBe('stopped');
    expect(recorded.error).toEqual(['steno server for a stopped after 5 exits in 3 minutes']);
  });

  it('treats a failed start the same way, through initializationFailedHandler', async () => {
    const { pool, handlers } = pooled();
    await pool.start(folder('/work/a'));
    const failed = handlers().initializationFailedHandler;
    for (let i = 0; i < MAX_EXITS - 1; i++) expect(failed(new Error('no'))).toBe(true);
    expect(failed(new Error('no'))).toBe(false);
    expect(pool.all()[0].state).toBe('stopped');
  });

  it('Restart in the error message resets the count and starts the client again', async () => {
    const { pool, log, handlers } = pooled();
    await pool.start(folder('/work/a'));
    answers.message = 'Restart';
    const h = handlers().errorHandler;
    for (let i = 0; i < MAX_EXITS; i++) h.closed();
    await new Promise(resolve => setImmediate(resolve));

    const server = pool.all()[0];
    expect(server.state).toBe('running');
    expect(log).toEqual(['start', 'start']);
    // a clean record: the next exit is a first exit, not a sixth
    expect(h.closed().action).toBe(CloseAction.Restart);
  });

  it('leaves the server stopped when the error message is dismissed', async () => {
    const { pool, log, handlers } = pooled();
    await pool.start(folder('/work/a'));
    const h = handlers().errorHandler;
    for (let i = 0; i < MAX_EXITS; i++) h.closed();
    await new Promise(resolve => setImmediate(resolve));
    expect(pool.all()[0].state).toBe('stopped');
    expect(log).toEqual(['start']);
  });

  it('counts each folder separately, so one noisy folder does not stop another', async () => {
    const made: ClientHandlers[] = [];
    const create: CreateClient = (_f, _p, _s, h) => {
      made.push(h);
      return { start: async () => {}, stop: async () => {}, sendRequest: async <T>() => undefined as T,
        onNotification: () => ({ dispose: () => {} }) };
    };
    const pool = new ServerPool(SERVER, create);
    await pool.start(folder('/work/a'));
    await pool.start(folder('/work/b', 1));
    for (let i = 0; i < MAX_EXITS; i++) made[0].errorHandler.closed();
    expect(pool.all().map(s => s.state)).toEqual(['stopped', 'running']);
    expect(made[1].errorHandler.closed().action).toBe(CloseAction.Restart);
  });
});
