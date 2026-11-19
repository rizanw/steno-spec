// "New spec" below the input flow: which project it creates in, the arguments it builds, and what it
// makes of the bundled CLI's exit code and output (R5.7, R5.8).
import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import fc from 'fast-check';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Uri, answers, commands, folder, openDocument, recorded, resetRecorded, window } from './vscode-stub.js';
import type { SpecTree } from '../src/protocol.js';
import { ServerPool, type CreateClient } from '../src/servers.js';
import { FolderNode, registerOpen } from '../src/tree.js';
import { pickProject } from '../src/pick.js';
import {
  NEW_SPEC_COMMAND, cliArgs, refused, registerNewSpec, runCli, validateName, type Kind,
} from '../src/new-spec.js';

beforeEach(() => resetRecorded());

const KINDS = ['feature', 'bugfix', 'brief'] as const;

describe('pickProject (R5.8)', () => {
  it('Property 4: the chosen project follows the hints in order', () => {
    const path = fc.constantFrom('/a', '/b', '/c', '/d');
    fc.assert(fc.property(
      fc.uniqueArray(path), fc.option(path, { nil: undefined }), fc.option(path, { nil: undefined }),
      (projects, fromItem, fromEditor) => {
        const expected = fromItem !== undefined ? fromItem
          : fromEditor !== undefined && projects.includes(fromEditor) ? fromEditor
            : projects.length === 1 ? projects[0] : undefined;
        expect(pickProject(projects, fromItem, fromEditor)).toBe(expected);
      },
    ));
  });

  it('takes the tree item first, then an editor inside a project, then the only project', () => {
    expect(pickProject(['/a', '/b'], '/b', '/a')).toBe('/b');
    expect(pickProject(['/a', '/b'], undefined, '/a')).toBe('/a');
    // an editor outside every project settles nothing
    expect(pickProject(['/a', '/b'], undefined, '/elsewhere')).toBeUndefined();
    expect(pickProject(['/a'], undefined, '/elsewhere')).toBe('/a');
    expect(pickProject([], undefined, undefined)).toBeUndefined();
  });
});

describe('cliArgs (R5.7)', () => {
  it('Property 5: fixed flags plus the user text as single values', () => {
    fc.assert(fc.property(
      fc.string(), fc.string(), fc.constantFrom(...KINDS), fc.option(fc.string(), { nil: undefined }),
      (root, slug, kind, title) => {
        const args = cliArgs(root, slug, kind, title);
        // the call always ends the same way, so no user text can be read as the root or turn off --json
        expect(args.slice(-3)).toEqual(['--root', root, '--json']);
        // and always starts with the command and the slug, each one entry of its own
        expect(args.slice(0, 2)).toEqual(['new', slug]);
        // between them, only this kind's flag and the title, again as single entries
        const flag: Record<Kind, string[]> = { feature: [], bugfix: ['--bugfix'], brief: ['--brief'] };
        expect(args.slice(2, -3)).toEqual([...flag[kind], ...(title ? ['-t', title] : [])]);
      },
    ));
  });

  it('builds the call each kind asks for', () => {
    expect(cliArgs('/work/app', 'auth', 'feature')).toEqual(['new', 'auth', '--root', '/work/app', '--json']);
    expect(cliArgs('/work/app', 'auth', 'bugfix', 'Auth bug'))
      .toEqual(['new', 'auth', '--bugfix', '-t', 'Auth bug', '--root', '/work/app', '--json']);
    expect(cliArgs('/work/app', 'auth', 'brief'))
      .toEqual(['new', 'auth', '--brief', '--root', '/work/app', '--json']);
  });
});

