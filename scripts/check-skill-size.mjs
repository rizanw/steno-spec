// CI guard: every SKILL.md stays small. Token estimate = chars/4.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
const MAX_LINES = 80, MAX_TOKENS = 1200;
const dir = 'packages/skills/skills';
let bad = 0;
for (const name of readdirSync(dir)) {
  const f = join(dir, name, 'SKILL.md');
  try { statSync(f); } catch { continue; }
  const text = readFileSync(f, 'utf8');
  const lines = text.split('\n').length, tokens = Math.ceil(text.length / 4);
  const ok = lines <= MAX_LINES && tokens <= MAX_TOKENS;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(18)} ${String(lines).padStart(3)} lines ${String(tokens).padStart(5)} tokens`);
}
process.exit(bad ? 1 : 0);
