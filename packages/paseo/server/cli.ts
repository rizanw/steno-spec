// New Spec, Set Up and the agent list through the bundled CLI, with core's reading of the CLI's answer. This file
// only fits core's answers to the panel's RPC shapes and sends the CLI's standard error to the plugin log.
import { existsSync } from 'node:fs';
import * as core from './vendor/host.mjs';
import type { RpcOutcome } from '../shared/contracts';
import { runToEnd } from './programs';

export type RunCli = core.RunCli;

/** Where a failed run's full standard error goes; `paseo plugin logs steno` shows the plugin's console. */
export type Log = (line: string) => void;

const runBundled: RunCli = (args, directory) => runToEnd('steno-cli.mjs', args, { cwd: directory });
const pluginLog: Log = line => console.log(line);

/** The panel names the user's own writing `me`; core calls it `self`. */
export interface NewSpecRequest extends Omit<core.NewSpecRequest, 'writer'> { writer: 'agent' | 'brainstorm' | 'me' }

/** A failure as the panel shows it, its `log` written to the plugin log rather than sent on. */
function refused(outcome: { error: core.StructuredError; log?: string }, log: Log): RpcOutcome {
  if (outcome.log) log(`steno: ${outcome.error.message}\n${outcome.log}`);
  return { ok: false, error: outcome.error };
}

export async function newSpec(directory: string, req: NewSpecRequest, run: RunCli = runBundled, log: Log = pluginLog): Promise<RpcOutcome> {
  const r = await core.newSpec(run, directory, { ...req, writer: req.writer === 'me' ? 'self' : req.writer });
  return r.ok ? { ok: true, spec: r.value.spec, phase: r.value.phase } : refused(r, log);
}

/** The agents the CLI can set up. Throws on a failure, so the dialog shows the message where its list would be. */
export async function listAgents(directory: string, run: RunCli = runBundled, log: Log = pluginLog): Promise<{ agents: core.CliAgent[] }> {
  const r = await core.listAgents(run, directory);
  if (!r.ok) { refused(r, log); throw new Error(r.error.message); }
  return { agents: r.value };
}

/** Set the directory up for these agents, none meaning the shared skills folder only. Refused inside another project. */
export async function setUp(directory: string, agents: string[], run: RunCli = runBundled, exists: (p: string) => boolean = existsSync, log: Log = pluginLog): Promise<RpcOutcome> {
  const r = await core.setUp(run, directory, agents, exists);
  return r.ok ? { ok: true } : refused(r, log);
}
