// The plugin installs no dependencies, so its server bundle must carry steno's host code and JSON-RPC itself.
import { describe, expect, it } from 'vitest';

describe('the host bundle', () => {
  it('carries core rules, @steno/host and the JSON-RPC library on its own', async () => {
    const host = await import('../server/vendor/host.mjs');
    expect(typeof host.canApprove).toBe('function');
    expect(typeof host.panelRows).toBe('function');
    for (const name of ['createPool', 'runProgram', 'runToEnd', 'checkAgentSteno', 'watchInstructions']) expect(typeof (host as Record<string, unknown>)[name], name).toBe('function');
    expect(typeof host.createMessageConnection).toBe('function');
  });
});
