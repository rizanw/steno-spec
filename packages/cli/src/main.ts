#!/usr/bin/env node
import { Command, CommanderError } from 'commander';
import { PROTOCOL_VERSION, StenoError, toStructuredError } from '@steno/core';
import { register as initCmd } from './commands/init.js';
import { register as specCmds } from './commands/spec.js';
import { register as steerCmds } from './commands/steer.js';
import { register as lspCmd } from './commands/lsp.js';

// the release version, compiled in at build time, so the binary reports it wherever the file is placed
declare const __STENO_VERSION__: string;
const version = __STENO_VERSION__;

// Parsing may stop before the options are read, so --json comes from the raw arguments.
const json = process.argv.slice(2).includes('--json');

const program = new Command('steno')
  .description('shorthand specs for any coding agent')
  .version(`${version} (protocol ${PROTOCOL_VERSION})`)
  .option('--json', 'machine-readable output')
  .option('--root <dir>', 'project root (default: nearest .steno/ upwards)')
  .showHelpAfterError(!json)
  // With --json the error goes to stdout as a structured error; commander's own message would only repeat it.
  .configureOutput(json ? { outputError: () => {} } : {})
  // set before the commands are added, so each subcommand inherits it
  .exitOverride();

initCmd(program);
specCmds(program);
steerCmds(program);
lspCmd(program);

/** Exit codes: 0 success, 2 for lint errors and a blocked approval, 1 for any other failure. */
// process.exitCode, not process.exit: a pipe to stdout may still be flushing.
function report(e: unknown): void {
  if (e instanceof CommanderError) {
    // --help and --version end parsing through the same path; they are not failures
    if (['commander.helpDisplayed', 'commander.version', 'commander.help'].includes(e.code)) { process.exitCode = e.exitCode; return; }
    // in text mode commander has already printed its message
    if (!json) { process.exitCode = 1; return; }
    e = new StenoError('invalid-request', e.message.replace(/^error: /, ''));
  }
  const err = toStructuredError(e);
  if (json) process.stdout.write(JSON.stringify(err, null, 2) + '\n');
  else process.stderr.write(`steno: ${err.message}\n`);
  process.exitCode = err.code === 'lint-blocked' ? 2 : 1;
}

program.parseAsync(process.argv).catch(report);
