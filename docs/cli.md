# CLI reference

This page lists every `steno` command, what it does, and when you would reach for it.

You rarely need to type these yourself. Your coding agent runs them as it works through a spec. They are still worth knowing for three reasons:

- you want to check where a spec stands without asking the agent,
- you want to script steno or run it in CI,
- something looks wrong and you want to see what the agent sees.

New to steno? Read [Getting started](getting-started.md) first. Terms like *phase*, *gate*, *steering* and *context packet* are explained in [Concepts](concepts.md).

## The usual flow at a glance

A gated spec moves through the commands roughly in this order:

```bash
steno init                      # once per project
steno steer scan                # once per project: what steering files does this repo need?
steno new login-with-email      # start a spec; writes requirements.md
steno lint                      # check the wording and IDs
steno approve requirements      # you sign off; the spec moves on to design
# ...the same lint → approve loop for design and tasks...
steno next                      # which task is next?
steno ctx T1                    # everything the agent needs for task T1, and nothing else
steno done T1                   # tick it off
steno review --stage drift      # after the last task: does the code still match the spec?
```

## Options that work everywhere

| Option | What it does |
|---|---|
| `--json` | Prints machine-readable JSON instead of text. Use it in scripts and editor integrations. The output of `list`, `ctx`, `show requirements\|design\|tasks`, `lint`, `steer lint`, `done`, `approve`, `new`, `quick` and `import` follows the [JSON contract](json-contract.md); other commands' JSON can change between releases. A failed command writes one JSON error object, and nothing else, to standard output. |
| `--root <dir>` | Runs against the project in `<dir>`. By default steno walks up from the current folder until it finds a `.steno/` folder. Use `steno --root . init` to set up a project inside a folder that already belongs to another steno project. |
| `--version`, `--help` | Work as you would expect. `--version` also names the JSON contract's protocol version, for example `0.1.1 (protocol 1)`. Every command also accepts `--help`. |

**Picking a spec.** Many commands take an optional `[spec]` argument, the spec's slug (for example `login-with-email`). You can leave it out when there is only one spec, or only one that is not finished yet; steno picks that one. If it can't tell which one you mean, it lists the candidates and asks you to name one.

---

## Setting up a project

### `steno init`

Sets up steno in the current project. It creates the `.steno/` folder, installs the steno skills, and makes them visible to each coding agent you name.

```bash
steno init --agent claude,codex,cursor
```

| Option | Default | What it does |
|---|---|---|
| `-a, --agent <keys>` | `claude,codex` | Which agents to set up, separated by commas. Choose from `claude`, `codex`, `opencode`, `antigravity`, `cursor`, `copilot`, `gemini`, `kiro`. |
| `--copy` | off | Copies the skills into each agent's folder instead of linking to them. steno does this on its own when links aren't allowed, for example on Windows without Developer Mode. |
| `--no-agents-md` | off | Leaves `AGENTS.md` alone. Normally steno adds a short block to it so every agent knows the project uses steno. |

**Good to know**

- You can run it again at any time. It refreshes the skills, keeps your config, and adds any new agents you name to the `agents:` list.
- For Claude Code it also writes steno's reviewers as read-only sub-agents in `.claude/agents/steno-reviewer-*.md`. Earlier copies are replaced.

---

## Steering: project facts every task starts from

Steering files live in `.steno/steering/`. They hold facts about your project: what it is, the tech stack, how the code is laid out, and topic notes such as database or API conventions. steno adds the relevant ones to each task's context, so the agent doesn't rediscover them every time.

Each file has an **inclusion** mode that decides when it is used:

- `always`: added to every task.
- `fileMatch`: added only when the task touches files that match its pattern, such as `src/db/**`.
- `manual`: never added automatically; fetch it with `steno show steering/<file>`.

### `steno steer scan`

Looks at your repo and suggests which steering files to write. It reads only package manifests (like `package.json`) and folder names, never your source code, so it uses no model tokens. Your agent reads the short summary instead of exploring the whole repo.

The output lists the languages, frameworks, package manager, test runner and top-level folders it found, then one line for each suggested file:

```text
  database.md    new     "prisma/**,src/db/**"
                          deps: prisma, @prisma/client; dirs: prisma, src/db
                          read: prisma/schema.prisma, prisma/migrations/, src/db/
```

That entry says: write a `database.md`, use it for files under `prisma/` or `src/db/`, here is the evidence, and here are the few files worth reading before writing it.

**What it suggests**

