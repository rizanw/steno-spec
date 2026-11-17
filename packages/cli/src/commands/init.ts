import { Command } from 'commander';
import { existsSync, mkdirSync, cpSync, readdirSync, writeFileSync, readFileSync, lstatSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { AGENTS, agentByKey, loadConfig, saveConfig, configTemplate, reviewerAgent, REVIEWER_AGENT_PREFIX, linkOrCopy } from '@steno/core';
import { ctxFromOpts, out, fail } from '../io.js';

const require = createRequire(import.meta.url);
/** Skills ship inside the published package (`<pkg>/skills`); in the workspace they come from @steno/skills. */
export function skillsSource(): string {
  const bundled = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills');
  if (existsSync(join(bundled, 'steno-spec', 'SKILL.md'))) return bundled;
  return join(dirname(require.resolve('@steno/skills/package.json')), 'skills');
}

const AGENTS_MD_BLOCK = `
<!-- steno:start -->
## Spec-driven work (steno)
Specs live in \`.steno/specs/<slug>/\` (requirements.md, design.md, tasks.md). Use the \`steno-*\` skills in \`.agents/skills/\`.
Never read a whole spec: run \`steno status\`, \`steno next\`, \`steno ctx <task>\`, \`steno show <id>\`.
<!-- steno:end -->
`;

export function register(program: Command): void {
  program.command('init')
    .description('set up .steno/ and install skills for one or more agents')
    .option('-a, --agent <keys>', `comma list of: ${AGENTS.map(a => a.key).join(', ')}`, 'claude,codex')
    .option('--copy', 'copy skills into each agent dir instead of symlinking')
    .option('--no-agents-md', 'do not touch AGENTS.md')
    .action((opts) => {
      const ctx = ctxFromOpts(program.opts());
      // An explicit --root is taken as given, so a project nested inside another steno project
      // (an example, a monorepo package) can be initialised; without it, the nearest .steno/ upwards wins.
      const explicit = program.opts().root as string | undefined;
      const root = explicit ? resolve(explicit) : ctx.root;
      const keys = String(opts.agent).split(',').map(s => s.trim()).filter(Boolean);
      const bad = keys.filter(k => !agentByKey(k));
      if (bad.length) fail(`unknown agent(s): ${bad.join(', ')} (supported: ${AGENTS.map(a => a.key).join(', ')})`);

      mkdirSync(join(root, '.steno', 'specs'), { recursive: true });
      mkdirSync(join(root, '.steno', 'steering'), { recursive: true });
      const cfgPath = join(root, '.steno', 'config.yaml');
      if (!existsSync(cfgPath)) writeFileSync(cfgPath, configTemplate());

      // canonical copy
      const canonical = join(root, '.agents', 'skills');
      mkdirSync(canonical, { recursive: true });
      const src = skillsSource();
      const installed: string[] = [];
      for (const name of readdirSync(src)) {
        const dst = join(canonical, name);
        rmSync(dst, { recursive: true, force: true });
        cpSync(join(src, name), dst, { recursive: true });
        installed.push(name);
      }

      // per-agent links
      const linked: Record<string, string> = {};
      let copy = !!opts.copy, copiedFallback = false;
      for (const k of keys) {
        const a = agentByKey(k)!;
        if (a.native) { linked[k] = canonical; continue; }
        const dir = join(root, a.skillsDir);
        mkdirSync(dir, { recursive: true });
        for (const name of installed) {
          const dst = join(dir, name);
          if (existsSync(dst) || isLink(dst)) rmSync(dst, { recursive: true, force: true });
          // Without symlink rights (Windows without Developer Mode) linkOrCopy copies; keep copying after that.
          if (linkOrCopy(relative(dir, join(canonical, name)), dst, copy) === 'copy' && !copy) { copy = true; copiedFallback = true; }
        }
        linked[k] = dir;
      }

      // registered reviewers, for agents whose sub-agent format is known
      const reviewersSrc = join(src, 'steno-review', 'reviewers');
      const personas = existsSync(reviewersSrc) ? readdirSync(reviewersSrc).filter(f => f.endsWith('.md')).sort() : [];
      const reviewers: Record<string, string[]> = {};
      for (const k of keys) {
        const a = agentByKey(k)!;
        if (!a.subagentsDir || !personas.length) continue;
        const dir = join(root, a.subagentsDir);
        mkdirSync(dir, { recursive: true });
        for (const f of readdirSync(dir)) if (f.startsWith(REVIEWER_AGENT_PREFIX) && f.endsWith('.md')) rmSync(join(dir, f));
        reviewers[k] = personas.map(f => {
          const agent = reviewerAgent(f.replace(/\.md$/, ''), readFileSync(join(reviewersSrc, f), 'utf8'));
          writeFileSync(join(dir, agent.file), agent.content);
          return agent.file.replace(/\.md$/, '');
        });
      }

      if (opts.agentsMd !== false) {
        const p = join(root, 'AGENTS.md');
        const cur = existsSync(p) ? readFileSync(p, 'utf8') : '';
        // The heading counts too: a formatter or a hand edit may have dropped the comment markers.
        if (!cur.includes('<!-- steno:start -->') && !/^## Spec-driven work \(steno\)\s*$/m.test(cur)) writeFileSync(p, (cur ? cur.trimEnd() + '\n' : '# Agent instructions\n') + AGENTS_MD_BLOCK);
      }

      saveConfig(root, { agents: [...new Set([...loadConfig(root).agents, ...keys])] });

      out(ctx, { root, skills: installed, agents: linked, reviewers }, () => [
        `initialised ${relative(process.cwd(), root) || '.'}/.steno`,
        `skills (${installed.length}): ${installed.join(', ')}`,
        ...Object.entries(linked).map(([k, d]) => `  ${k.padEnd(11)} ${relative(root, d)}${agentByKey(k)?.note ? `  (${agentByKey(k)!.note})` : ''}`),
        ...Object.entries(reviewers).map(([k, names]) => `reviewers (${names.length}) for ${k}: ${relative(root, join(root, agentByKey(k)!.subagentsDir!))}/${REVIEWER_AGENT_PREFIX}*.md`),
        ...(copiedFallback ? ['symlinks are not allowed here, so skills were copied; re-run steno init after upgrading steno'] : []),
        'next: ask your agent to "generate steering" (steno-steer), then: steno new <feature-slug>',
      ].join('\n'));
    });
}

function isLink(p: string): boolean { try { return lstatSync(p).isSymbolicLink(); } catch { return false; } }
