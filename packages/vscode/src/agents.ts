// The coding agents we can hand work to, and how to tell whether each one is installed. This file doesn't touch
// `vscode`: installed extensions, PATH and the file system come in through a Probe, so tests can fake them.
import { posix, win32 } from 'node:path';
import type { CallForm } from './calls.js';

export interface AgentAdapter {
  id: string;
  label: string;
  form: CallForm;
  /** The agent only fills its input box with the call; the user still has to press Enter to send it. */
  fillOnly: boolean;
  via:
    | { extension: string; deliver: 'chatCommand' | 'uri' }
    | { program: string; args: (call: string) => string[] }
    | 'clipboard';
}
/** The bits of the environment we need to find a program: PATH, PATHEXT and whether we're on Windows. */
export interface Env { path: string; pathExt?: string; windows: boolean }
export interface Probe { hasExtension(id: string): boolean; env: Env; exists(p: string): boolean }

/** Every agent we support, in the order the picker shows them. */
export const ADAPTERS: readonly AgentAdapter[] = [
  { id: 'copilot', label: 'Copilot Chat', form: 'slash', fillOnly: true,
    via: { extension: 'GitHub.copilot-chat', deliver: 'chatCommand' } },
  { id: 'claude-code', label: 'Claude Code (extension)', form: 'slash', fillOnly: true,
    via: { extension: 'anthropic.claude-code', deliver: 'uri' } },
  { id: 'claude', label: 'Claude Code (terminal)', form: 'slash', fillOnly: false,
    via: { program: 'claude', args: call => [call] } },
  { id: 'codex', label: 'Codex CLI (terminal)', form: 'dollar', fillOnly: false,
    via: { program: 'codex', args: call => [call] } },
  { id: 'gemini', label: 'Gemini CLI (terminal)', form: 'plain', fillOnly: false,
    via: { program: 'gemini', args: call => ['-i', call] } },
  { id: 'opencode', label: 'OpenCode (terminal)', form: 'plain', fillOnly: false,
    via: { program: 'opencode', args: call => ['--prompt', call] } },
  { id: 'clipboard', label: 'Copy to clipboard', form: 'slash', fillOnly: false, via: 'clipboard' },
];

const DEFAULT_PATHEXT = '.COM;.EXE;.BAT;.CMD';

/**
 * Finds `program` on PATH the way a shell would, without running anything, and returns its full path.
 * On Windows we only try the PATHEXT endings (`.exe`, `.cmd`, ...) and never the bare name, because npm puts an
 * extensionless shell script next to every `.cmd` shim and Windows can't start that script directly.
 */
export function findOnPath(program: string, env: Env, exists: (p: string) => boolean): string | undefined {
  const path = env.windows ? win32 : posix;
  const names = env.windows
    ? (env.pathExt || DEFAULT_PATHEXT).split(';').filter(Boolean).map(ext => program + ext.toLowerCase())   // Windows file names ignore case
    : [program];
  for (const dir of env.path.split(env.windows ? ';' : ':')) {
    if (!dir) continue;
    for (const name of names) {
      const file = path.join(dir, name);
      if (exists(file)) return file;
    }
  }
  return undefined;
}

/** Whether this agent is installed: its VS Code extension is present or its program is on PATH. The clipboard always works. */
export function detected(a: AgentAdapter, probe: Probe): boolean {
  if (a.via === 'clipboard') return true;
  if ('extension' in a.via) return probe.hasExtension(a.via.extension);
  return findOnPath(a.via.program, probe.env, probe.exists) !== undefined;
}
