# Contributing

Issues and pull requests are welcome.

## Build from source

Needs Node ≥ 22 and pnpm.

```bash
git clone https://github.com/rizanw/steno-spec.git
```

```bash
cd steno && pnpm install && pnpm build
```

To use your local build as the `steno` command:

```bash
(cd packages/cli && npm link)
```

## Before you open a pull request

```bash
pnpm test && pnpm lint:skills
```

## Layout

| Package | What it is |
|---|---|
| `packages/core` | parsers, EARS lint, traceability, context packets, state |
| `packages/cli` | the `steno` command, a thin wrapper over core; every command takes `--json` |
| `packages/skills` | the seven `steno-*` skills and the reviewer personas |

Adding an agent is one line in [`packages/core/src/agents.ts`](packages/core/src/agents.ts).

## Design principles

Changes are easier to accept when they keep to these:

1. **The CLI thinks, the agent reads a slice.** Scaffolding, validation, traceability, state and context assembly belong in the CLI, where they cost zero tokens. The agent only sees a compact packet.
2. **Stable IDs everywhere.** `R1`, `R1.2`, `D-auth`, `T3.1`. Agents reference by ID instead of re-quoting prose.
3. **Thin skills.** Every `SKILL.md` stays under 80 lines and 1200 tokens (`pnpm lint:skills`), is written in outcome terms, and never names a harness's tools: "run `steno next`", not "use the Edit tool". Detail goes in `steno <cmd> --help` or a file the skill loads only when needed.
4. **One canonical skills folder.** Skills live in `.agents/skills/`; `steno init` links or copies them into each agent's own path. No per-agent prompt forks.
5. **Review never runs in the context that wrote the document.** Reviewers see only the `steno review` packet. If the harness cannot start a sub-agent, the skill stops instead.
6. **Core is a library.** Anything that needs spec data calls core or `steno --json`; nothing re-implements parsing.

## Trying a change end to end

[examples/link-shortener](examples/link-shortener) is a small project with a finished spec. After `pnpm build`, run
`steno status`, `steno lint` and `steno ctx T2.2` inside it to see the effect of a change on real spec files.
