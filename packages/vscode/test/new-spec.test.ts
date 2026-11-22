// "New spec" below the input flow: which project it creates in, the arguments it builds, and what it
// makes of the bundled CLI's exit code and output.
import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import fc from 'fast-check';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Uri, answers, commands, folder, memento, openDocument, recorded, resetRecorded, window, workspace } from './vscode-stub.js';
import type { Probe } from '../src/agents.js';
import { AGENT_KEY, Chooser } from '../src/chooser.js';
import type { Deps } from '../src/handoff.js';
import type { SpecTree } from '../src/protocol.js';
import { ServerPool, type CreateClient } from '../src/servers.js';
import { FolderNode, registerOpen } from '../src/tree.js';
import { pickProject } from '../src/pick.js';
import {
  NEW_SPEC_COMMAND, bundledCli, registerNewSpec, validateName, writeChoices,
} from '../src/new-spec.js';

beforeEach(() => resetRecorded());

describe('writeChoices', () => {
  it('the brainstorm choice is a Feature\'s alone', () => {
    fc.assert(fc.property(fc.constantFrom('feature', 'bugfix') as fc.Arbitrary<'feature' | 'bugfix'>, kind => {
      const choices = writeChoices(kind);
      expect(choices[0]).toBe('agent');
      expect(choices[choices.length - 1]).toBe('self');
      expect(choices.includes('brainstorm')).toBe(kind === 'feature');
    }));
  });

  it('offers three choices for a feature and two for a bugfix', () => {
    expect(writeChoices('feature')).toEqual(['agent', 'brainstorm', 'self']);
    expect(writeChoices('bugfix')).toEqual(['agent', 'self']);
  });
});

