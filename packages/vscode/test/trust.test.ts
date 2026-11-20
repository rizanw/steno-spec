// In Restricted Mode, `guard` stops the action and tells the user why.
import { describe, it, expect, beforeEach } from 'vitest';
import { answers, recorded, resetRecorded, workspace } from './vscode-stub.js';
import { guard } from '../src/trust.js';

beforeEach(() => resetRecorded());

describe('guard', () => {
  it('passes in a trusted workspace and shows nothing', async () => {
    expect(await guard('Handing off')).toBe(true);
    expect(recorded.warning).toEqual([]);
    expect(recorded.commands).toEqual([]);
  });

  it('stops in Restricted Mode with the reason and the way to trust the folder', async () => {
    workspace.isTrusted = false;
    expect(await guard('Handing off')).toBe(false);
    expect(recorded.warning).toEqual(['Handing off needs a trusted workspace']);
    expect(recorded.commands).toEqual([]);
  });

  it('opens the trust editor when the user chooses "Manage Workspace Trust", and still stops', async () => {
    workspace.isTrusted = false;
    answers.message = 'Manage Workspace Trust';
    expect(await guard('Setting up steno')).toBe(false);
    expect(recorded.commands.map(c => c.command)).toEqual(['workbench.trust.manage']);
  });
});
