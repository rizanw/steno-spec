# Getting started

This walks one feature from idea to finished tasks. It takes about as long as the feature itself:
steno adds gates and checks, not ceremony.

## 1. Install

Install the CLI from npm (Node ≥ 22). The package is `steno-spec`; the command is `steno`:

```bash
npm install -g steno-spec
```

To build from source instead, see [Contributing](../CONTRIBUTING.md).

Check it:

```bash
steno --version
```

## 2. Set up your project

In the root of the project you want to spec:

```bash
steno init --agent claude,codex,opencode
```

```text
initialised ./.steno
skills (7): steno-brainstorm, steno-design, steno-review, steno-run, steno-spec, steno-steer, steno-tasks
  claude      .claude/skills
  codex       .agents/skills
  opencode    .agents/skills
reviewers (6) for claude: .claude/agents/steno-reviewer-*.md
next: ask your agent to "generate steering" (steno-steer), then: steno new <feature-slug>
```

What you get:

```text
.steno/
  config.yaml        specsDir, steeringDir, ctxBudget, steeringBudget, reviewer, agents
  specs/             one folder per spec
  steering/          optional project context (see Concepts)
.agents/skills/      the seven steno-* skills (canonical copy)
.claude/skills/      symlinks to .agents/skills (one folder per non-native agent)
AGENTS.md            a short block telling any agent how to read specs cheaply
```

Use `--copy` instead of symlinks if your tooling or OS does not follow them, and `--no-agents-md` to leave `AGENTS.md` alone. Re-running `init` is safe: it refreshes the skills and keeps your config.

Commit `.steno/`, `.agents/` and the agent skill folders so your team gets the same skills.

## 3. Generate steering (once per project)

```text
> generate steering
```

The `steno-steer` skill runs `steno steer scan`, which fingerprints the repo at zero tokens and suggests files: `product.md`, `tech.md`, `structure.md`, and topic files the repo shows evidence for, such as `database.md` when it finds an ORM or a migrations folder. The agent fills each file with facts from the few files the scan names, then runs `steno steer lint`. From then on every spec and task packet starts from those facts. Skip this on a toy project; `steno new` reminds you.

## 4. Ask for a spec

Open your agent in the project and describe the feature in a sentence or two:

```text
> start a spec for wallet owner filtering: household members should be able to narrow the wallet dropdown by owner and see owner-scoped totals
```

The `steno-spec` skill takes it from there:

1. **Intake.** Asks whether it is a feature or a bugfix and which mode you want (gated, quick, or brief first), then runs `steno new <slug>`.
2. **Explore.** Reads `.steno/steering/` and the code the feature touches, using a sub-agent when the harness has one.
3. **Outline.** Writes the Introduction, a Glossary of `Term_Names`, and one `### Requirement N:` per capability with its user story, then checks the outline with you.
4. **Detail.** Adds 3–6 EARS acceptance criteria per requirement, in user terms only.
5. **Check.** Runs `steno lint requirements` and fixes what it can.
6. **Hand over.** Shows you the result and offers: approve, fresh-context review, or edit.

You can check where things stand at any time:

```bash
steno status
```

```text
wallet-owner-filter — Wallet owner filter  [feature, gated]
phase: requirements   approved: none
R 1 (3 criteria)   D 0 sections   T 0/0 done
lint: 0 errors, 1 warnings
changed since last status: requirements.md
```

## 5. Approve, design, approve, plan

Each phase ends at a gate you control. Say "approved" (or run the command yourself) and the agent moves on:

| You say | What happens |
|---|---|
| "approved, write the design" | `steno approve requirements` records the gate; `steno-design` runs `steno scaffold` for the `design.md` skeleton and fills it so every requirement is satisfied by a named `{#D-id}` section |
| "approved, break it into tasks" | `steno approve design` records the gate; `steno-tasks` scaffolds `tasks.md` and fills it with numbered checkboxes and `_Requirements:_` / `_Design:_` footers |
| "approved" | `steno approve tasks` moves the spec to the execute phase |

`approve` refuses while `steno lint` reports errors. Warnings do not block. `--force` overrides errors when you have a reason.

To see that everything is connected before you start building:

```bash
steno trace
```

```text
R1    Filter wallets by owner        crit 3  design D-owner-filter  tasks T1.1,T1.2 (0/2 done)
```

## 6. Build, one task at a time

```text
> do the next task
```

`steno-run` loops over:

```bash
steno next          # [ ]  T1.1 Add OwnerFilter component
steno ctx T1.1      # the packet: criteria, terms, design section, likely files
# … implement and test …
steno done T1.1     # ticks the box, completes parents, prints the next task
```

The agent works from the packet, not from the spec files. If the packet trims something to fit the budget, it says what (for example `trimmed: D-arch`) and the agent can fetch it with `steno show D-arch`.

Say "continue the spec" to keep going, or stop after any task. When the last task is done the spec moves to `done`.

## 7. Review (optional, any phase)

```text
> review the design
```

`steno-review` runs `steno review --stage design`, which writes a packet to `.steno/specs/<slug>/reviews/` containing only the document, the requirements outline, the trace, and the source files the design references. A reviewer with no conversation history reads that and nothing else. steno starts its own read-only reviewer personas. With `reviewer: egm` and [EGM](agents.md#egm-elephant-goldfish-model) installed, the review runs through `egm-review` instead. If the harness cannot spawn a sub-agent, the skill stops and says so rather than reviewing with a polluted context.

After shipping, `steno review --stage drift` builds a packet for checking the code against the spec.

## Other ways to start

**Quick spec** for small, well-understood work. All three files at once, no gates:

```text
> quick spec for fixing the date picker crash
```

```bash
steno quick fix-date-picker
```

**Bugfix spec.** `bugfix.md` replaces `requirements.md`, with Current, Expected and Unchanged Behavior sections so the fix does not break what works today:

```text
> bugfix spec for totals showing the wrong currency
```

```bash
steno new wrong-currency --bugfix
```

**Brief first.** For an idea that is not scoped yet. `steno-brainstorm` stress-tests it (through EGM's `egm-brainstorm` if you ask for it) and saves the agreed direction as `brief.md`:

```text
> brainstorm shared budgets before we write requirements
```

```bash
steno new shared-budgets --brief
```

## Next

- [Tutorial](../examples/link-shortener/TUTORIAL.md): build a feature on the example project, with a finished spec to compare against
- [Concepts](concepts.md): what the IDs, lint rules and packets are doing
- [CLI reference](cli.md): every command and flag
- [Agents & integrations](agents.md): other agents, EGM, coming from Kiro
