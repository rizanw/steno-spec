import { describe, it, expect } from 'vitest';
import { CONTRACT, parseTasks } from '@steno/core';
import { LENS_DONE, LENS_RUN, taskLenses } from '../src/lsp/lens.js';

describe('taskLenses', () => {
  const doc = parseTasks([
    '# Tasks', '',
    '- [ ] 1. Parent',              // unchecked parent: run
    '  - [ ] 1.1 Leaf',             // unchecked leaf: run
    '  - [x] 1.2 Finished',         // checked: done
    '- [x] 2. Finished parent',     // checked parent: done
    '  - [x] 2.1 Child',
    '- [ ]* 3. Optional',           // optional: run, marked
    '- [x]* 4. Optional done',
  ].join('\n'));

  it('puts a run lens on every unchecked task, parents included, and a done lens on every checked task', () => {
    expect(taskLenses('demo', doc)).toEqual([
      { line: 3, command: LENS_RUN, title: 'Run T1', args: { spec: 'demo', task: 'T1', optional: false } },
      { line: 4, command: LENS_RUN, title: 'Run T1.1', args: { spec: 'demo', task: 'T1.1', optional: false } },
      { line: 5, command: LENS_DONE, title: 'Done', args: { spec: 'demo', task: 'T1.2', optional: false } },
      { line: 6, command: LENS_DONE, title: 'Done', args: { spec: 'demo', task: 'T2', optional: false } },
      { line: 7, command: LENS_DONE, title: 'Done', args: { spec: 'demo', task: 'T2.1', optional: false } },
      { line: 8, command: LENS_RUN, title: 'Run T3 (optional)', args: { spec: 'demo', task: 'T3', optional: true } },
      { line: 9, command: LENS_DONE, title: 'Done (optional)', args: { spec: 'demo', task: 'T4', optional: true } },
    ]);
  });

  it('uses the command IDs the contract names', () => {
    expect([LENS_RUN, LENS_DONE]).toEqual([...CONTRACT.lensCommands]);
  });
});
