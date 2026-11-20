// New Spec and Set Up through the bundled CLI, so a spec is created and checked exactly as `steno new` and
// `steno init` would in a terminal. The CLI answers in JSON; a refusal is its structured error, and it has then
// written nothing.
import { existsSync } from 'node:fs';
import { parentProject, PROTOCOL_VERSION } from './vendor/host.mjs';
import type { CliOutcome, Phase, StructuredError } from '../shared/contracts';
import { runToEnd } from './programs';

/** Runs the bundled CLI with these arguments in `directory`; tests swap in their own. */
export type RunCli = (args: string[], directory: string) => Promise<{ code: number | null; stdout: string; stderr: string }>;

const runBundled: RunCli = (args, directory) => runToEnd('steno-cli.mjs', args, { cwd: directory });

const failed = (message: string, extra: Partial<StructuredError> = {}): StructuredError =>
  ({ protocolVersion: PROTOCOL_VERSION, code: 'failed', message, ...extra });

/**
 * Run `steno --root DIR --json ARGS` and parse its answer. The global flags come first and every value is joined
 * to its flag, so a name or title that starts with a dash is never read as another flag.
 */
async function runJson(run: RunCli, directory: string, args: string[]): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: StructuredError }> {
  const r = await run(['--root', directory, '--json', ...args], directory);
  let data: unknown;
  try { data = JSON.parse(r.stdout); } catch { data = undefined; }
  if (r.code === 0 && typeof data === 'object' && data !== null) return { ok: true, data: data as Record<string, unknown> };
  const d = data as Partial<StructuredError> | undefined;
  if (d && typeof d.code === 'string' && typeof d.message === 'string') return { ok: false, error: d as StructuredError };
  return { ok: false, error: failed(r.stderr.trim() || `steno exited with ${r.code}`) };
}

export interface NewSpecRequest { kind: 'feature' | 'bugfix'; name: string; title?: string; writer: 'agent' | 'brainstorm' | 'me'; description?: string }

/** The arguments of `steno new`; the name comes after `--` and is checked by the CLI alone. */
export function newSpecArgs(req: NewSpecRequest): string[] {
  return [
    'new',
    ...(req.kind === 'bugfix' ? ['--bugfix'] : []),
    // a bugfix has no brief, so brainstorming one starts at its bugfix document
    ...(req.writer === 'brainstorm' && req.kind === 'feature' ? ['--brief'] : []),
    ...(req.title ? [`--title=${req.title}`] : []),
    ...(req.description ? [`--description=${req.description}`] : []),
    '--', req.name,
  ];
}

export async function newSpec(directory: string, req: NewSpecRequest, run: RunCli = runBundled): Promise<CliOutcome> {
  const r = await runJson(run, directory, newSpecArgs(req));
  if (!r.ok) return r;
  return { ok: true, spec: String(r.data.spec), phase: r.data.phase as Phase };
}

export async function listAgents(directory: string, run: RunCli = runBundled): Promise<{ agents: { key: string; label: string }[] }> {
  const r = await runJson(run, directory, ['init', '--list-agents']);
  if (!r.ok) throw new Error(r.error.message);
  return { agents: (r.data.agents as { key: string; label: string }[]).map(({ key, label }) => ({ key, label })) };
}

/** Set the directory up for these agents, none meaning the shared skills folder only. Refused inside another project. */
export async function setUp(directory: string, agents: string[], run: RunCli = runBundled, exists: (p: string) => boolean = existsSync): Promise<CliOutcome> {
  const project = parentProject(directory, exists);
  if (project) return { ok: false, error: failed(`this folder is inside the steno project at ${project}; open that project instead`, { file: project }) };
  const r = await runJson(run, directory, ['init', `--agent=${agents.join(',')}`]);
  return r.ok ? { ok: true } : r;
}