describe('runCli (R5.7)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'steno-vscode-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  /** A stand-in for the bundled CLI: it prints what the test gives it and exits with `code`. */
  function fakeCli(name: string, body: string): string {
    const file = join(dir, `${name}.mjs`);
    writeFileSync(file, body);
    return file;
  }

  const prints = (name: string, stdout: string, code: number, stderr = '') => fakeCli(name, [
    `process.stdout.write(${JSON.stringify(stdout)});`,
    `process.stderr.write(${JSON.stringify(stderr)});`,
    `process.exitCode = ${code};`,
  ].join('\n'));

  const change = { protocolVersion: 1, spec: 'auth', phase: 'requirements', created: ['requirements.md', 'spec.yaml'] };
  const error = { protocolVersion: 1, code: 'failed', message: 'spec already exists' };

  it('gives the ChangeResult of a CLI that exited 0', async () => {
    const result = await runCli(prints('ok', JSON.stringify(change), 0), ['new', 'auth']);
    expect(refused(result)).toBe(false);
    expect(result).toEqual(change);
  });

  it('gives the Structured_Error of a CLI that refused, for both refusal exit codes', async () => {
    for (const code of [1, 2]) {
      const result = await runCli(prints(`refused-${code}`, JSON.stringify(error), code), ['new', 'auth']);
      expect(refused(result)).toBe(true);
      expect(result).toEqual(error);
    }
  });

  it('runs the CLI with the arguments it was given, as single values', async () => {
    const echo = fakeCli('echo', 'process.stdout.write(JSON.stringify({ argv: process.argv.slice(2) }));');
    const result = await runCli(echo, cliArgs('/work/app', 'auth', 'bugfix', 'two words'));
    expect((result as unknown as { argv: string[] }).argv)
      .toEqual(['new', 'auth', '--bugfix', '-t', 'two words', '--root', '/work/app', '--json']);
  });

  it('runs it as plain Node, so the editor binary does not start a second editor', async () => {
    const env = fakeCli('env', 'process.stdout.write(JSON.stringify({ flag: process.env.ELECTRON_RUN_AS_NODE }));');
    expect((await runCli(env, []) as unknown as { flag: string }).flag).toBe('1');
  });

  it('throws on output that is not JSON, naming the exit code and the first line of standard error', async () => {
    const cli = prints('text', 'not json\n', 1, '\nsteno: boom\nmore\n');
    await expect(runCli(cli, [])).rejects.toThrow('steno exited with code 1: steno: boom');
  });

  it('throws on a success that printed no JSON, and on a JSON refusal with an exit code of its own', async () => {
    await expect(runCli(prints('empty', '', 0), [])).rejects.toThrow('steno exited with code 0');
    await expect(runCli(prints('odd', JSON.stringify(error), 3), [])).rejects.toThrow('steno exited with code 3');
  });

  it('throws when the CLI is not there at all', async () => {
    await expect(runCli(join(dir, 'missing.mjs'), [])).rejects.toThrow(/steno exited with code/);
  });
});

describe('validateName (R5.6, R5.7)', () => {
  it('refuses anything that is not a kebab-case slug, with core\'s own wording', () => {
    for (const bad of ['', 'Auth', 'auth spec', 'auth/sub', '../auth', '-auth', 'auth_spec']) {
      expect(validateName(bad, [])).toBe(`spec name must be a kebab-case slug, got "${bad}"`);
    }
  });

  it('refuses a name the folder already has, so it never reaches the CLI', () => {
    expect(validateName('auth', ['auth', 'billing'])).toBe('spec already exists: auth');
  });

  it('accepts a slug the folder does not have yet', () => {
    expect(validateName('auth-2', ['auth'])).toBeUndefined();
    expect(validateName('a', [])).toBeUndefined();
  });
});