- **Always:** the core three, `product.md`, `tech.md` and `structure.md`, with inclusion `always`.
- **Only with evidence:** topic files, with inclusion `fileMatch`. The topics are `database`, `api`, `auth`, `i18n`, `ui`, `testing`, `infra`, `ci`, `messaging` and `domain`. For example, `database` needs an ORM, a migrations folder or `.sql` files; `api` needs a routes or api folder, or an OpenAPI or GraphQL schema.

Each topic suggestion is either **strong** (a matching dependency, or at least three files behind it) or **weak** (only one or two files, like a lone `vercel.json`). Weak suggestions are listed so you can decide, but `steer new --all` skips them.

**On a brand-new project.** If the folder has no manifest and fewer than three source files, the scan says the project is "greenfield" and suggests nothing. Steering records facts about code that exists, so there is nothing to record yet. Start with a brief or a spec instead, and scan again once there is some code.

> Contributors: each topic detector is one entry in `packages/core/src/steer.ts`.

### `steno steer new [file]`

Writes an empty steering file with the right frontmatter and section headings, ready to fill in.

```bash
steno steer new --all            # the core three plus every strong suggestion
steno steer new database         # just one file (".md" is optional)
steno steer new billing -m "src/billing/**"
```

You can use any kebab-case name. Known topics such as `database` get their own headings; any other name gets a generic layout.

| Option | What it does |
|---|---|
| `--all` | Writes the core three and every strong suggestion from `scan` that doesn't exist yet. |
| `--weak` | Use with `--all` to also write the weak suggestions. |
| `-m, --match <globs>` | Sets the file pattern, as a comma-separated list of globs. Implies inclusion `fileMatch`. |
| `-i, --inclusion <mode>` | `always`, `fileMatch` or `manual`. Defaults to what `scan` suggests. |
| `-f, --force` | Overwrites a file that already exists. With `--all`, also writes files in a greenfield folder. |

### `steno steer template <file>`

Prints the empty layout that `steer new` would write, without writing anything. Useful when a file already exists and you want to see its expected shape before rewriting it.

### `steno steer schema`

Prints your database schema in a compact form: one line per table, with its key columns and foreign keys, followed by the enums and a summary of which tables point at which. It reads schema files, not a live database, and uses no model tokens.

```text
journal_entry_lines(id): →journal_entries, →accounts, entry_type:entry_type, amount:num(15,2), created_at
```

Read that as: table `journal_entry_lines`, primary key `id`, foreign keys to `journal_entries` and `accounts`, then the remaining columns with their types.

