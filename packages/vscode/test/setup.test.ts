// "Set up steno": which folder it picks, the `init` call it builds, and the whole flow
// against a fake bundled CLI.
import { describe, it, expect, afterAll, beforeEach } from 'vitest';
import fc from 'fast-check';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Uri, answers, commands, folder, openDocument, recorded, resetRecorded, window, workspace } from './vscode-stub.js';
import type { SpecTree } from '../src/protocol.js';
import { ServerPool, type CreateClient } from '../src/servers.js';
import {
  COPY_INSTALL, INSTALL_COMMAND, OPEN_PARENT, SET_UP_COMMAND, initAgents, initArgs, initResult,
  pickSetUpFolder, registerSetUp, setUp,
} from '../src/setup.js';

beforeEach(() => resetRecorded());

describe('pickSetUpFolder', () => {
  it('the set-up folder follows the hints in order', () => {
    const path = fc.constantFrom('/a', '/b', '/c', '/d');
    fc.assert(fc.property(fc.uniqueArray(path), fc.option(path, { nil: undefined }), (candidates, fromEditor) => {
      const expected = fromEditor !== undefined && candidates.includes(fromEditor) ? fromEditor
        : candidates.length === 1 ? candidates[0] : undefined;
      expect(pickSetUpFolder(candidates, fromEditor)).toBe(expected);
    }));
  });

  it('takes the editor\'s folder, then the only candidate, else leaves it to the user', () => {
    expect(pickSetUpFolder(['/a', '/b'], '/b')).toBe('/b');
    expect(pickSetUpFolder(['/a'], '/elsewhere')).toBe('/a');
    expect(pickSetUpFolder(['/a', '/b'], '/elsewhere')).toBeUndefined();
    expect(pickSetUpFolder([], undefined)).toBeUndefined();
  });
});

describe('initArgs', () => {
  it('passes the selection as one comma list, then the folder as given, with --json', () => {
    expect(initArgs('/work/app', ['claude', 'codex'])).toEqual(['init', '-a', 'claude,codex', '--root', '/work/app', '--json']);
  });

  it('passes an empty selection as -a \'\', which installs in .agents/skills only', () => {
    expect(initArgs('/work/app', [])).toEqual(['init', '-a', '', '--root', '/work/app', '--json']);
  });
});

describe('initResult and initAgents', () => {
  const good = { root: '/work/app', skills: ['steno-spec'], agents: { claude: '/work/app/.claude/skills' } };

  it('accepts a full answer, with or without warnings', () => {
    expect(initResult(good)).toEqual(good);
    expect(initResult({ ...good, warnings: ['config.yaml unreadable'] })).toBeDefined();
  });

  it('counts an answer with a missing or mistyped field as failed', () => {
    for (const field of ['root', 'skills', 'agents'] as const) {
      const { [field]: _, ...rest } = good;
      expect(initResult(rest), field).toBeUndefined();
    }
    expect(initResult({ ...good, skills: 'steno-spec' })).toBeUndefined();
    expect(initResult({ ...good, agents: ['claude'] })).toBeUndefined();
    expect(initResult({ ...good, agents: { claude: 1 } })).toBeUndefined();
    expect(initResult({ ...good, warnings: 'oops' })).toBeUndefined();
    expect(initResult(null)).toBeUndefined();
  });

  it('reads the agent list, and refuses one with a missing field', () => {
    expect(initAgents({ agents: [{ key: 'claude', label: 'Claude Code', extra: 1 }] })).toEqual([{ key: 'claude', label: 'Claude Code' }]);
    expect(initAgents({ agents: [{ key: 'claude' }] })).toBeUndefined();
    expect(initAgents({})).toBeUndefined();
  });
});

