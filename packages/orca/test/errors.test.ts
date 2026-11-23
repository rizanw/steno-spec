import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { noAnswer, unknownOutcome } from '../src/panel/errors.js';
import { orNotify } from '../src/worker/errors.js';
import { openRow } from '../src/worker/open.js';

const rejection = (code: string) => Object.assign(new Error(`rejected: ${code}`), { code, retryable: false });

/** An Orca whose `refuse` method rejects with Orca's message, recording every call it gets. */
function fakeOrca(refuse: string) {
  const calls: { method: string; params: unknown }[] = [];
  const call = async (method: string, params: unknown) => {
    calls.push({ method, params });
    if (method === refuse) throw rejection('action_failed');
    return {};
  };
  return { orca: { host: { call } } as never, calls };
}

describe('a request with no answer', () => {
  it('reads a stopped worker or a timeout as an unknown outcome, and anything else as a failure', () => {
    expect(noAnswer(rejection('unavailable'))).toBe(true);
    expect(noAnswer(rejection('timeout'))).toBe(true);
    expect(noAnswer(rejection('invalid_params'))).toBe(false);
    expect(noAnswer(new Error('plain'))).toBe(false);
    expect(noAnswer(undefined)).toBe(false);
  });

  it('names the action, and says whether the rows are as steno reports them now', () => {
    expect(unknownOutcome('Approve', false)).toMatch(/Approve.*unknown.*out of date/);
    expect(unknownOutcome('Approve', true)).toMatch(/Approve.*unknown.*now/);
  });
});

describe('Orca refusing a call', () => {
  it('turns the rejection into a notification with Orca\'s message', async () => {
    const { orca, calls } = fakeOrca('agent.launch');
    expect(await orNotify(orca, 'Starting claude', () => (orca as { host: { call: (m: string, p: unknown) => Promise<unknown> } }).host.call('agent.launch', {}))).toBe(false);
    expect(calls.at(-1)).toEqual({ method: 'notifications.show', params: { title: 'Starting claude failed', body: 'rejected: action_failed' } });
  });

  it('says nothing when the call goes through', async () => {
    const { orca, calls } = fakeOrca('none');
    expect(await orNotify(orca, 'x', async () => undefined)).toBe(true);
    expect(calls).toEqual([]);
  });

  it('shows a refused editor.open as a notification naming the file', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'steno-orca-errors-'));
    mkdirSync(join(folder, '.steno', 'steering'), { recursive: true });
    writeFileSync(join(folder, '.steno', 'steering', 'tech.md'), '# Tech\n');
    const { orca, calls } = fakeOrca('editor.open');
    const row = { key: 'steering:tech.md', depth: 1, kind: 'steering' as const, label: 'tech', path: '.steno/steering/tech.md', actions: ['open' as const] };
    expect(await openRow(orca, { workspaceId: 'w', folder, server: { folder, tree: {} } as never }, row)).toEqual({ done: true });
    expect(calls.map(c => c.method)).toEqual(['editor.open', 'notifications.show']);
    expect((calls[1]!.params as { title: string }).title).toContain('.steno/steering/tech.md');
  });
});