describe('the New spec flow (R5.6, R5.7, R5.8)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'steno-vscode-flow-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  /** A fake bundled CLI that records every call's arguments in a file and answers with `body`. */
  function recordingCli(name: string, body: string): { path: string; calls: () => string[][] } {
    const log = join(dir, `${name}.log`);
    const path = join(dir, `${name}.mjs`);
    writeFileSync(path, [
      `import { appendFileSync } from 'node:fs';`,
      `appendFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2)) + '\\n');`,
      body,
    ].join('\n'));
    return {
      path,
      calls: () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : []),
    };
  }

  const ok = (spec: string, phase: string, created: string[]) =>
    `process.stdout.write(JSON.stringify(${JSON.stringify({ protocolVersion: 1, spec, phase, created })}));`;

  /** A pool of folders, each with the tree its entry gives; `undefined` means the server never answered. */
  async function pooled(folders: { path: string; tree?: Partial<SpecTree> }[]) {
    const trees = new Map(folders.map(f => [f.path, f.tree]));
    const create: CreateClient = (f) => ({
      start: async () => {},
      stop: async () => {},
      sendRequest: async <T>() => {
        const tree = trees.get(f.uri.fsPath);
        if (!tree) throw new Error('no tree');
        return { protocolVersion: 1, specs: [], steering: [], ...tree } as T;
      },
      onNotification: () => ({ dispose: () => {} }),
    });
    const pool = new ServerPool('/ext/dist/steno-lsp.mjs', create);
    for (const f of folders) await pool.start(folder(f.path));
    await new Promise(resolve => setImmediate(resolve));
    return pool;
  }

  const app = [{ path: '/work/app', tree: { specs: [{ name: 'auth' }] } as Partial<SpecTree> }];

  it('asks for a name, a title and a kind, then creates and opens the Spec', async () => {
    const pool = await pooled(app);
    const cli = recordingCli('flow', ok('billing', 'requirements', ['requirements.md', 'spec.yaml']));
    registerOpen();
    registerNewSpec(pool, cli.path);
    answers.input = ['billing', 'Billing'];
    answers.pick = ['feature'];
    await commands.executeCommand(NEW_SPEC_COMMAND);

    expect(recorded.inputs.map(i => i.prompt)).toEqual(['Spec name', 'Title (optional)']);
    expect(recorded.picks.map(p => p.labels)).toEqual([['feature', 'bugfix', 'brief first']]);
    expect(cli.calls()).toEqual([['new', 'billing', '-t', 'Billing', '--root', '/work/app', '--json']]);
    expect(recorded.opened).toEqual([{ uri: 'file:///work/app/.steno/specs/billing/requirements.md', line: 1 }]);
  });

  it('gives the name box a validator that knows the folder\'s existing Specs (R3.3)', async () => {
    const pool = await pooled(app);
    registerNewSpec(pool, recordingCli('validator', ok('x', 'requirements', [])).path);
    answers.input = [undefined];
    await commands.executeCommand(NEW_SPEC_COMMAND);
    const validate = recorded.inputs[0].validate!;
    expect(await validate('auth')).toBe('spec already exists: auth');
    expect(await validate('Billing')).toMatch(/kebab-case slug/);
    expect(await validate('billing')).toBeUndefined();
  });

  it('adds the kind\'s flag and drops an empty title', async () => {
    const pool = await pooled(app);
    const cli = recordingCli('kinds', ok('bug', 'requirements', ['bugfix.md']));
    registerNewSpec(pool, cli.path);
    answers.input = ['bug', '   '];
    answers.pick = ['bugfix'];
    await commands.executeCommand(NEW_SPEC_COMMAND);
    expect(cli.calls()).toEqual([['new', 'bug', '--bugfix', '--root', '/work/app', '--json']]);
  });

  it('opens brief.md when the Spec starts from a brief', async () => {
    const pool = await pooled([{ path: '/work/app', tree: { specs: [], specsDir: 'specs' } }]);
    registerOpen();
    registerNewSpec(pool, recordingCli('brief', ok('idea', 'brief', ['brief.md', 'spec.yaml'])).path);
    answers.input = ['idea', ''];
    answers.pick = ['brief first'];
    await commands.executeCommand(NEW_SPEC_COMMAND);
    // the folder's own specs directory, not the default
    expect(recorded.opened).toEqual([{ uri: 'file:///work/app/specs/idea/brief.md', line: 1 }]);
  });

  for (const [step, input, pick] of [
    ['the name box', [undefined], []],
    ['the title box', ['billing', undefined], []],
    ['the kind pick', ['billing', 'Billing'], [undefined]],
  ] as [string, (string | undefined)[], (string | undefined)[]][]) {
    it(`creates nothing when the user escapes ${step}`, async () => {
      const pool = await pooled(app);
      const cli = recordingCli(`escape-${step.replace(/\W+/g, '-')}`, ok('billing', 'requirements', ['requirements.md']));
      registerNewSpec(pool, cli.path);
      answers.input = input;
      answers.pick = pick;
      await commands.executeCommand(NEW_SPEC_COMMAND);
      expect(cli.calls()).toEqual([]);
      expect(recorded.opened).toEqual([]);
    });
  }

  it('shows a CLI refusal as a notification and opens nothing (R5.6)', async () => {
    const pool = await pooled(app);
    const cli = recordingCli('refuses', [
      `process.stdout.write(JSON.stringify({ protocolVersion: 1, code: 'failed', message: 'spec already exists: billing' }));`,
      'process.exitCode = 1;',
    ].join('\n'));
    registerNewSpec(pool, cli.path);
    answers.input = ['billing', ''];
    answers.pick = ['feature'];
    await commands.executeCommand(NEW_SPEC_COMMAND);
    expect(recorded.error).toEqual(['spec already exists: billing']);
    expect(recorded.opened).toEqual([]);
  });

  it('shows a CLI that ended without JSON as an error naming the exit code (R5.6)', async () => {
    const pool = await pooled(app);
    const cli = recordingCli('crashes', 'process.stderr.write("steno: boom\\n"); process.exitCode = 1;');
    registerNewSpec(pool, cli.path);
    answers.input = ['billing', ''];
    answers.pick = ['feature'];
    await commands.executeCommand(NEW_SPEC_COMMAND);
    expect(recorded.error).toEqual(['steno exited with code 1: steno: boom']);
  });

  describe('which project it creates in (R5.8)', () => {
    const two = [
      { path: '/work/app', tree: { specs: [] } as Partial<SpecTree> },
      { path: '/work/site', tree: { specs: [] } as Partial<SpecTree> },
    ];

    /** The whole flow, answering each quick pick in turn: the project one only when it is shown. */
    async function run(name: string, pool: ServerPool, picks: string[], node?: unknown) {
      const cli = recordingCli(name, ok('billing', 'requirements', ['requirements.md']));
      registerNewSpec(pool, cli.path);
      answers.input = ['billing', ''];
      answers.pick = picks;
      await commands.executeCommand(NEW_SPEC_COMMAND, node);
      return cli;
    }

    it('takes the folder of the tree item the command came from', async () => {
      const pool = await pooled(two);
      const node = new FolderNode(folder('/work/site') as unknown as import('vscode').WorkspaceFolder, true);
      const cli = await run('from-item', pool, ['feature'], node);
      expect(cli.calls()[0]).toContain('/work/site');
      expect(recorded.picks.map(p => p.labels)).toEqual([['feature', 'bugfix', 'brief first']]);
    });

    it('falls back to the project the active editor is in', async () => {
      const pool = await pooled(two);
      window.activeTextEditor = { document: openDocument(Uri.file('/work/site/README.md'), false) };
      const cli = await run('from-editor', pool, ['feature']);
      expect(cli.calls()[0]).toContain('/work/site');
      expect(recorded.picks.length).toBe(1);
    });

    it('asks in a quick pick when the window has several projects and no hint', async () => {
      const pool = await pooled(two);
      const cli = await run('from-pick', pool, ['site', 'feature']);
      expect(recorded.picks[0].labels).toEqual(['app', 'site']);
      expect(cli.calls()[0]).toContain('/work/site');
    });

    it('creates nothing when the user escapes that pick', async () => {
      const pool = await pooled(two);
      const cli = recordingCli('escape-project', ok('billing', 'requirements', ['requirements.md']));
      registerNewSpec(pool, cli.path);
      answers.input = ['billing', ''];
      await commands.executeCommand(NEW_SPEC_COMMAND);
      expect(cli.calls()).toEqual([]);
      expect(recorded.inputs).toEqual([]);
    });

    it('uses the only project without asking, and skips a folder that is not one', async () => {
      const pool = await pooled([{ path: '/work/app', tree: { specs: [] } }, { path: '/work/plain', tree: { notSetUp: true } }]);
      const cli = await run('only-project', pool, ['feature']);
      expect(cli.calls()[0]).toContain('/work/app');
      // only the kind was picked: the one project needed no asking
      expect(recorded.picks.map(p => p.labels)).toEqual([['feature', 'bugfix', 'brief first']]);
    });

    it('does nothing at all when no folder is a steno project', async () => {
      const pool = await pooled([{ path: '/work/plain', tree: { notSetUp: true } }]);
      const cli = recordingCli('no-project', ok('billing', 'requirements', ['requirements.md']));
      registerNewSpec(pool, cli.path);
      answers.input = ['billing', ''];
      answers.pick = ['feature'];
      await commands.executeCommand(NEW_SPEC_COMMAND);
      expect(cli.calls()).toEqual([]);
      expect(recorded.inputs).toEqual([]);
    });
  });
});
