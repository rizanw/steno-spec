#!/usr/bin/env node
import { Command } from 'commander';
import { createRequire } from 'node:module';
import { register as initCmd } from './commands/init.js';
import { register as specCmds } from './commands/spec.js';
import { register as steerCmds } from './commands/steer.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

const program = new Command('steno')
  .description('shorthand specs for any coding agent')
  .version(version)
  .option('--json', 'machine-readable output')
  .option('--root <dir>', 'project root (default: nearest .steno/ upwards)')
  .showHelpAfterError();

initCmd(program);
specCmds(program);
steerCmds(program);

program.parseAsync(process.argv).catch((e: Error) => { process.stderr.write(`steno: ${e.message}\n`); process.exit(1); });