describe('pickProject', () => {
  it('the chosen project follows the hints in order', () => {
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

describe('bundledCli', () => {
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

  const run = (cli: string, args: string[] = []) => bundledCli(cli)(args, dir);

  it('gives back the exit code and both streams, whatever the code', async () => {
    expect(await run(prints('ok', '{"spec":"auth"}', 0, 'note'))).toEqual({ code: 0, stdout: '{"spec":"auth"}', stderr: 'note' });
    expect(await run(prints('refused', '{"code":"failed"}', 1, 'why'))).toEqual({ code: 1, stdout: '{"code":"failed"}', stderr: 'why' });
  });

  it('runs the CLI with the arguments it was given, as single values', async () => {
    const echo = fakeCli('echo', 'process.stdout.write(JSON.stringify(process.argv.slice(2)));');
    const args = ['--root', '/work/app', '--json', 'new', '--title=two words', '--', '-x'];
    expect(JSON.parse((await run(echo, args)).stdout)).toEqual(args);
  });

  it('runs it as plain Node, so the editor binary does not start a second editor', async () => {
    const env = fakeCli('env', 'process.stdout.write(String(process.env.ELECTRON_RUN_AS_NODE));');
    expect((await run(env)).stdout).toBe('1');
  });

  it('reports a CLI that is not there as the crash Node gives', async () => {
    const exit = await run(join(dir, 'missing.mjs'));
    expect(exit.code).toBe(1);
    expect(exit.stderr).toMatch(/Cannot find module/);
  });

  // Windows has no signals: a killed process there ends with an exit code like any other
  it.skipIf(process.platform === 'win32')('reports a killed CLI with code null', async () => {
    expect((await run(fakeCli('killed', "process.kill(process.pid, 'SIGKILL');"))).code).toBeNull();
  });
});

describe('validateName', () => {
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

describe('the New spec flow', () => {
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

  /** What the folders' output channels were given, across every client of the last pool. */
  let logged: string[] = [];

  /** A pool of folders, each with the tree its entry gives; `undefined` means the server never answered. */
  async function pooled(folders: { path: string; tree?: Partial<SpecTree> }[]) {
    const trees = new Map(folders.map(f => [f.path, f.tree]));
    logged = [];
    const create: CreateClient = (f) => ({
      outputChannel: { appendLine: line => logged.push(line) },
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

  const KIND_LABELS = ['Feature', 'Bugfix'];
  const DRAFT = 'Draft with coding agent';
  const BRAINSTORM = 'Brainstorm with coding agent';
  const MYSELF = 'Write it myself';

  /** The handoff deps, with the clipboard saved as the agent so a handoff shows up in `recorded.clipboard`. */
  function deps(): Deps {
    const probe: Probe = { hasExtension: () => false, env: { path: '', windows: false }, exists: () => false };
    const none = { all: () => [], onDidChange: () => ({ dispose() {} }) } as unknown as ServerPool;
    return { chooser: new Chooser(memento({ [AGENT_KEY]: 'clipboard' }), probe, none), probe };
  }

  it('asks for the kind, a name, a title and who writes it, then creates and opens the Spec', async () => {
    const pool = await pooled(app);
    const cli = recordingCli('flow', ok('billing', 'requirements', ['requirements.md', 'spec.yaml']));
    registerOpen();
    registerNewSpec(pool, cli.path, deps());
    answers.input = ['billing', 'Billing'];
    answers.pick = ['Feature', MYSELF];
    await commands.executeCommand(NEW_SPEC_COMMAND);

    expect(recorded.inputs.map(i => i.prompt)).toEqual(['Spec name, as a kebab-case slug', 'Title (optional): the one line the tree shows']);
    expect(recorded.picks.map(p => p.labels)).toEqual([KIND_LABELS, [DRAFT, BRAINSTORM, MYSELF]]);
    // writing it yourself hands nothing to the agent
    expect(recorded.clipboard).toEqual([]);
    expect(cli.calls()).toEqual([['--root', '/work/app', '--json', 'new', '--title=Billing', '--', 'billing']]);
    expect(recorded.opened).toEqual([{ uri: 'file:///work/app/.steno/specs/billing/requirements.md', line: 1 }]);
  });

  it('gives the name box a validator that knows the folder\'s existing Specs', async () => {
    const pool = await pooled(app);
    registerNewSpec(pool, recordingCli('validator', ok('x', 'requirements', [])).path, deps());
    answers.input = [undefined];
    answers.pick = ['Feature'];
    await commands.executeCommand(NEW_SPEC_COMMAND);
    const validate = recorded.inputs[0].validate!;
    expect(await validate('auth')).toBe('spec already exists: auth');
    expect(await validate('Billing')).toMatch(/kebab-case slug/);
    expect(await validate('billing')).toBeUndefined();
  });

  it('adds the kind\'s flag and drops an empty title', async () => {
    const pool = await pooled(app);
    const cli = recordingCli('kinds', ok('bug', 'requirements', ['bugfix.md']));
    registerNewSpec(pool, cli.path, deps());
    answers.input = ['bug', '   '];
    answers.pick = ['Bugfix', MYSELF];
    await commands.executeCommand(NEW_SPEC_COMMAND);
    expect(cli.calls()).toEqual([['--root', '/work/app', '--json', 'new', '--bugfix', '--', 'bug']]);
    // no brainstorm for a bugfix
    expect(recorded.picks[1].labels).toEqual([DRAFT, MYSELF]);
  });

  it('starts a brainstorm at brief.md and hands it to the agent', async () => {
    const pool = await pooled([{ path: '/work/app', tree: { specs: [], specsDir: 'specs' } }]);
    registerOpen();
    registerNewSpec(pool, recordingCli('brief', ok('idea', 'brief', ['brief.md', 'spec.yaml'])).path, deps());
    answers.input = ['idea', '', ''];
    answers.pick = ['Feature', BRAINSTORM];
    await commands.executeCommand(NEW_SPEC_COMMAND);
    // the folder's own specs directory, not the default
    expect(recorded.opened).toEqual([{ uri: 'file:///work/app/specs/idea/brief.md', line: 1 }]);
    expect(recorded.clipboard).toEqual(['/steno-brainstorm idea']);
  });

  it('creates the Spec with the kind\'s flag and hands the agent its requirements', async () => {
    for (const [kind, flag, created] of [['Feature', [], 'requirements.md'], ['Bugfix', ['--bugfix'], 'bugfix.md']] as const) {
      resetRecorded();
      const pool = await pooled(app);
      const cli = recordingCli(`draft-${kind}`, ok('billing', 'requirements', [created, 'spec.yaml']));
      registerOpen();
      registerNewSpec(pool, cli.path, deps());
      answers.input = ['billing', '', ''];
      answers.pick = [kind, DRAFT];
      await commands.executeCommand(NEW_SPEC_COMMAND);
      expect(cli.calls()).toEqual([['--root', '/work/app', '--json', 'new', ...flag, '--', 'billing']]);
      expect(recorded.opened).toEqual([{ uri: `file:///work/app/.steno/specs/billing/${created}`, line: 1 }]);
      expect(recorded.clipboard).toEqual(['/steno-spec billing']);
    }
  });

  it('keeps the created Spec open when the handoff is refused in Restricted Mode', async () => {
    workspace.isTrusted = false;
    const pool = await pooled(app);
    const cli = recordingCli('restricted', ok('billing', 'requirements', ['requirements.md']));
    registerOpen();
    registerNewSpec(pool, cli.path, deps());
    answers.input = ['billing', '', ''];
    answers.pick = ['Feature', DRAFT];
    await commands.executeCommand(NEW_SPEC_COMMAND);
    expect(cli.calls()).toHaveLength(1);
    expect(recorded.opened).toEqual([{ uri: 'file:///work/app/.steno/specs/billing/requirements.md', line: 1 }]);
    expect(recorded.warning).toEqual(['Handing work to an agent needs a trusted workspace']);
    expect(recorded.clipboard).toEqual([]);
  });

  it('asks the agent choices for a description, names the bug or the feature, and passes it joined to its flag', async () => {
    for (const [kind, write, noun] of [['Feature', DRAFT, 'feature'], ['Feature', BRAINSTORM, 'feature'], ['Bugfix', DRAFT, 'bug']] as const) {
      resetRecorded();
      const pool = await pooled(app);
      const cli = recordingCli(`describe-${kind}-${write.length}`, ok('billing', 'requirements', ['requirements.md']));
      registerNewSpec(pool, cli.path, deps());
      answers.input = ['billing', '', '  export invoices  '];
      answers.pick = [kind, write];
      await commands.executeCommand(NEW_SPEC_COMMAND);
      expect(recorded.inputs[2].prompt).toBe(`Describe the ${noun} in a few words (optional)`);
      expect(cli.calls()[0]).toContain('--description=export invoices');
      expect(cli.calls()[0].indexOf('--description=export invoices')).toBeLessThan(cli.calls()[0].indexOf('--'));
    }
  });

  it('adds no description for a blank one, and asks nothing more when the user writes it', async () => {
    const pool = await pooled(app);
    const blank = recordingCli('describe-blank', ok('billing', 'requirements', ['requirements.md']));
    registerNewSpec(pool, blank.path, deps());
    answers.input = ['billing', '', '   '];
    answers.pick = ['Feature', DRAFT];
    await commands.executeCommand(NEW_SPEC_COMMAND);
    expect(blank.calls()).toEqual([['--root', '/work/app', '--json', 'new', '--', 'billing']]);

    resetRecorded();
    const self = recordingCli('describe-self', ok('billing', 'requirements', ['requirements.md']));
    registerNewSpec(pool, self.path, deps());
    answers.input = ['billing', ''];
    answers.pick = ['Feature', MYSELF];
    await commands.executeCommand(NEW_SPEC_COMMAND);
    expect(recorded.inputs.map(i => i.prompt)).toHaveLength(2);
    expect(self.calls()).toHaveLength(1);
  });

  for (const [step, input, pick] of [
    ['the kind pick', [], [undefined]],
    ['the name box', [undefined], ['Feature']],
    ['the title box', ['billing', undefined], ['Feature']],
    ['the write pick', ['billing', 'Billing'], ['Feature', undefined]],
    ['the description box', ['billing', 'Billing', undefined], ['Feature', DRAFT]],
  ] as [string, (string | undefined)[], (string | undefined)[]][]) {
    it(`creates nothing when the user escapes ${step}`, async () => {
      const pool = await pooled(app);
      const cli = recordingCli(`escape-${step.replace(/\W+/g, '-')}`, ok('billing', 'requirements', ['requirements.md']));
      registerNewSpec(pool, cli.path, deps());
      answers.input = input;
      answers.pick = pick;
      await commands.executeCommand(NEW_SPEC_COMMAND);
      expect(cli.calls()).toEqual([]);
      expect(recorded.opened).toEqual([]);
    });
  }

  it('shows a CLI refusal as a notification and opens nothing', async () => {
    const pool = await pooled(app);
    const cli = recordingCli('refuses', [
      `process.stdout.write(JSON.stringify({ protocolVersion: 1, code: 'failed', message: 'spec already exists: billing' }));`,
      'process.exitCode = 1;',
    ].join('\n'));
    registerNewSpec(pool, cli.path, deps());
    answers.input = ['billing', '', ''];
    answers.pick = ['Feature', DRAFT];
    await commands.executeCommand(NEW_SPEC_COMMAND);
    expect(recorded.error).toEqual(['spec already exists: billing']);
    expect(recorded.opened).toEqual([]);
  });

  it('shows a CLI that ended without JSON as an error naming the exit code', async () => {
    const pool = await pooled(app);
    const cli = recordingCli('crashes', 'process.stderr.write("steno: boom\\n"); process.exitCode = 1;');
    registerNewSpec(pool, cli.path, deps());
    answers.input = ['billing', '', ''];
    answers.pick = ['Feature', DRAFT];
    await commands.executeCommand(NEW_SPEC_COMMAND);
    expect(recorded.error).toEqual(['steno exited with code 1: steno: boom']);
  });

  it('writes a crash\'s whole standard error to the folder\'s output channel, and a refusal nothing', async () => {
    const pool = await pooled(app);
    const cli = recordingCli('trace', 'process.stderr.write("TypeError: x is not a function\\n    at main (cli.js:1:1)\\n"); process.exitCode = 3;');
    registerNewSpec(pool, cli.path, deps());
    answers.input = ['billing', '', ''];
    answers.pick = ['Feature', DRAFT];
    await commands.executeCommand(NEW_SPEC_COMMAND);
    expect(recorded.error).toEqual(['steno exited with code 3: TypeError: x is not a function']);
    expect(logged).toEqual(['TypeError: x is not a function\n    at main (cli.js:1:1)']);

    resetRecorded();
    const refusing = await pooled(app);
    registerNewSpec(refusing, recordingCli('refuses-quietly', [
      `process.stdout.write(JSON.stringify({ protocolVersion: 1, code: 'failed', message: 'spec already exists: billing' }));`,
      'process.stderr.write("warn\\n"); process.exitCode = 1;',
    ].join('\n')).path, deps());
    answers.input = ['billing', '', ''];
    answers.pick = ['Feature', DRAFT];
    await commands.executeCommand(NEW_SPEC_COMMAND);
    expect(logged).toEqual([]);
  });

  describe('which project it creates in', () => {
    const two = [
      { path: '/work/app', tree: { specs: [] } as Partial<SpecTree> },
      { path: '/work/site', tree: { specs: [] } as Partial<SpecTree> },
    ];

    /** The whole flow, answering each quick pick in turn: the project one only when it is shown. */
    async function run(name: string, pool: ServerPool, picks: string[], node?: unknown) {
      const cli = recordingCli(name, ok('billing', 'requirements', ['requirements.md']));
      registerNewSpec(pool, cli.path, deps());
      answers.input = ['billing', ''];
      answers.pick = [...picks, MYSELF];
      await commands.executeCommand(NEW_SPEC_COMMAND, node);
      return cli;
    }

    it('takes the folder of the tree item the command came from', async () => {
      const pool = await pooled(two);
      const node = new FolderNode(folder('/work/site') as unknown as import('vscode').WorkspaceFolder, true);
      const cli = await run('from-item', pool, ['Feature'], node);
      expect(cli.calls()[0]).toContain('/work/site');
      expect(recorded.picks.map(p => p.labels)).toEqual([KIND_LABELS, [DRAFT, BRAINSTORM, MYSELF]]);
    });

    it('falls back to the project the active editor is in', async () => {
      const pool = await pooled(two);
      window.activeTextEditor = { document: openDocument(Uri.file('/work/site/README.md'), false) };
      const cli = await run('from-editor', pool, ['Feature']);
      expect(cli.calls()[0]).toContain('/work/site');
      expect(recorded.picks.length).toBe(2);
    });

    it('asks in a quick pick when the window has several projects and no hint', async () => {
      const pool = await pooled(two);
      const cli = await run('from-pick', pool, ['site', 'Feature']);
      expect(recorded.picks[0].labels).toEqual(['app', 'site']);
      expect(cli.calls()[0]).toContain('/work/site');
    });

    it('creates nothing when the user escapes that pick', async () => {
      const pool = await pooled(two);
      const cli = recordingCli('escape-project', ok('billing', 'requirements', ['requirements.md']));
      registerNewSpec(pool, cli.path, deps());
      answers.input = ['billing', ''];
      await commands.executeCommand(NEW_SPEC_COMMAND);
      expect(cli.calls()).toEqual([]);
      expect(recorded.inputs).toEqual([]);
    });

    it('uses the only project without asking, and skips a folder that is not one', async () => {
      const pool = await pooled([{ path: '/work/app', tree: { specs: [] } }, { path: '/work/plain', tree: { notSetUp: true } }]);
      const cli = await run('only-project', pool, ['Feature']);
      expect(cli.calls()[0]).toContain('/work/app');
      // only the kind and the writer were picked: the one project needed no asking
      expect(recorded.picks.map(p => p.labels)).toEqual([KIND_LABELS, [DRAFT, BRAINSTORM, MYSELF]]);
    });

    it('does nothing at all when no folder is a steno project', async () => {
      const pool = await pooled([{ path: '/work/plain', tree: { notSetUp: true } }]);
      const cli = recordingCli('no-project', ok('billing', 'requirements', ['requirements.md']));
      registerNewSpec(pool, cli.path, deps());
      answers.input = ['billing', ''];
      answers.pick = ['feature'];
      await commands.executeCommand(NEW_SPEC_COMMAND);
      expect(cli.calls()).toEqual([]);
      expect(recorded.inputs).toEqual([]);
    });
  });
});
