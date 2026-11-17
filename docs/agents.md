# Agents & integrations

## Supported agents

`steno init --agent` takes a comma list of these keys (default `claude,codex`):

| Key | Agent | Skills folder | Notes |
|---|---|---|---|
| `claude` | Claude Code | `.claude/skills/` | invoke as `/steno-spec` etc., or just describe what you want |
| `codex` | OpenAI Codex CLI | `.agents/skills/` | reads the canonical copy directly, no link |
| `opencode` | OpenCode | `.agents/skills/` | reads the canonical copy directly, no link |
| `antigravity` | Google Antigravity | `.agents/skills/` | reads the canonical copy directly, no link |
| `cursor` | Cursor | `.cursor/skills/` | |
| `copilot` | GitHub Copilot | `.github/skills/` | |
| `gemini` | Gemini CLI | `.gemini/skills/` | |
| `kiro` | Kiro | `.kiro/skills/` | see [Coming from Kiro](#coming-from-kiro) |

The canonical skills always live in `.agents/skills/`, the path of the open Agent Skills spec. Every other agent gets a relative symlink per skill, or a copy with `--copy`. Claude Code and Codex are the primary targets; the others install to their documented skills paths and are less tested.

### Any other agent

`steno init` adds this block to `AGENTS.md`, which most agents read:

```md
## Spec-driven work (steno)
Specs live in `.steno/specs/<slug>/` (requirements.md, design.md, tasks.md). Use the `steno-*` skills in `.agents/skills/`.
Never read a whole spec: run `steno status`, `steno next`, `steno ctx <task>`, `steno show <id>`.
```

If your agent reads neither skills nor `AGENTS.md`, point it at `.agents/skills/steno-spec/SKILL.md`
when you start.

### Adding an agent

One line in [`packages/core/src/agents.ts`](../packages/core/src/agents.ts): a key, a label, and the
folder the agent loads skills from. Set `native: true` if it already reads `.agents/skills/`.

## EGM (Elephant-Goldfish Model)

[EGM](https://github.com/google/elephant-goldfish-model) ([egm.dev](https://egm.dev)) splits spec
work between an **elephant**, the agent with full project context that drafts, and a **goldfish**,
a reviewer with no history that sees only the document and the sources it cites, so it catches the
assumptions the elephant stopped noticing. EGM covers brainstorm, drafting, review and drift for
design docs. steno adds the requirements, tasks and execution phases and the ID traceability EGM
does not have.

steno does not need EGM. By default (`reviewer: default`) `steno-review` uses steno's own reviewers, and `steno-brainstorm` runs its own lightweight version. EGM is an integration you switch on when you want critique from EGM.

With `reviewer: egm` in `.steno/config.yaml`, reviews go to EGM when it is installed. You can also ask for EGM in a single request ("review the design with EGM", "brainstorm this with EGM") without changing the setting:

| steno skill | Hands off to | Result saved as |
|---|---|---|
| `steno-brainstorm` | `egm-brainstorm` | `brief.md` (Problem, Proposed direction, Alternatives considered, Open questions, Decision) |
| `steno-review` | `egm-review` | `reviews/<date>-<stage>.md` |
| `steno-review` (drift) | `egm-drift-report` | `reviews/<date>-drift.md` |

Install EGM in Claude Code:

```bash
claude plugin marketplace add google/elephant-goldfish-model 

claude plugin install egm@egm
```

Or in Codex:

```bash
codex plugin marketplace add google/elephant-goldfish-model

codex plugin add egm@egm
```

With `reviewer: default`, `steno-review` starts its own zero-history reviewers using the personas in `.agents/skills/steno-review/reviewers/`: scope, completeness, clarity, code-fit, implementability, and EARS. The scope reviewer only proposes what to cut, defer, merge or split. Every finding is a `fix` (rewrite or delete existing text), a `decide` (a question for you, with options) or a `note` for the next stage; the skill asks you the `decide` findings first and never adds to the spec without your yes. When you choose a split, the skill creates the new spec with `steno new` and moves the requirements into it before it removes them from the original. Either way the reviewer reads only the packet from `steno review`. If the harness cannot spawn a sub-agent, the skill stops and tells you, instead of reviewing inside the same context that wrote the document.

For Claude Code, `steno init` also writes each persona as a registered read-only sub-agent in `.claude/agents/steno-reviewer-<persona>.md` (tools: Read, Grep, Glob). The skill uses these when they exist, because a registered reviewer starts with far less context than a general-purpose sub-agent handed the same persona file. Restart Claude Code after `steno init` so it loads them. Other agents fall back to a plain sub-agent.

### Which to use

A pilot benchmark on one requirements document ([bench/review-pilot](../bench/review-pilot/README.md)) found that steno's reviewers and EGM's each caught all ten planted defects. steno's used under half the tokens and returned far fewer findings on a document with nothing planted. EGM's design reviewer raised deeper risks that steno's did not. The benchmark did not cover the design stage, where EGM is aimed.

## Coming from Kiro

steno reads Kiro's spec files as they are: `# Requirements Document`, Introduction, Glossary,
`### Requirement 1:`, `#### Acceptance Criteria`, EARS criteria, and `_Requirements: 1.1_` footers
in tasks. Steering files use Kiro's frontmatter (`inclusion`, `fileMatchPattern`). Two ways in:

**Share the folders.** Set these in `.steno/config.yaml` and both tools work on the same specs
and steering (`steno steer scan` then suggests files into `.kiro/steering/` too):

```yaml
specsDir: .kiro/specs
steeringDir: .kiro/steering
```

The first time steno touches a Kiro spec folder it adds a `spec.yaml` beside Kiro's files to track the phase, with the stages that already exist marked as approved, the same as `steno import`. Kiro ignores the file, and steno reads Kiro's headings and footers as they are, so nothing is converted.

**Import a copy.** Brings one spec into `.steno/specs/`, marks the stages it already has as
approved, and sets the phase from what exists:

```bash
steno import .kiro/specs/login
```

Import rewrites requirement headings to the short `## R1 Title` form; both forms parse. Use the
shared folder if you want the files byte-for-byte unchanged.

The only addition steno makes to Kiro's format is the optional `{#D-id}` anchor and `_Satisfies:_`
footer on design headings.
