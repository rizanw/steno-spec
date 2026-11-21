// The process rules: the restart window, finding a program on PATH, which batch paths cmd.exe can be given and how
// its command line is quoted, and the walk up to an enclosing steno project.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { MAX_EXITS, RestartWindow, WINDOW_MS, cmdLine, findOnPath, isBatch, parentProject, unsafeBatch, type Env } from '../../src/host/process.js';

const files = (...paths: string[]) => { const set = new Set(paths); return (p: string) => set.has(p); };
const posixEnv: Env = { path: '/usr/local/bin:/usr/bin::/opt/bin', windows: false };
const winEnv: Env = { path: 'C:\\Windows;C:\\Users\\u\\AppData\\Roaming\\npm', pathExt: '.COM;.EXE;.BAT;.CMD', windows: true };

describe('RestartWindow', () => {
  it('restarts the first four exits and stops on the fifth inside the window', () => {
    const w = new RestartWindow();
    const t = 1_000_000;
    expect([0, 1, 2, 3, 4].map(i => w.record(t + i * 1000)))
      .toEqual(['restart', 'restart', 'restart', 'restart', 'stop']);
  });

  it('forgets exits that fall out of the window', () => {
    const w = new RestartWindow();
    const t = 1_000_000;
    for (let i = 0; i < 4; i++) w.record(t + i);
    // the fifth exit arrives after the first four have aged out, so it is a first exit again
    expect(w.record(t + WINDOW_MS + 1)).toBe('restart');
  });

  it('starts over after reset, so the user\'s Restart gets a clean record', () => {
    const w = new RestartWindow();
    const t = 1_000_000;
    for (let i = 0; i < MAX_EXITS; i++) w.record(t + i);
    w.reset();
    expect(w.record(t + MAX_EXITS)).toBe('restart');
  });

  it('stops exactly on an exit that is the fifth or later within the window', () => {
    // the gaps between exits, with the window's own edges among the likely values, so the boundary is exercised
    // Gaps that divide the window, so sums of them land exactly on WINDOW_MS often: that is the one
    // difference between "inside the window" and "outside" it, and the boundary must be exercised.
    const onTheGrid = fc.constantFrom(0, 1, WINDOW_MS / 4, WINDOW_MS / 2, WINDOW_MS - 1, WINDOW_MS, WINDOW_MS + 1);
    const gap = fc.oneof(
      { arbitrary: onTheGrid, weight: 4 },
      { arbitrary: fc.integer({ min: 0, max: 400_000 }), weight: 1 },
    );
    fc.assert(fc.property(
      fc.array(gap, { minLength: 1, maxLength: 40 }),
      gaps => {
        const w = new RestartWindow();
        // an increasing list of exit times, built from the gaps between them
        let now = 0;
        const times = gaps.map(g => (now += g));
        times.forEach((t, i) => {
          // the model: how many of the exits up to and including this one fall inside the window ending at it
          const within = times.slice(0, i + 1).filter(earlier => t - earlier < WINDOW_MS).length;
          expect(w.record(t)).toBe(within >= MAX_EXITS ? 'stop' : 'restart');
        });
      },
    ), { numRuns: 1000 });
  });
});

describe('findOnPath', () => {
  it('finds the bare name on POSIX, in PATH order, skipping empty entries', () => {
    expect(findOnPath('claude', posixEnv, files('/usr/bin/claude', '/opt/bin/claude'))).toBe('/usr/bin/claude');
    expect(findOnPath('claude', posixEnv, files('/usr/bin/claude.cmd'))).toBeUndefined();
    expect(findOnPath('claude', posixEnv, files())).toBeUndefined();
  });

  it('tries only the PATHEXT endings on Windows, in PATHEXT order', () => {
    const npm = 'C:\\Users\\u\\AppData\\Roaming\\npm';
    expect(findOnPath('codex', winEnv, files(`${npm}\\codex.cmd`, `${npm}\\codex.exe`))).toBe(`${npm}\\codex.exe`);
    expect(findOnPath('codex', winEnv, files('C:\\Windows\\codex'))).toBeUndefined();
  });

  it('resolves a bare npm script beside its .cmd shim to the shim on Windows', () => {
    const npm = 'C:\\Users\\u\\AppData\\Roaming\\npm';
    expect(findOnPath('gemini', winEnv, files(`${npm}\\gemini`, `${npm}\\gemini.cmd`))).toBe(`${npm}\\gemini.cmd`);
  });

  it('falls back to the usual PATHEXT when the variable is missing', () => {
    const env: Env = { path: 'C:\\bin', windows: true };
    expect(findOnPath('opencode', env, files('C:\\bin\\opencode.exe'))).toBe('C:\\bin\\opencode.exe');
  });
});

