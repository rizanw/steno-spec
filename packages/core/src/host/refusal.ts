// How a host reads steno's answer, from the language server or the bundled CLI alike. A refusal is steno saying no
// on purpose (lint errors, unsaved edits) and is passed on unchanged so the host can show its findings; anything
// else that goes wrong becomes a plain `failed` error with the CLI's own words in it.
import { PROTOCOL_VERSION, type StructuredError } from '../contract.js';

/** How the CLI ended: its exit code, or `null` when it was killed, and both streams in full. */
export interface CliExit { code: number | null; stdout: string; stderr: string }

/**
 * The CLI's answer or why there is none. `log` is the CLI's full standard error on a failure: it goes to the host's
 * log only, and sits outside `StructuredError` so the JSON contract stays as it is.
 */
export type CliOutcome<T> = { ok: true; value: T } | { ok: false; error: StructuredError; log?: string };

function isStructured(value: unknown): value is StructuredError {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.code === 'string' && typeof v.message === 'string';
}

/**
 * The refusal a value carries: the value itself, as the CLI's parsed output is, or the `data` of a server's
 * `ResponseError`. An `Error` is read only through its `data`: a Node `ENOENT` has a string `code` and `message`
 * too, and is not steno refusing.
 */
export function readRefusal(err: unknown): StructuredError | undefined {
  if (isStructured(err) && !(err instanceof Error)) return err;
  const data = (err as { data?: unknown } | null | undefined)?.data;
  return isStructured(data) ? data : undefined;
}

/** A `failed` error, the one code a host makes up itself. */
export const failed = (message: string): StructuredError => ({ protocolVersion: PROTOCOL_VERSION, code: 'failed', message });

/** Standard output as one JSON object, or `undefined` when it is anything else. */
function parsed(stdout: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(stdout);
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
  } catch { return undefined; }
}

/** The first non-blank line of a stream: a stack trace's first line names the error, the rest is for the log. */
const firstLine = (text: string) => text.split(/\r?\n/).find(line => line.trim().length > 0)?.trim() ?? '';

/**
 * Read a `steno --json` run. Exit 0 with a JSON object is the answer, as `T`; exit 1 or 2 with a refusal is that
 * refusal. Everything else (a kill, a crash, output that is not JSON, a refusal on another exit) is `failed`,
 * naming the exit code and the first line of standard error. `T` is not checked: a caller checks the fields it reads.
 */
export function readCliExit<T>(exit: CliExit): CliOutcome<T> {
  const json = parsed(exit.stdout);
  if (exit.code === 0 && json) return { ok: true, value: json as T };
  const refusal = exit.code === 1 || exit.code === 2 ? readRefusal(json) : undefined;
  if (refusal) return { ok: false, error: refusal };
  const log = exit.stderr.trim() ? { log: exit.stderr } : {};
  if (exit.code === null) return { ok: false, error: failed('steno was stopped before it finished'), ...log };
  const detail = firstLine(exit.stderr);
  return { ok: false, error: failed(`steno exited with code ${exit.code}${detail ? `: ${detail}` : ''}`), ...log };
}
