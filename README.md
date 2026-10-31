<p align="center">
  <img src="./assets/steno.svg" alt="steno logo" width="140">
</p>

<h1 align="center">steno spec</h1>

<p align="center">
  <strong>Shorthand specs for any coding agent.</strong><br>
  Spec-driven development with a gate at every stage: requirements → design → tasks → execute,
  each one linted and approved by you before the next begins, with a fresh-eyes review whenever you want one.
  Works in Claude Code, Codex, Antigravity, Cursor, Copilot, Gemini CLI, OpenCode and Kiro, and stays cheap on tokens.
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="docs/getting-started.md">Getting started</a> ·
  <a href="docs/concepts.md">Concepts</a> ·
  <a href="docs/cli.md">CLI reference</a> ·
  <a href="docs/agents.md">Agents &amp; integrations</a>
</p>

---

- **Your agent writes, the CLI checks.** `steno` has no model in it. It scaffolds, lints, traces and
  slices; the thinking stays in the agent you already use.
- **A task gets a packet, not the whole spec.** `steno ctx T1.1` hands the agent only the criteria,
  terms, design sections and files that task needs, usually a few hundred tokens.
- **Plain Markdown specs, any agent.** `requirements.md`, `design.md`, `tasks.md` with EARS criteria
  and `_Requirements:_` footers, linked by stable ids.
- **Reviewed with fresh context.** `steno-review` starts read-only reviewers that see only the review
  packet, never your conversation.

## See it in action

You talk to your agent; the `steno-*` skills drive the CLI underneath.

```text
you   > start a spec for link expiry: a link can be given an expiry time, after which
        it no longer redirects

agent > steno new link-expiry              → explores the code, outlines 5 requirements,
        steno lint requirements            → writes EARS criteria, fixes lint, asks you to approve

you   > approved. write the design

agent > steno approve requirements         → design.md, every section traced to criteria

you   > approved. break it into tasks

agent > steno approve design               → tasks.md with _Requirements:_ / _Design:_ footers

you   > do the next task

agent > steno next                         → T2.1 Accept expiresAt in LinkService.create
        steno ctx T2.1                     → reads one packet, implements, runs tests
        steno done T2.1                    → next: T2.2
```

The packet is the point. For `T2.1` the agent reads this instead of the whole spec (shortened here):

```md
# T2.1 Accept `expiresAt` in `LinkService.create`, store it only when given
(part of T2 Service rules)

## Requirements
R1.1 WHEN a Link_Creator creates a Link with an Expiry_Time later than the current time, THE Shortener SHALL create the Link with that Expiry_Time.
R1.2 WHEN a Link_Creator creates a Link without an Expiry_Time, THE Shortener SHALL create a Link that never expires.

## Terms
Expiry_Time: the moment, chosen by the Link_Creator at creation, from which a Link no longer redirects.

## Design
### Create with expiry {#D-create}
_Satisfies: 1.1, 1.2, 3.1_
- Files: `src/links.ts`, `src/server.ts`
- `LinkService.create` calls `parseExpiry(input.expiresAt, clock())` and stores the result on the link (1.1).

## Likely files
src/links.ts
test/links.test.ts

## When finished
steno done T2.1
```

## Quick start

Install the CLI (Node ≥ 22; macOS, Linux or Windows). The package is `steno-spec`; the command is `steno`:

```bash
npm install -g steno-spec
```

Then, in your own project:

```bash
steno init --agent claude,codex,opencode
```

Pick your agents from `claude, codex, opencode, antigravity, cursor, copilot, gemini, kiro`
([details](docs/agents.md)). Now open your agent and ask:

```text
> generate steering                       # once per project
> start a spec for <the feature you want>
```

New to steno? [Getting started](docs/getting-started.md) covers every step in detail,
including quick mode, bugfix specs and brainstorming.

## The workflow

```mermaid
flowchart LR
  brief(["brief<br/>(optional)"]) -- "approve" --> req["requirements"]
  req -- "lint · review? → revise" --> req
  req -- "approve" --> design["design"]
  design -- "lint · review? → revise" --> design
  design -- "approve" --> tasks["tasks"]
  tasks -- "lint · review? → revise" --> tasks
  tasks -- "approve" --> exec["execute"]
  exec -- "next task" --> exec
  exec -- "all tasks done" --> done(["done"])
  done -- "drift review?" --> done
```
<!-- npm-text
```text
brief?  →  requirements  →  design     →  tasks      →  execute      →  done
approve    ↺ lint           ↺ lint        ↺ lint        ↺ next task     drift review?
           ↺ review?        ↺ review?     ↺ review?
           approve →        approve →     approve →

↺ sends you back to revise the same stage; only approve moves to the next one.
```
-->

Each phase has a skill that does the writing and a gate that ends it. Lint errors and review
findings send the document back for another pass; a fresh-context review is there when you want
one. Only your approval moves the spec to the next stage.

| Phase | Say to your agent | Skill | CLI underneath |
|---|---|---|---|
| Steering *(once per project)* | "generate steering" | `steno-steer` | `steno steer scan`, `steno steer new --all`, `steno steer lint` |
| 0. Brief *(optional)* | "brainstorm this idea first" | `steno-brainstorm` | `steno new --brief`; EGM `egm-brainstorm` on request |
| 1. Requirements | "start a spec for …" | `steno-spec` | `steno new`, `steno lint requirements` |
| 2. Design | "write the design" | `steno-design` | `steno approve requirements`, `steno lint design` |
| 3. Tasks | "break it into tasks" | `steno-tasks` | `steno approve design`, `steno lint tasks`, `steno trace` |
| 4. Execute | "do the next task" | `steno-run` | `steno next`, `steno ctx`, `steno done` |
| Review *(any time)* | "review the design" | `steno-review` | `steno review --stage …`; EGM `egm-review` with `reviewer: egm` |

Running `steno new` yourself only writes a template. For the full flow (intake, code exploration, outline, EARS criteria, lint, hand-over), ask the agent.

`steno lint` catches what a reviewer would: missing SHALL, vague words, undefined glossary terms, implementation detail in requirements, and requirements with no design or no task.

## Docs

- [Getting started](docs/getting-started.md): install, first spec end to end, quick mode, bugfixes
- [Concepts](docs/concepts.md): phases and gates, IDs, EARS, lint rules, context packets, steering
- [CLI reference](docs/cli.md): every command and flag
- [Agents & integrations](docs/agents.md): supported agents, EGM, coming from Kiro
- [Why steno](docs/why.md): comparison with Kiro, Spec Kit and EGM; where the token savings come from
- [Contributing](CONTRIBUTING.md): build from source, tests, package layout, design principles

## License

[MIT](LICENSE)