The `steno-steer` skill pastes this output into `database.md` inside a ```` ```schema ```` block. That way, any task that touches the data layer sees the real tables without reading every migration.

**Where it looks.** steno tries these sources in order and uses the first one it finds:

1. **Prisma:** `schema.prisma`.
2. **drizzle-kit snapshots:** the latest `meta/*_snapshot.json`.
3. **SQL migrations** in `migrations/`, `db/`, `supabase/` or `drizzle/`, replayed in order. It understands `CREATE TABLE`, `ALTER TABLE ... ADD / DROP / RENAME COLUMN`, `ALTER COLUMN ... SET NOT NULL` and `TYPE`, `ADD PRIMARY KEY`, `REFERENCES`, `CREATE TYPE ... AS ENUM` and `ALTER TYPE ... ADD VALUE`.
4. **Drizzle TypeScript:** `pgTable()`, `sqliteTable()` and `mysqlTable()` calls, for projects that push schema changes without generating migrations. Parsed on a best-effort basis.
5. **SQLAlchemy models in Python:** declarative classes with `__tablename__` and `mapped_column` or `Column`, including the mixins and `Enum` classes they import, `__table_args__` constraints, Core `Table(...)`, Flask-SQLAlchemy `db.Model` and SQLModel `table=True` classes. Alembic migrations are not replayed, because the models already describe the current schema.

| Option | What it does |
|---|---|
| `--full` | Keeps `created_at` / `updated_at` columns and Prisma back-relations, which are hidden by default to save space. |

### `steno steer lint`

Checks your steering files for problems. It exits with code 2 if it finds any errors; warnings alone don't change the exit code.

| Rule | Level | What it catches | How to fix it |
|---|---|---|---|
| `steering/inclusion` | error | `inclusion` isn't `always`, `fileMatch` or `manual`. | Use one of the three. |
| `steering/pattern` | error | A `fileMatch` file has no `fileMatchPattern`. | Add a pattern, or switch the file to `always` or `manual`. |
| `steering/budget` | error | The `always` files together exceed `steeringBudget` (4000 tokens by default). They go into every task, so they must stay small. | Shorten them, or move some to `fileMatch`. |
| `steering/no-match` | warn | The pattern matches no file in the repo. | Check the glob for typos. |
| `steering/thin` | warn | The file is too short to be useful: under 1200 bytes for `product.md` or `tech.md`, 2000 for `structure.md`, 350 for a topic file. | Add specific facts. |
| `steering/shape` | warn | `structure.md` has no folder tree or table, or `tech.md` has no command block. | Add the missing tree, table or commands. |
| `steering/packed` | warn | Several facts crammed into one bullet, separated by semicolons. | Give each fact its own bullet. |
| `steering/size` | warn | The file is over 4 KB (6 KB for `database.md`, which also carries the schema). | Trim it, or split a topic into its own file. |
| `steering/placeholder` | warn | Template text like `<template placeholder>` is still there. | Replace it with real content. |
| `steering/code-dump` | warn | A code block longer than 16 lines. Blocks tagged ```` ```schema ```` are exempt. | Name the file instead, so steno can fetch it when a task needs it. |

### `steno steer list`

Shows one row per steering file: its inclusion mode, its estimated size in tokens, and how many repo files its pattern matches. The last line compares the total size of the `always` files with the budget.

---

## Creating specs

A spec is a folder in `.steno/specs/<slug>/` holding the requirements, design and tasks for one feature or bugfix.

### `steno new <slug>`

Starts a new **gated** spec, where you approve each document before the next one begins. It writes `requirements.md` (or `bugfix.md`) and `spec.yaml`, the file where steno tracks the spec's phase.

```bash
steno new wallet-owner-filter
steno new fix-login-timeout --bugfix
```

The slug must be kebab-case: lowercase words joined by hyphens.

| Option | What it does |
|---|---|
| `-t, --title <title>` | A readable title. Defaults to the slug with spaces instead of hyphens. |
| `--bugfix` | Writes `bugfix.md` instead, with sections for Current, Expected and Unchanged Behavior. |
| `--brief` | Starts with a `brief.md` for brainstorming the idea first. `requirements.md` is written later, once you approve the brief. |

### `steno quick <slug>`

Starts a **quick** spec: requirements, design and tasks are all written at once, with no approval steps, and the spec goes straight to the execute phase. Use it for small changes you already understand well. Takes `-t, --title` like `steno new`.

### `steno import <dir> [slug]`

Brings in a spec written in Kiro's format:

```bash
steno import .kiro/specs/login
```

The slug defaults to the folder name. If that name isn't kebab-case, pass a slug yourself.

What it does:

- copies every `.md` file,
- rewrites requirement headings into steno's `## R1 Title` form and adds the `R` prefix to task references,
- marks every document that already exists as approved,
- sets the phase based on which documents are there.

### `steno list`

Lists all specs with their phase, their mode (gated or quick) and their kind (feature or bugfix). A spec steno cannot use, for example because a file is not UTF-8 text, is listed as `unreadable` or `unsupported`.

With `--json` it returns the spec tree of the [JSON contract](json-contract.md#spectree): every spec with its approvals, task counts and next task, and every steering file. A spec folder without a `spec.yaml` gets one written, with today's date for each approval its documents imply.

---

## Checking and approving

### `steno lint [requirements|design|tasks] [spec]`

Checks a spec document for problems a rule can catch: vague wording, malformed acceptance criteria, broken or missing IDs, and requirements that no design section or task covers. Leave out the stage to check every document that exists. Exits with code 2 if there are errors.

```text
W requirements.md:21 R1.3  vague wording: fast — make it testable  [ears/vague]
0 errors, 1 warning
```

Each line shows the level (`E` for error, `W` for warning), the file and line, the item's ID, the problem, and the rule name in brackets. The full list of rules is in [Concepts](concepts.md#lint-rules).

### `steno approve <brief|requirements|design|tasks> [spec]`

Records that a person has reviewed and accepted a document, and moves the spec on to the next phase.

```bash
steno approve requirements
```

**Good to know**

- You can only approve the current phase, so no stage can be skipped.
- Approval is refused while `steno lint` reports errors. Add `-f, --force` to approve anyway.
- Quick specs have no approval steps.
- Approving doesn't create the next file. The next phase's skill does that with `steno scaffold` when it starts.

### `steno scaffold [spec]`

Writes the empty template for the current phase (`requirements.md`, `bugfix.md`, `design.md` or `tasks.md`) if it doesn't exist yet. If it already exists, nothing happens, so it is safe to run more than once.

Each phase skill runs this as its first step. A file therefore only appears once someone has actually started that phase; until then, `steno status` shows the phase as `not started`.

---

## Seeing where things stand

### `steno status [spec]`

A one-screen summary: the current phase, which stages are approved, how many requirements and tasks there are, the lint totals, which files changed since you last ran `status`, and what to do next.

The changed-files list lets an agent re-read only what moved. `steno status --json` reports the same information but doesn't reset the "changed since last time" marker.

### `steno show <id> [spec]`

Prints a single item, so neither you nor the agent has to open the whole file.

```bash
steno show R1.2
steno show D-auth
steno show steering/tech
```

| You pass | You get |
|---|---|
| `R1` | requirement 1, with its user story and all its acceptance criteria |
| `R1.2` | acceptance criterion 2 of requirement 1 |
| `D-auth` | the design section whose heading is tagged `{#D-auth}` |
| `T2`, `T2.1` | a task with its requirement and design links and its sub-tasks |
| `requirements`, `design`, `tasks` | a short outline of that document |
| `intro`, `glossary`, `brief` | that part of the spec |
| `steering/<file>` | a steering file |

### `steno trace [spec]`

Shows how the pieces connect: for each requirement, which design sections and tasks cover it, and how many of those tasks are done. It's a quick way to spot a requirement nobody is building.

| Option | What it does |
|---|---|
| `-c, --criteria` | Shows one row per acceptance criterion instead, and flags any criterion that no task covers or that more than two tasks cover. |

---

## Building, one task at a time

### `steno next [spec]`

Prints the next unfinished task and the command to get its context. Tasks marked `*` are optional and skipped unless you add `--optional`.

### `steno ctx <task> [spec]`

Builds the **context packet** for one task: the task itself, the acceptance criteria and design sections it refers to, the files it will likely touch, and any steering files that apply. The agent reads this packet instead of the whole spec, which keeps token use low. See [Concepts](concepts.md#context-packets) for exactly what goes in.

```bash
steno ctx T3
steno ctx T3 --budget 3000
```

| Option | Default | What it does |
|---|---|---|
| `-b, --budget <tokens>` | `ctxBudget` in `.steno/config.yaml` (1500) | The maximum packet size in tokens. If something has to be cut, the packet's header names it, so the agent can fetch it with `steno show`. |

### `steno done <task> [spec]`

Ticks a task off in `tasks.md` and prints the next one. When every sub-task of a task is done, the parent is ticked off automatically. Use `--undo` to reopen a task.

---

## Getting a second opinion

### `steno review [spec]`

Prepares a **review packet**: a single file a reviewer can judge on its own, without having seen your conversation with the agent. A reviewer without that history doesn't share the agent's assumptions, so it is more likely to notice gaps and contradictions.

The packet is saved as `.steno/specs/<slug>/reviews/<date>-<stage>-packet.md`. It contains the document under review, an outline of the requirements, the traceability table, and a list of source files the design mentions. Save the reviewer's findings next to it as `<date>-<stage>.md`.

A review is counted in **rounds**, so that it ends. The first run for a stage is a full review. Each later run is a verify round: the packet lists the criteria, sections or tasks that were added, changed or removed since the previous round and tells reviewers to report only problems in or caused by those, plus anything high. The command prints the round and the size of the document, and warns when the document has grown by more than a quarter since round 1 or when you go past two rounds. If the document has not changed since the last round, no packet is written.

Decisions you have already taken go in `reviews/<stage>-decisions.md`, one line each. The packet shows them to reviewers under "Decided (do not reopen)", marked as a record rather than instructions: reviewers only stop raising the ids listed there. The round history is kept in `reviews/<stage>-rounds.json`, and the document as each round reviewed it in `reviews/<stage>-round<N>.md`, so text that a review cut or moved to another spec can be recovered. The `drift` stage has no rounds.

```bash
steno review --stage design
steno review --stage drift      # after building: does the code still match the spec?
```

| Option | Default | What it does |
|---|---|---|
| `-s, --stage <stage>` | `requirements` | Which stage to review: `requirements`, `design`, `tasks`, or `drift`, which compares the finished code against the spec. |
| `--full` | off | Forget the earlier rounds and start a new full review at round 1. |

In practice the `steno-review` skill runs this for you and hands the packet to the reviewers.

---

## Exit codes

Useful when you run steno in scripts or CI:

| Code | Meaning |
|---|---|
| `0` | Success. Lint warnings still count as success. |
| `1` | The command failed, or was called incorrectly (for example, an unknown option or a missing spec). |
| `2` | `steno lint` or `steno steer lint` found errors, or `steno approve` was blocked by lint errors. |
