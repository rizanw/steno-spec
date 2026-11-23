# steno

Spec-driven development for any coding agent, cheap on tokens. Work moves through requirements → design → tasks → execute as plain Markdown, each stage linted and approved by a person before the next begins. The `steno` CLI has no model in it: it scaffolds, lints, traces and hands the agent a small packet per task instead of the whole spec.

**Read [CONTRIBUTING.md](CONTRIBUTING.md) for the complete guidelines.**

## Commands

```bash
pnpm install                          # Node ≥ 22, pnpm version pinned in package.json
pnpm build                            # MUST run before pnpm test (tests start the built CLI)
pnpm test                             # MUST pass before committing (vitest: core, cli, vscode, paseo, orca)
pnpm lint:skills                      # MUST pass: each SKILL.md ≤ 80 lines and ≤ 1200 tokens
pnpm contract:record                  # after changing a JSON shape
pnpm --filter steno-vscode test:e2e   # extension tests inside a real VS Code
```

## File structure

```text
packages/core/src/<module>.ts          → All spec logic: parse, lint, trace, packets, state
packages/core/test/<module>.test.ts    → Its test, same name
packages/core/src/contract.ts          → Every JSON shape and error code (CONTRACT)
packages/cli/src/commands/*.ts         → Command wiring only; logic lives in core
packages/cli/src/lsp/                  → The `steno lsp` language server
packages/cli/test/cli.test.ts          → Flags, exit codes, --json output
packages/host/src/                     → What hosts share on Node: bundled programs, server pool, watcher (pure rules: core/src/host/)
packages/skills/skills/<name>/SKILL.md → The skills (edit here, never an installed copy)
packages/vscode/src/                   → The VS Code extension
packages/paseo/{client,server,shared}/ → The Paseo plugin (client panel, daemon side, shared contracts)
packages/orca/src/                     → The Orca plugin (worker on Node, sidebar panel, messages between them)
docs/                                  → User docs (update with any visible change)
examples/link-shortener/               → A finished spec to try a change on
```

Generated, never edit: `packages/cli/{bin,skills}/`, `packages/cli/{README,LICENSE,JSON-CONTRACT}.md`, `packages/vscode/{dist,skills,media}/`, `packages/vscode/LICENSE`, `packages/paseo/server/vendor/`, `packages/paseo/client/vendor/`, `packages/paseo/media/`, `packages/orca/dist/`, `packages/orca/types/` (written by `orca plugin types`).

## Code patterns

```ts
// ✅ CORRECT
import { applyTaskChange, StenoError } from '@steno/core';   // spec data comes from core
import { out, resolveSpec } from '../io.js';                 // relative imports carry .js
const { entry, snap } = resolveSpec(ctx, { kind: 'done', spec: name, task: id });  // every spec command is checked first
out(ctx, result, `done ${id}`);                              // one call serves text and --json
throw new StenoError('not-found', `no task ${id}`, { spec: name });  // a code from the contract
// A missing folder is left to the command, so `steno init` can still run here.

// ❌ WRONG
readFileSync(join(root, '.steno/specs', name, 'tasks.md'));  // reading spec Markdown outside core
import { out } from '../io';                                 // missing .js
console.log(JSON.stringify(result));                         // bypasses out(), breaks --json
process.exit(1);                                             // main.ts sets the exit code
```

Skills are written the same way for every agent:

```text
✅ Run `steno next`, then `steno ctx <task>`.
❌ Use the Read tool to open tasks.md.
```

Style: the source is dense on purpose (short functions on one line, several interface fields per line). Match the file you edit and leave untouched code unformatted.

## Comments

A comment is for whoever reads this file a year from now, with no spec, task list or pull request open beside it. Write what the code cannot say itself: why it is this way, what breaks if it changes.

