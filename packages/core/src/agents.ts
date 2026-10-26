import { cpSync, symlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Where each coding agent discovers skills. The canonical copy always lives in
 * `.agents/skills/` (the path the open Agent Skills spec and Codex use); other
 * agents get a symlink. `native: true` means the agent already reads `.agents/skills`.
 */
export interface AgentTarget {
  key: string; label: string; skillsDir: string; native?: boolean; note?: string;
  /** Folder the agent loads named sub-agent definitions from, when its format is known. Reviewers are installed there. */
  subagentsDir?: string;
}

export const AGENTS: AgentTarget[] = [
  { key: 'codex', label: 'OpenAI Codex CLI', skillsDir: '.agents/skills', native: true },
  { key: 'opencode', label: 'OpenCode', skillsDir: '.agents/skills', native: true },
  { key: 'antigravity', label: 'Google Antigravity', skillsDir: '.agents/skills', native: true },
  { key: 'claude', label: 'Claude Code', skillsDir: '.claude/skills', subagentsDir: '.claude/agents' },
  { key: 'cursor', label: 'Cursor', skillsDir: '.cursor/skills' },
  { key: 'copilot', label: 'GitHub Copilot', skillsDir: '.github/skills' },
  { key: 'gemini', label: 'Gemini CLI', skillsDir: '.gemini/skills' },
  { key: 'kiro', label: 'Kiro', skillsDir: '.kiro/skills', note: 'set specsDir: .kiro/specs in .steno/config.yaml to share specs with Kiro' },
];

export function agentByKey(key: string): AgentTarget | undefined { return AGENTS.find(a => a.key === key); }

export const REVIEWER_AGENT_PREFIX = 'steno-reviewer-';

/**
 * A reviewer persona as a registered, read-only sub-agent definition (Markdown with frontmatter, the format
 * Claude Code reads from `.claude/agents/`). A registered reviewer starts with only the read tools, so it costs
 * a fraction of a general-purpose sub-agent that is handed the same persona file.
 */
export function reviewerAgent(persona: string, personaText: string): { file: string; content: string } {
  const name = `${REVIEWER_AGENT_PREFIX}${persona}`;
  const stages = /\(stages:\s*([^)]+)\)/.exec(personaText)?.[1].trim() ?? 'any';
  const content = [
    '---',
    `name: ${name}`,
    `description: steno fresh-context reviewer (${persona}) for a spec review packet. Stages - ${stages}. Read-only. Give it only the packet path.`,
    'tools: Read, Grep, Glob',
    '---',
    '',
    personaText.trim(),
    '',
    'You are read-only: never create or edit a file. You are given the path of one review packet. Read it; read other files only when your instructions above say to read the source files the packet lists. Reply with the findings in the output format above and nothing else.',
    '',
  ].join('\n');
  return { file: `${name}.md`, content };
}

/**
 * Link `dst` to the skill folder at `target` (relative to dst's folder), or copy it when `copy` is set.
 * Windows without Developer Mode refuses symlinks with EPERM; then it copies instead and returns 'copy',
 * so the caller can copy every later skill too. `link` is injectable for tests.
 */
export function linkOrCopy(target: string, dst: string, copy: boolean, link: typeof symlinkSync = symlinkSync): 'link' | 'copy' {
  const abs = resolve(dirname(dst), target);
  if (!copy) {
    try { link(target, dst); return 'link'; }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EPERM') throw e; }
  }
  cpSync(abs, dst, { recursive: true });
  return 'copy';
}
