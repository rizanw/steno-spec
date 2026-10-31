# Why steno

How steno relates to the tools it borrows from, and where its token savings come from.

## Compared with

| | What it gives | What steno takes from it | What steno adds |
|---|---|---|---|
| [Kiro](https://kiro.dev) specs | requirements / design / tasks, EARS, gated phases | the file format and the flow | runs in any agent, not one IDE |
| [Spec Kit](https://github.com/github/spec-kit) | agent-agnostic spec-driven development | portability | thin skills and per-task packets instead of whole-spec prompts |
| [EGM](https://github.com/google/elephant-goldfish-model) | fresh-context brainstorm and review | the fresh-context idea; optional hand-off with `reviewer: egm` | requirements, tasks, execution, and ID traceability |

## Token budget, by design

- Each skill is 20–50 lines; `pnpm lint:skills` fails any `SKILL.md` over 80 lines or 1200 tokens.
- Templates, validation, traceability and task state live in the CLI, at zero tokens.
- Agents fetch by stable id (`steno show R1.2`, `D-auth`, `T2.1`), never `cat` the whole spec.
- Steering files enter a packet only when their `fileMatchPattern` matches the task's files, and
  `steno steer lint` caps the `always` ones together (`steeringBudget`, 4000 tokens by default, about 2% of
  a 200k window; Kiro's three files cost about 1900) and flags files too thin to brief anyone.
- `steno steer scan` suggests steering files from manifests and folders at zero tokens: the core
  `product`, `tech`, `structure`, plus `database`, `api`, `auth`, `i18n`, `ui`, `testing`, `infra`,
  `ci`, `messaging` or `domain` only when the repo shows evidence for them.