```ts
// ✅ CORRECT
// Starting a process takes about a second on Windows, so the default 5 s limit is too short here.
/** Load both snapshots from the current files and open texts; says whether the set-up state flipped. */
it('refuses a task change while tasks.md has unsaved edits', () => {

// ❌ WRONG
// R4.1: refuse while unsaved                      // a requirement, design or task ID (R4.1, D-trust, T2.3)
/** Returns the Task_Packet for a Spec_Document */  // a glossary spelling; write "task packet", "spec document"
// Added for T3.2, see PR #12                      // a task, pull request, issue or review finding
// Fixed: used to read from disk here              // history; git already keeps it
// New helper for the watcher                      // "new" stops being true after the merge
it('R2.3: unsaved edits', () => {                  // the same rules apply to test names
```

The spec you work from is scaffolding. Its IDs and term spellings belong in `.steno/specs/`, the commit message and the pull request, never in the source. Before you finish, read your diff once and remove any comment or test name that only makes sense with the spec in hand.

## Testing

- Behaviour is tested in core, by calling the function. A CLI test covers only flags, exit codes and `--json` shape.
- A new lint rule needs one failing and one passing case that assert the rule id, such as `ears/vague`.
- Tests build their project in a temp directory (`project(files)` in each test file), never in the repository tree.
- CI runs macOS, Linux and Windows: build paths with `join`, and do not rely on symlinks or a shell.

## Workflow

1. Research: find the core module that owns the behaviour and read its test.
2. Change: logic in `packages/core`, wiring in `packages/cli`, `packages/vscode`, `packages/paseo` or `packages/orca`.
3. Test: add cases beside the existing ones.
4. Document: `docs/` and the command's `--help`.
5. Verify: `pnpm build && pnpm test && pnpm lint:skills`.
6. Commit: see *Commit titles*.

## Commit titles

- Conventional Commits: `feat(vscode): add steering view`, `fix: accept IF without THEN`, `docs: explain quick mode`.
- Types: `feat`, `fix`, `docs`, `test`, `ci`, `build`, `chore`. The scope is optional and names the feature or area, such as `vscode`, `paseo`, `orca`, `lsp-server`, `review`, `deps`.
- One topic per pull request. Anything larger than a small fix starts as an issue.
- Do not bump versions, tag or publish. The maintainer cuts releases.

## Critical rules

1. Nothing outside `packages/core` parses spec Markdown.
2. No model call, tokenizer library or network request in the CLI, the server, the extension, the Paseo plugin or the Orca plugin.
3. Within one protocol version the JSON contract only grows: no field removed, renamed or retyped, no new error code. A breaking change raises `PROTOCOL_VERSION`.
4. The CLI and the language server return the same tree, diagnostics and packet for the same project.
5. A skill never names one harness's tools and stays within the size limit.
6. A spec's phase advances only through `steno approve`. The agent does not approve.
7. Fix a failing check; do not skip or loosen it.
8. No spec IDs, glossary spellings, task or pull request references in comments or test names.

## Philosophy

- **Spec first, gated.** Requirements, then design, then tasks, then code. A person approves each stage.
- **Any agent.** Plain Markdown and one skills folder. No feature may work in only one agent.
- **Cheap on tokens.** If the CLI can do it, the agent does not. A task gets a packet, never the whole spec.
- **Checked, not trusted.** Lint gates every stage, every task traces to a requirement, and review runs in a fresh context that never saw the authoring conversation.

## Troubleshooting

- CLI or server tests fail at startup? Run `pnpm build`.
- `contract.test.ts` fails? Run `pnpm contract:record` and update `docs/json-contract.md`. If it refuses, the change is breaking.
- `pnpm lint:skills` fails? Move detail from the skill into `steno <cmd> --help`.

<!-- steno:start -->
## Spec-driven work (steno)
Specs live in `.steno/specs/<slug>/` (requirements.md, design.md, tasks.md). Use the `steno-*` skills in `.agents/skills/`.
Never read a whole spec: run `steno status`, `steno next`, `steno ctx <task>`, `steno show <id>`.
<!-- steno:end -->

`.steno/` and `.agents/` are local and not committed. After `pnpm build`, run `steno init` in your clone to get the skills.
