#!/usr/bin/env node
// Rewrites packages/core/test/fixtures/contract.v<N>.json from CONTRACT. Refuses when the change
// breaks the recorded contract of the same protocol version: raise PROTOCOL_VERSION instead.
// Reads the built core, so `pnpm contract:record` builds it first.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { CONTRACT, contractBreaks } = await import(pathToFileURL(join(root, 'packages/core/dist/contract.js')).href);

const file = join(root, 'packages/core/test/fixtures', `contract.v${CONTRACT.protocolVersion}.json`);
const now = JSON.parse(JSON.stringify(CONTRACT));
if (existsSync(file)) {
  const breaks = contractBreaks(JSON.parse(readFileSync(file, 'utf8')), now);
  if (breaks.length) {
    console.error(`refusing to record: these changes break protocol version ${CONTRACT.protocolVersion}:`);
    for (const b of breaks) console.error(`  ${b}`);
    console.error('raise PROTOCOL_VERSION to record a new contract file, or undo the change.');
    process.exit(1);
  }
}
writeFileSync(file, JSON.stringify(now, null, 2) + '\n');
console.log(`recorded ${relative(root, file)}`);
