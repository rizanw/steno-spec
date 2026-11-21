import { describe, expect, it } from 'vitest';
import { call, change, PanelSnapshot, panel } from '../shared/contracts';

const snapshot = () => ({
  specRows: [
    { key: 'h:specs', depth: 0, kind: 'header', label: 'Specs', actions: ['newSpec'], primary: 'newSpec' },
    { key: 's:demo', parent: 'h:specs', depth: 1, kind: 'spec', label: 'Demo', detail: 'design', icon: 'spec', target: { spec: 'demo' }, actions: ['write'], primary: 'write' },
    {
      key: 'd:demo/design.md', parent: 's:demo', depth: 2, kind: 'document', label: 'Design', icon: 'document',
      target: { spec: 'demo', phase: 'design' }, path: '.steno/specs/demo/design.md', problems: { errors: 1, warnings: 0 },
      actions: ['approve', 'open'], primary: 'approve',
    },
  ],
  steeringRows: [{ key: 'h:steering', depth: 0, kind: 'header', label: 'Steering', actions: ['steer'] }],
  diagnostics: { '.steno/specs/demo/design.md': [{ file: 'design.md', line: 3, severity: 'error', rule: 'trace/uncovered', message: 'no section' }] },
  server: 'running',
  agentSteno: { found: true, protocol: 1, version: '0.1.3', matches: true, bundled: '0.1.3' },
});

describe('the panel snapshot', () => {
  it('accepts a full snapshot', () => {
    expect(PanelSnapshot.safeParse(snapshot()).success).toBe(true);
    expect(panel.event.safeParse({ ...snapshot(), intent: 'approve' }).success).toBe(true);
  });

  it('rejects an unknown action, a missing field and a primary the row does not offer', () => {
    const unknownAction = snapshot(); unknownAction.specRows[0].actions = ['launch'];
    const { server: _, ...noServer } = snapshot();
    const strayPrimary = snapshot(); strayPrimary.specRows[1].primary = 'runNext';
    for (const bad of [unknownAction, noServer, strayPrimary]) expect(PanelSnapshot.safeParse(bad).success).toBe(false);
  });
});

describe('the RPC contracts', () => {
  it('carries a refusal as a value', () => {
    const refusal = { ok: false, error: { protocolVersion: 1, code: 'lint-blocked', message: 'design has errors' } };
    expect(change.output.safeParse(refusal).success).toBe(true);
    expect(change.input.safeParse({ workspaceId: 'w', kind: 'publish', spec: 'demo' }).success).toBe(false);
  });

  it('takes only the hand-offs core knows', () => {
    expect(call.input.safeParse({ workspaceId: 'w', handoff: { kind: 'run', spec: 'demo', task: 'T1.1' } }).success).toBe(true);
    expect(call.input.safeParse({ workspaceId: 'w', handoff: { kind: 'write', spec: 'demo' } }).success).toBe(false);
  });
});