describe('parentProject', () => {
  it('a parent project is the nearest folder above', () => {
    const segment = fc.constantFrom('a', 'b', 'c');
    const dir = fc.array(segment, { maxLength: 4 }).map(parts => '/' + parts.join('/'));
    fc.assert(fc.property(dir, fc.uniqueArray(dir), (start, projects) => {
      const exists = (p: string) => projects.some(d => posix.join(d, '.steno') === p);
      const ancestors: string[] = [];
      for (let at = start; at !== '/';) { at = posix.dirname(at); ancestors.push(at); }
      const expected = ancestors.find(a => projects.includes(a));
      expect(parentProject(start, exists)).toBe(expected);
    }));
  });

  it('never counts the folder itself, and walks up to the root', () => {
    const holding = (...dirs: string[]) => (p: string) => dirs.some(d => posix.join(d, '.steno') === p);
    expect(parentProject('/work/app', holding('/work/app'))).toBeUndefined();
    expect(parentProject('/work/repo/packages/app', holding('/work/repo', '/work'))).toBe('/work/repo');
    expect(parentProject('/work/app', holding('/'))).toBe('/');
    expect(parentProject('/', holding('/'))).toBeUndefined();
  });

  it('walks a Windows path by Windows rules on any host', () => {
    const seen: string[] = [];
    const found = parentProject('C:\\work\\repo\\app', p => { seen.push(p); return p === 'C:\\work\\.steno'; });
    expect(found).toBe('C:\\work');
    expect(seen).toEqual(['C:\\work\\repo\\.steno', 'C:\\work\\.steno']);
  });

  it('finds a real .steno folder on disk', () => {
    const root = mkdtempSync(join(tmpdir(), 'steno-parent-'));
    try {
      mkdirSync(join(root, '.steno'));
      mkdirSync(join(root, 'packages', 'app'), { recursive: true });
      expect(parentProject(join(root, 'packages', 'app'), existsSync)).toBe(root);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});

describe('cmd.exe command line', () => {
  it('quotes the program and each argument that holds a space', () => {
    expect(cmdLine('C:\\npm\\codex.cmd', ['$steno-run T1 auth'])).toBe('"C:\\npm\\codex.cmd" "$steno-run T1 auth"');
    expect(cmdLine('C:\\npm\\gemini.BAT', ['-i', 'x y'])).toBe('"C:\\npm\\gemini.BAT" -i "x y"');
  });

  it('takes .cmd and .bat in any case as batch files, and nothing else', () => {
    expect(['C:\\npm\\codex.cmd', 'C:\\npm\\gemini.BAT', 'x.Cmd'].map(isBatch)).toEqual([true, true, true]);
    expect(['C:\\bin\\claude.exe', '/usr/bin/claude', 'codex.cmd.exe'].map(isBatch)).toEqual([false, false, false]);
  });

  it('refuses a batch path holding a quote or a percent sign, only on Windows', () => {
    expect(unsafeBatch('C:\\100%\\claude.cmd', true)).toBe(true);
    expect(unsafeBatch('C:\\a"b\\claude.bat', true)).toBe(true);
    expect(unsafeBatch('C:\\npm\\claude.cmd', true)).toBe(false);
    expect(unsafeBatch('C:\\100%\\claude.exe', true)).toBe(false);
    expect(unsafeBatch('/opt/100%/claude.cmd', false)).toBe(false);
  });
});