describe('the set-up flow', () => {
  const dir = mkdtempSync(join(tmpdir(), 'steno-vscode-setup-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const AGENTS = [{ key: 'claude', label: 'Claude Code' }, { key: 'codex', label: 'Codex' }, { key: 'cursor', label: 'Cursor' }];

  /**
   * A fake bundled CLI that records every call. `--list-agents` prints the agent list; `init` prints `body`'s
   * answer, or runs `body` as code when it is a string.
   */
  function fakeCli(name: string, init: object | string = {}, list: object | string = { agents: AGENTS }): { path: string; calls: () => string[][] } {
    const log = join(dir, `${name}.log`);
    const path = join(dir, `${name}.mjs`);
    const answer = (body: object | string) => typeof body === 'string' ? body : `process.stdout.write(${JSON.stringify(JSON.stringify(body))});`;
    writeFileSync(path, [
      `import { appendFileSync } from 'node:fs';`,
      `const args = process.argv.slice(2);`,
      `appendFileSync(${JSON.stringify(log)}, JSON.stringify(args) + '\\n');`,
      `if (args.includes('--list-agents')) { ${answer(list)} } else { ${answer(init)} }`,
    ].join('\n'));
    return {
      path,
      calls: () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : []),
    };
  }

  const done = (root: string, agents: Record<string, string> = {}, extra: object = {}) =>
    ({ root, skills: ['steno-spec', 'steno-design', 'steno-run'], agents, ...extra });

  /** A pool whose servers answer with the tree given; a folder without one never answers. */
  async function pooled(folders: { path: string; tree?: Partial<SpecTree> }[]) {
    const trees = new Map(folders.map(f => [f.path, f.tree]));
    const create: CreateClient = (f) => ({
      start: async () => {},
      stop: async () => {},
      sendRequest: async <T>() => {
        const tree = trees.get(f.uri.fsPath);
        if (!tree) return new Promise<T>(() => {});
        return { protocolVersion: 1, specs: [], steering: [], ...tree } as T;
      },
      onNotification: () => ({ dispose: () => {} }),
    });
    const pool = new ServerPool('/ext/dist/steno-lsp.mjs', create);
    for (const [i, f] of folders.entries()) await pool.start(folder(f.path, i));
    await new Promise(resolve => setImmediate(resolve));
    return pool;
  }

  // paths under the temp folder, so the walk for a parent project reads a real disk that holds none
  const plain = (name: string) => ({ path: join(dir, name), tree: { notSetUp: true } as Partial<SpecTree> });
  const project = (name: string) => ({ path: join(dir, name), tree: { specs: [] } as Partial<SpecTree> });

  it('installs for the agents picked and says what it did, with the install command', async () => {
    const app = plain('app');
    const pool = await pooled([app]);
    const cli = fakeCli('two-agents', done(app.path, { claude: 'x', codex: 'y' }));
    answers.many = [['Claude Code', 'Codex']];
    answers.message = COPY_INSTALL;
    await setUp(pool, cli.path);

    expect(recorded.picks).toEqual([{ title: 'Set up steno', labels: ['Claude Code', 'Codex', 'Cursor'], many: true }]);
    expect(cli.calls()).toEqual([
      ['init', '--list-agents', '--json'],
      ['init', '-a', 'claude,codex', '--root', app.path, '--json'],
    ]);
    expect(recorded.info).toEqual([
      `steno set up in app: 3 skills for Claude Code, Codex. To use steno in a terminal, install it with ${INSTALL_COMMAND}`,
    ]);
    expect(recorded.clipboard).toEqual([INSTALL_COMMAND]);
  });

  it('runs init on an empty selection too, and says the skills went to .agents/skills', async () => {
    const app = plain('empty');
    const pool = await pooled([app]);
    const cli = fakeCli('empty', done(app.path));
    answers.many = [[]];
    await setUp(pool, cli.path);
    expect(cli.calls()[1]).toEqual(['init', '-a', '', '--root', app.path, '--json']);
    expect(recorded.info[0]).toMatch(/^steno set up in empty: 3 skills in \.agents\/skills\./);
    expect(recorded.clipboard).toEqual([]);
  });

  it('puts init\'s warnings in the same message', async () => {
    const app = plain('warns');
    const pool = await pooled([app]);
    const cli = fakeCli('warns', done(app.path, { claude: 'x' }, { warnings: ['config.yaml is unreadable; left unchanged'] }));
    answers.many = [['Claude Code']];
    await setUp(pool, cli.path);
    expect(recorded.info).toEqual([]);
    expect(recorded.warning).toHaveLength(1);
    expect(recorded.warning[0]).toMatch(/for Claude Code\. .* Warning: config\.yaml is unreadable; left unchanged$/);
  });

  it('waits on a cold start for a tree that has not arrived yet, then goes on', async () => {
    const app = plain('cold');
    const pool = await pooled([{ path: app.path }]);
    const cli = fakeCli('cold', done(app.path));
    answers.many = [[]];
    const running = setUp(pool, cli.path, 5_000);
    setTimeout(() => pool.setTree(pool.all()[0], { protocolVersion: 1, specs: [], steering: [], notSetUp: true } as SpecTree), 20);
    await running;
    expect(cli.calls()).toHaveLength(2);
    expect(recorded.info[0]).toMatch(/^steno set up in cold:/);
  });

  it('leaves out a folder whose server never answers once the wait is over', async () => {
    const app = plain('answers');
    const pool = await pooled([app, { path: join(dir, 'silent') }]);
    const cli = fakeCli('silent', done(app.path));
    answers.many = [[]];
    await setUp(pool, cli.path, 30);
    // only one candidate, so no folder pick
    expect(recorded.picks.map(p => p.many)).toEqual([true]);
    expect(cli.calls()[1]).toContain(app.path);
  });

  it('says so and does nothing when no folder needs set-up', async () => {
    const pool = await pooled([project('done'), { path: join(dir, 'quiet') }]);
    const cli = fakeCli('none');
    await setUp(pool, cli.path, 10);
    expect(recorded.info).toEqual(['No folder here needs set-up']);
    expect(cli.calls()).toEqual([]);
  });

  it('suggests the parent project and sets nothing up', async () => {
    mkdirSync(join(dir, 'mono', '.steno'), { recursive: true });
    const nested = plain(join('mono', 'packages', 'web'));
    const pool = await pooled([nested]);
    const cli = fakeCli('parent');
    answers.message = OPEN_PARENT;
    await setUp(pool, cli.path);
    expect(recorded.info).toHaveLength(1);
    expect(recorded.info[0]).toContain(join(dir, 'mono'));
    expect(recorded.commands.find(c => c.command === 'vscode.openFolder')?.args).toEqual([Uri.file(join(dir, 'mono'))]);
    expect(cli.calls()).toEqual([]);
  });

  it('uses the active editor\'s folder when it needs set-up, and asks only without a hint', async () => {
    const pool = await pooled([plain('one'), plain('two')]);
    const cli = fakeCli('editor', done(join(dir, 'two')));
    window.activeTextEditor = { document: openDocument(Uri.file(join(dir, 'two', 'README.md')), false) };
    answers.many = [[]];
    await setUp(pool, cli.path);
    expect(recorded.picks.map(p => p.many)).toEqual([true]);
    expect(cli.calls()[1]).toContain(join(dir, 'two'));
  });

  it('asks which folder when several need set-up and nothing hints', async () => {
    const pool = await pooled([plain('first'), plain('second'), project('third')]);
    const cli = fakeCli('ask', done(join(dir, 'second')));
    answers.pick = ['second'];
    answers.many = [[]];
    await setUp(pool, cli.path);
    expect(recorded.picks[0].labels).toEqual(['first', 'second']);
    expect(cli.calls()[1]).toContain(join(dir, 'second'));
  });

  it('runs no init when the user dismisses the folder pick', async () => {
    const pool = await pooled([plain('d1'), plain('d2')]);
    const cli = fakeCli('dismiss-folder');
    await setUp(pool, cli.path);
    expect(cli.calls()).toEqual([]);
  });

  it('runs no init when the user dismisses the agent pick', async () => {
    const pool = await pooled([plain('dismiss')]);
    const cli = fakeCli('dismiss-agents');
    answers.many = [undefined];
    await setUp(pool, cli.path);
    expect(cli.calls()).toEqual([['init', '--list-agents', '--json']]);
    expect(recorded.info).toEqual([]);
  });

  it('shows a structured error from init with showRefusal', async () => {
    const pool = await pooled([plain('refused')]);
    const cli = fakeCli('refused', [
      `process.stdout.write(JSON.stringify({ protocolVersion: 1, code: 'failed', message: 'cannot write .steno' }));`,
      'process.exitCode = 1;',
    ].join(' '));
    answers.many = [[]];
    await setUp(pool, cli.path);
    expect(recorded.error).toEqual(['cannot write .steno']);
    expect(recorded.info).toEqual([]);
  });

  it('shows output that is not JSON as an error naming the exit code', async () => {
    const pool = await pooled([plain('crash')]);
    const cli = fakeCli('crash', `process.stderr.write('Error: Cannot find module skills\\n'); process.exitCode = 1;`);
    answers.many = [[]];
    await setUp(pool, cli.path);
    expect(recorded.error).toEqual(['steno exited with code 1: Error: Cannot find module skills']);
  });

  it('counts an answer with a missing field as a failed set-up', async () => {
    const pool = await pooled([plain('partial')]);
    const cli = fakeCli('partial', { root: join(dir, 'partial'), skills: [] });
    answers.many = [[]];
    await setUp(pool, cli.path);
    expect(recorded.error).toEqual(['steno init gave an answer the extension cannot read']);
    expect(recorded.info).toEqual([]);
  });

  it('stops at an agent list it cannot read, before any pick', async () => {
    const pool = await pooled([plain('badlist')]);
    const cli = fakeCli('badlist', {}, { agents: 'claude' });
    await setUp(pool, cli.path);
    expect(recorded.error).toEqual(['steno init gave an answer the extension cannot read']);
    expect(recorded.picks).toEqual([]);
  });

  it('refuses in Restricted Mode with the trust message, before anything else', async () => {
    workspace.isTrusted = false;
    const pool = await pooled([plain('restricted')]);
    const cli = fakeCli('restricted');
    await setUp(pool, cli.path);
    expect(recorded.warning).toEqual(['Setting steno up needs a trusted workspace']);
    expect(recorded.picks).toEqual([]);
    expect(cli.calls()).toEqual([]);
  });

  it('is the steno.setUp command', async () => {
    const pool = await pooled([project('registered')]);
    registerSetUp(pool, fakeCli('registered').path);
    await commands.executeCommand(SET_UP_COMMAND);
    expect(recorded.info).toEqual(['No folder here needs set-up']);
  });
});
