// The constants and small functions every host shares: the server's request names, the reopen wording, where a
// project keeps its documents, and how each agent takes a skill call.
import { describe, it, expect } from 'vitest';
import { REQUESTS, TREE_CHANGED } from '../../src/host/requests.js';
import { reopenWording, reopenedMessage } from '../../src/host/wording.js';
import { DEFAULT_STEERING_DIR, documentPath, specsDir, steeringDir } from '../../src/host/paths.js';
import { callForm } from '../../src/host/calls.js';

describe('requests', () => {
  it('names the server\'s requests and its change notice', () => {
    expect(REQUESTS).toEqual({
      specTree: 'steno/specTree', taskDone: 'steno/taskDone', taskReopen: 'steno/taskReopen',
      approve: 'steno/approve', specReopen: 'steno/specReopen',
    });
    expect(TREE_CHANGED).toBe('steno/treeChanged');
  });
});

describe('reopen wording', () => {
  it('asks before reopening a task and says the code stays', () => {
    expect(reopenWording({ spec: 'auth', task: 'T3.1' }))
      .toEqual({ title: 'Reopen T3.1 of auth?', body: 'steno marks the task open again; the code it wrote stays as it is.' });
  });

  it('asks before reopening a spec and says its approvals and finished tasks stay', () => {
    expect(reopenWording({ spec: 'auth' })).toEqual({
      title: 'Reopen auth?', body: 'steno moves the spec back to execution so you can add tasks; its approvals and finished tasks stay.',
    });
  });

  it('confirms a reopened task, and tells a reopened spec what to do next', () => {
    expect(reopenedMessage({ spec: 'auth', task: 'T3.1' })).toBe('T3.1 of auth is open again.');
    expect(reopenedMessage({ spec: 'auth' })).toBe('auth is open again. Add tasks to tasks.md, then run them.');
  });
});

describe('paths', () => {
  it('falls back to the default folders when the tree names none', () => {
    expect(specsDir()).toBe('.steno/specs');
    expect(specsDir({})).toBe('.steno/specs');
    expect(steeringDir(undefined)).toBe(DEFAULT_STEERING_DIR);
    expect(DEFAULT_STEERING_DIR).toBe('.steno/steering');
  });

  it('takes the folders the project config names', () => {
    expect(specsDir({ specsDir: 'docs/specs' })).toBe('docs/specs');
    expect(steeringDir({ steeringDir: 'docs/steering' })).toBe('docs/steering');
  });

  it('gives a document\'s project-relative path with /', () => {
    expect(documentPath(undefined, 'auth', 'tasks.md')).toBe('.steno/specs/auth/tasks.md');
    expect(documentPath({ specsDir: 'docs/specs/' }, 'auth', 'design.md')).toBe('docs/specs/auth/design.md');
  });
});

describe('callForm', () => {
  it('gives Claude a slash command, Codex a dollar one, and every other agent a plain sentence', () => {
    expect(callForm('claude')).toBe('slash');
    expect(callForm('codex')).toBe('dollar');
    for (const agent of ['opencode', 'gemini', '', undefined]) expect(callForm(agent)).toBe('plain');
  });
});
