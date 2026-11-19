// Refusals: unsaved edits offer save and retry, lint blocks list their findings, anything else is shown as is (R5.5, R5.6).
import { describe, it, expect, beforeEach } from 'vitest';
import { Uri, answers, folder, openDocument, recorded, resetRecorded } from './vscode-stub.js';
import { registerOpen } from '../src/tree.js';
import { RESTART, SAVE_AND_RETRY, fileUri, showRefusal, showStopped, structuredError } from '../src/refusal.js';
import { ServerPool, type CreateClient } from '../src/servers.js';
import type { StructuredError } from '../src/protocol.js';

beforeEach(() => resetRecorded());

const app = folder('/work/app');

/** A refusal as the language client hands it over: a `ResponseError` with the Structured_Error as `data`. */
function responseError(data: Partial<StructuredError> & Pick<StructuredError, 'code' | 'message'>): Error {
  return Object.assign(new Error(data.message), { code: -32803, data: { protocolVersion: 1, ...data } });
}

describe('structuredError', () => {
  it('reads the data of a ResponseError and takes a parsed CLI error as it is', () => {
    expect(structuredError(responseError({ code: 'failed', message: 'boom' }))?.code).toBe('failed');
    expect(structuredError({ protocolVersion: 1, code: 'not-found', message: 'no' })?.code).toBe('not-found');
  });

  it('finds none in a plain error or a value that is not one', () => {
    expect(structuredError(new Error('x'))).toBeUndefined();
    expect(structuredError('x')).toBeUndefined();
    expect(structuredError(undefined)).toBeUndefined();
  });
});

describe('fileUri', () => {
  it('keeps an absolute path and puts a relative one under the folder', () => {
    expect(fileUri(app, '/work/app/a.md').toString()).toBe('file:///work/app/a.md');
    expect(fileUri(app, '.steno/specs/auth/tasks.md').toString()).toBe('file:///work/app/.steno/specs/auth/tasks.md');
    expect(fileUri(app, 'C:\\work\\a.md').fsPath).toBe('C:\\work\\a.md');
  });
});

describe('showRefusal', () => {
  const unsaved = (file: string) => responseError({ code: 'unsaved-edits', message: `${file} has unsaved edits; save it first`, file });

  it('names the unsaved file, and "Save and retry" saves it and retries once (R5.5)', async () => {
    const tasks = Uri.file('/work/app/.steno/specs/auth/tasks.md');
    openDocument(tasks);
    answers.message = SAVE_AND_RETRY;
    let retried = 0;
    await showRefusal(unsaved(tasks.fsPath), app, async () => { retried++; });
    expect(recorded.error).toEqual(['.steno/specs/auth/tasks.md has unsaved edits']);
    expect(recorded.saved).toEqual([tasks.toString()]);
    expect(retried).toBe(1);
  });

  it('resolves a relative file against the folder before it saves (R5.5)', async () => {
    openDocument(Uri.file('/work/app/.steno/specs/auth/spec.yaml'));
    answers.message = SAVE_AND_RETRY;
    await showRefusal(unsaved('.steno/specs/auth/spec.yaml'), app, async () => {});
    expect(recorded.saved).toEqual(['file:///work/app/.steno/specs/auth/spec.yaml']);
  });

  it('neither saves nor retries when the user dismisses it', async () => {
    openDocument(Uri.file('/work/app/a.md'));
    let retried = 0;
    await showRefusal(unsaved('/work/app/a.md'), app, async () => { retried++; });
    expect(recorded.saved).toEqual([]);
    expect(retried).toBe(0);
  });

  it('lists each lint finding as file:line and opens the chosen one at its line (R5.6)', async () => {
    registerOpen();
    const err = responseError({
      code: 'lint-blocked', message: 'auth: fix the requirements lint errors first', spec: 'auth',
      findings: [
        { file: '.steno/specs/auth/requirements.md', line: 12, severity: 'error', rule: 'ears', message: 'no SHALL' },
        { file: '.steno/specs/auth/requirements.md', line: 30, severity: 'error', rule: 'ids', message: 'duplicate id' },
      ],
    });
    answers.pick = '.steno/specs/auth/requirements.md:30';
    await showRefusal(err, app);
    expect(recorded.picks).toEqual([{
      title: 'auth: fix the requirements lint errors first',
      labels: ['.steno/specs/auth/requirements.md:12', '.steno/specs/auth/requirements.md:30'],
    }]);
    expect(recorded.opened).toEqual([{ uri: 'file:///work/app/.steno/specs/auth/requirements.md', line: 30 }]);
  });

  it('shows any other refusal as an error with its message (R5.6)', async () => {
    await showRefusal(responseError({ code: 'invalid-request', message: 'requirements already approved' }), app);
    await showRefusal(new Error('connection lost'), app);
    expect(recorded.error).toEqual(['requirements already approved', 'connection lost']);
  });
});

describe('showStopped', () => {
  it('names the stopped folder and restarts it on "Restart" (R1.4)', async () => {
    const log: string[] = [];
    const create: CreateClient = () => ({
      start: async () => { log.push('start'); },
      stop: async () => {},
      sendRequest: async <T>() => undefined as T,
      onNotification: () => ({ dispose: () => {} }),
    });
    const pool = new ServerPool('/ext/dist/steno-lsp.mjs', create);
    await pool.start(app);
    const server = pool.all()[0];
    server.state = 'stopped';
    answers.message = RESTART;
    await showStopped(pool, server);
    expect(recorded.error).toEqual(['steno server for app is stopped']);
    expect(server.state).toBe('running');
    expect(log).toEqual(['start', 'start']);
  });
});
