// Reading steno's answers: a refusal from the server or the CLI read the same way, and every other ending of a
// CLI run turned into a `failed` error that names the exit code and the CLI's own first line of standard error.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { readCliExit, readRefusal, type CliExit } from '../../src/host/refusal.js';
import type { StructuredError } from '../../src/contract.js';

/** A refusal as the language client hands it over: a `ResponseError` with the structured error as `data`. */
function responseError(data: Pick<StructuredError, 'code' | 'message'> & Partial<StructuredError>): Error {
  return Object.assign(new Error(data.message), { code: -32803, data: { protocolVersion: 1, ...data } });
}

const lintBlocked: StructuredError = {
  protocolVersion: 1, code: 'lint-blocked', message: 'auth: fix the requirements lint errors first', spec: 'auth',
  findings: [{ file: '.steno/specs/auth/requirements.md', line: 12, severity: 'error', rule: 'ears', message: 'no SHALL' }],
};

describe('readRefusal', () => {
  it('reads the data of a ResponseError and takes a parsed CLI error as it is', () => {
    expect(readRefusal(responseError({ code: 'failed', message: 'boom' }))?.code).toBe('failed');
    expect(readRefusal({ protocolVersion: 1, code: 'not-found', message: 'no' })?.code).toBe('not-found');
  });

  it('finds none in a plain error or a value that is not one', () => {
    expect(readRefusal(new Error('x'))).toBeUndefined();
    expect(readRefusal('x')).toBeUndefined();
    expect(readRefusal(undefined)).toBeUndefined();
    expect(readRefusal(null)).toBeUndefined();
  });

  it('does not take a Node error for a refusal, though it has a string code and message', () => {
    const enoent = Object.assign(new Error('spawn steno ENOENT'), { code: 'ENOENT' });
    expect(readRefusal(enoent)).toBeUndefined();
  });

  it('reads the same refusal from the server and from the CLI', () => {
    const fromServer = readRefusal(responseError(lintBlocked));
    const fromCli = readCliExit({ code: 1, stdout: JSON.stringify(lintBlocked), stderr: '' });
    expect(fromCli).toEqual({ ok: false, error: fromServer });
  });
});

describe('readCliExit', () => {
  it('gives the answer on exit 0 with a JSON object', () => {
    expect(readCliExit({ code: 0, stdout: '{"spec":"auth","phase":"requirements"}\n', stderr: '' }))
      .toEqual({ ok: true, value: { spec: 'auth', phase: 'requirements' } });
  });

  it('passes a refusal on exit 1 or 2 through unchanged, with no log', () => {
    for (const code of [1, 2]) expect(readCliExit({ code, stdout: JSON.stringify(lintBlocked), stderr: 'warn' })).toEqual({ ok: false, error: lintBlocked });
  });

  it('says the CLI was stopped when it was killed', () => {
    expect(readCliExit({ code: null, stdout: '', stderr: 'partial\n' }))
      .toEqual({ ok: false, error: { protocolVersion: 1, code: 'failed', message: 'steno was stopped before it finished' }, log: 'partial\n' });
  });

  it('names the exit code and the first non-blank line of a crash, and keeps the whole stream as the log', () => {
    const stderr = '\n  TypeError: x is not a function  \n    at main (cli.js:1:1)\n';
    expect(readCliExit({ code: 7, stdout: '', stderr }))
      .toEqual({ ok: false, error: { protocolVersion: 1, code: 'failed', message: 'steno exited with code 7: TypeError: x is not a function' }, log: stderr });
  });

  it('fails exit 0 when the output is not a JSON object, and a refusal on an exit other than 1 or 2', () => {
    expect(readCliExit({ code: 0, stdout: '[1]', stderr: '' })).toEqual({ ok: false, error: { protocolVersion: 1, code: 'failed', message: 'steno exited with code 0' } });
    expect(readCliExit({ code: 3, stdout: JSON.stringify(lintBlocked), stderr: '' }))
      .toEqual({ ok: false, error: { protocolVersion: 1, code: 'failed', message: 'steno exited with code 3' } });
  });

  it('gives a value only for 0 with an object, a refusal only for 1 or 2, and otherwise names the exit', () => {
    const stdout = fc.oneof(
      fc.dictionary(fc.string(), fc.jsonValue()).map(o => JSON.stringify(o)),
      fc.constant(JSON.stringify(lintBlocked)),
      fc.jsonValue().map(v => JSON.stringify(v)),
      fc.string(),
    );
    const exit: fc.Arbitrary<CliExit> = fc.record({
      code: fc.oneof(fc.constant(null), fc.constantFrom(0, 1, 2), fc.integer({ min: -300, max: 300 })),
      stdout, stderr: fc.string(),
    });
    fc.assert(fc.property(exit, e => {
      const out = readCliExit<unknown>(e);
      let json: unknown;
      try { json = JSON.parse(e.stdout); } catch { json = undefined; }
      const object = typeof json === 'object' && json !== null && !Array.isArray(json) ? json as Record<string, unknown> : undefined;
      const refusing = object !== undefined && typeof object.code === 'string' && typeof object.message === 'string';
      if (e.code === 0 && object) { expect(out).toEqual({ ok: true, value: json }); return; }
      if ((e.code === 1 || e.code === 2) && refusing) { expect(out).toEqual({ ok: false, error: json }); return; }
      expect(out.ok).toBe(false);
      if (out.ok) return;
      expect(out.error.code).toBe('failed');
      if (e.code === null) expect(out.error.message).toBe('steno was stopped before it finished');
      else expect(out.error.message.startsWith(`steno exited with code ${e.code}`)).toBe(true);
    }), { numRuns: 500 });
  });
});
