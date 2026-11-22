<p align="center">
  <img src="./assets/steno.svg" alt="steno logo" width="140">
</p>

<h1 align="center">steno spec</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/steno-spec"><img src="https://img.shields.io/npm/v/steno-spec" alt="npm version"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=rzndwb.steno-vscode"><img src="https://vsmarketplacebadges.dev/version-short/rzndwb.steno-vscode.svg?label=VS%20Code" alt="VS Code extension version"></a>
  <a href="https://paseo.sh/plugins/rizanw/steno"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fplugins.paseo.sh%2Fplugins%2Frizanw%2Fsteno.json&query=%24.artifact.version&label=Paseo&prefix=v" alt="Paseo plugin version"></a>
  <a href="https://github.com/rizanw/steno-spec/actions/workflows/ci.yml"><img src="https://github.com/rizanw/steno-spec/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/steno-spec" alt="MIT license"></a>
</p>

<p align="center">
  <strong>Shorthand specs for any coding agent.</strong><br>
  Spec-driven development with a gate at every stage: requirements → design → tasks → execute,
  each one linted and approved by you before the next begins, with a fresh-eyes review whenever you want one.
  Works in Claude Code, Codex, Antigravity, Cursor, Copilot, Gemini CLI, OpenCode and Kiro, and stays cheap on tokens.
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="examples/link-shortener/TUTORIAL.md">Tutorial</a> ·
  <a href="docs/getting-started.md">Getting started</a> ·
  <a href="docs/concepts.md">Concepts</a> ·
  <a href="docs/cli.md">CLI reference</a> ·
  <a href="docs/agents.md">Agents &amp; integrations</a> ·
  <a href="packages/vscode/README.md">VS Code extension</a> ·
  <a href="packages/paseo/README.md">Paseo plugin</a>
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
- **In your editor too.** The [VS Code extension](#in-vs-code) and the [Paseo plugin](#in-paseo) show
  where every spec stands, list each lint finding and give you the approvals.

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

Here is the same CLI run by hand on the finished spec in [examples/link-shortener](./examples/link-shortener):

![steno status, show and ctx running on the link-shortener example](./assets/demo.gif)

The packet is the point. For `T2.1` the agent reads this instead of the whole spec (shortened here;
run `steno ctx T2.1` in the example for the full packet):

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

This spec is real. It lives in [examples/link-shortener](examples/link-shortener), with the code it
produced.

## Quick start

Install the CLI (Node ≥ 22; macOS, Linux or Windows). The package is `steno-spec`; the command is `steno`:

```bash
npm install -g steno-spec
```

Then, in your own project:

```bash
steno init --agent claude,codex,opencode
```

Just trying it out? `npx steno-spec init --agent claude` sets up a project without installing anything.
The skills call `steno` directly, though, so install the CLI before you hand the work to your agent.

Pick your agents from `claude, codex, opencode, antigravity, cursor, copilot, gemini, kiro`
([details](docs/agents.md)). Now open your agent and ask:

```text
> generate steering                       # once per project
> start a spec for <the feature you want>
```

New to steno? The [tutorial](examples/link-shortener/TUTORIAL.md) builds a feature on the example
project in about 30 minutes. [Getting started](docs/getting-started.md) covers every step in detail,
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

## In VS Code

Your agent writes; the sidebar shows where every spec stands.

```bash
code --install-extension rzndwb.steno-vscode
```

```text
SPECS
└─ Link expiry                                          2 tasks left
   ├─ ✓ Requirements
   ├─ ✓ Design
   └─ ✓ Tasks
      ├─ ✓ Expiry data, clock and input parsing
      └─ ○ Service rules
         ├─ ✓ Accept expiresAt in LinkService.create
         ├─ ○ Make LinkService.resolve throw expired            next
         └─ ○ Return LinkView with expired
STEERING
├─ product                                                 always on
└─ api                                                matching files
```

- **Specs and Steering views** for every steno project in the window, each spec with its phase or the tasks left.
- **Lint findings on their line**, as you or your agent edit a spec.
- **Approve a phase, mark a task done or reopen it** from the tree, with a run lens above each open task in `tasks.md`.
- **Hand a task to your agent**: Copilot Chat, Claude Code, Codex, Gemini CLI or OpenCode gets a short
  skill call such as `/steno-run T2.1 link-expiry`, never file contents.

The extension has no model, no chat participant and no network call in it, and it carries its own copy of
steno. More in the [extension's README](packages/vscode/README.md).

## In Paseo

In [Paseo](https://paseo.sh), the steno plugin adds a **steno** tab to each workspace's Explorer, next to
the agents that do the writing.

```bash
paseo plugin install npm:steno-paseo
```

- **Specs and steering** of the workspace, each spec with its documents, tasks and the next task marked.
- **Read a document with its lint problems**, approve a phase, mark a task done or reopen it.
- **Hand work to an agent**: Run Task, Write, Review or Revise puts a short skill call, unsent, in the
  agent you have open, else the most recent one. You read it and press send.
- **New Spec, Generate Steering and Set Up steno** from the panel, and every action in the Command Center.

Like the extension, the plugin has no model and no network call in it, and it carries its own copy of
steno. Your agents still run `steno` from the daemon's `PATH`, so install the CLI there too. More in the
[plugin's README](packages/paseo/README.md).

## Build on steno

Another editor or tool can read specs without parsing Markdown:

- **`steno lsp`** is a language server over stdio: diagnostics, document symbols, task lenses, and requests
  for the spec tree, a task packet, approvals and task state.
- **`--json`** on the commands a client needs returns the same shapes as the server.

Both follow one versioned [JSON contract](docs/json-contract.md). Within a protocol version it only
grows, so a client written today keeps working.

## Docs

- [Tutorial](examples/link-shortener/TUTORIAL.md): build a feature on the example project
- [Getting started](docs/getting-started.md): install, first spec end to end, quick mode, bugfixes
- [Concepts](docs/concepts.md): phases and gates, IDs, EARS, lint rules, context packets, steering
- [CLI reference](docs/cli.md): every command and flag
- [Agents & integrations](docs/agents.md): supported agents, VS Code, Paseo, EGM, coming from Kiro
- [VS Code extension](packages/vscode/README.md): the sidebar, approvals, handing work to your agent
- [Paseo plugin](packages/paseo/README.md): the steno panel in Paseo, approvals, handing work to an agent
- [JSON contract](docs/json-contract.md): every shape `steno lsp` and `--json` return
- [Why steno](docs/why.md): comparison with Kiro, Spec Kit and EGM; where the token savings come from
- [Contributing](CONTRIBUTING.md): build from source, tests, commit messages, design principles

## License

[MIT](LICENSE)
