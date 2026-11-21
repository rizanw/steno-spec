# Contributing

Issues and pull requests are welcome.

## How this project works

PRs are welcome, at your own pace. Replies can take a while, so a quiet PR or issue isn't a rejection.

For anything bigger than a small fix, open an issue first so we can agree on the approach before you write the code. Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md). Report security problems privately, as described in [SECURITY.md](SECURITY.md).

## Build from source

Needs Node ≥ 22 and pnpm.

```bash
git clone https://github.com/rizanw/steno-spec.git
```

```bash
cd steno-spec && pnpm install && pnpm build
```

To use your local build as the `steno` command:

```bash
(cd packages/cli && npm link)
```

## Before you open a pull request

```bash
pnpm build && pnpm test && pnpm lint:skills
```

The build comes first because the CLI and language server tests start the built `steno` command; against a stale build they fail or test old code.

Keep a pull request to one topic, with its tests and docs in the same change. A fix and an unrelated cleanup are easier to review, and to revert, as two pull requests.

## Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org): a type, an optional scope in brackets, then what the change does.

```text
feat(vscode): add steering view
fix: accept IF without THEN in a criterion
docs: explain quick mode
```

| Type | Use it for |
|---|---|
| `feat` | something a user can now do |
| `fix` | a bug that is gone |
| `docs` | documentation only |
| `test` | tests only |
| `ci`, `build`, `chore` | workflows, build scripts, dependencies and housekeeping |

The scope names the feature or area, such as `vscode`, `lsp-server`, `review` or `deps`. Leave it out when the change is not about one area.

Pull requests are squashed into one commit on merge, so the pull request title is the one that has to follow this format.

Please leave version numbers alone. A release bumps every package together and is published from a tag.

## Layout

| Package | What it is |
|---|---|
| `packages/core` | parsers, EARS lint, traceability, context packets, state, the JSON contract |
| `packages/cli` | the `steno` command and the `steno lsp` language server, a thin layer over core; every command takes `--json` |
| `packages/skills` | the seven `steno-*` skills and the reviewer personas |
| `packages/vscode` | the VS Code extension; it bundles its own copy of the CLI and language server |

Adding an agent is one line in [`packages/core/src/agents.ts`](packages/core/src/agents.ts).

## What steno promises

Every change is weighed against these four:

- **Spec first, gated.** Requirements, then design, then tasks, then code. A person approves each stage.
- **Any agent.** Plain Markdown and one skills folder. No feature may work in only one agent.
- **Cheap on tokens.** If the CLI can do it, the agent does not. A task gets a packet, never the whole spec.
- **Checked, not trusted.** Lint gates every stage, every task traces to a requirement, and review runs in a fresh context that never saw the authoring conversation.

## Design principles

These are the rules in the code that keep those promises. Changes are easier to accept when they keep to them:

1. **The CLI thinks, the agent reads a slice.** Scaffolding, validation, traceability, state and context assembly belong in the CLI, where they cost zero tokens. The agent only sees a compact packet.
2. **Stable IDs everywhere.** `R1`, `R1.2`, `D-auth`, `T3.1`. Agents reference by ID instead of re-quoting prose.
3. **Thin skills.** Every `SKILL.md` stays under 80 lines and 1200 tokens (`pnpm lint:skills`), is written in outcome terms, and never names a harness's tools: "run `steno next`", not "use the Edit tool". Detail goes in `steno <cmd> --help` or a file the skill loads only when needed.
4. **One canonical skills folder.** Skills live in `.agents/skills/`; `steno init` links or copies them into each agent's own path. No per-agent prompt forks.
5. **Review never runs in the context that wrote the document.** Reviewers see only the `steno review` packet. If the harness cannot start a sub-agent, the skill stops instead.
6. **Core is a library.** Anything that needs spec data calls core or `steno --json`; nothing re-implements parsing.
7. **No model inside.** The CLI, the language server and the extension make no model call and no network request.
8. **The JSON contract only grows.** Within one protocol version no field is removed, renamed or retyped and no error code is added, so a client written today keeps working.

## Code style

The source is dense on purpose: short functions on one line, several fields of an interface on one line, chained expressions instead of temporary variables. More code fits on a screen, which keeps each module readable in one pass, by a person or by an agent reading it into context.

Please match the style of the file you are editing, and don't reformat code you are not otherwise changing. Prefer clarity where the two pull apart: if a one-liner needs a second read to follow, split it. Comments explain why, not what.

## Trying a change end to end

[examples/link-shortener](examples/link-shortener) is a small project with a finished spec. After `pnpm build`, run
`steno status`, `steno lint` and `steno ctx T2.2` inside it to see the effect of a change on real spec files.

### The JSON contract

The shapes that `--json` and the language server return are defined once, as `CONTRACT` in
[`packages/core/src/contract.ts`](packages/core/src/contract.ts), and recorded in a fixture the tests compare against.
After changing a shape, record it again and update [docs/json-contract.md](docs/json-contract.md):

```bash
pnpm contract:record
```

The command refuses a change that would break existing clients. That needs a new protocol version, so open an issue first.

### The VS Code extension

To debug, open the repository in VS Code and press F5 to start an Extension Development Host. After a change,
run `pnpm build`, then **Developer: Reload Window** in the host window.

To try the packaged extension in your own editor, build the `.vsix` and install it over the old one:

```bash
pnpm build
cd packages/vscode
rm -f steno-vscode-*.vsix
pnpm package
code --uninstall-extension rzndwb.steno-vscode
code --install-extension steno-vscode-*.vsix --force
```

Then run **Developer: Reload Window**. A rebuild keeps the same version number, so if the old behaviour is
still there, quit VS Code fully and open it again.

The end-to-end tests run the extension inside a real VS Code: `pnpm build`, then `pnpm --filter steno-vscode test:e2e`.
Set `VSCODE_VERSION=1.125.0` to run them against the oldest supported release.

### The Paseo plugin

Install the plugin from your clone instead of npm. Paseo 0.16 or later needs plugins turned on
(Settings → Plugins → Enable plugins):

```bash
pnpm build
paseo plugin install "$PWD/packages/paseo"
paseo plugin logs steno
```

`pnpm build` is required: it generates the programs the plugin runs. After a change, run `pnpm build`, then
`paseo plugin reload steno`. If you installed from npm before, `paseo plugin remove steno` first.

Paseo loads a plugin's server entry with no file path and installs no npm dependencies for it, so the plugin
cannot read its programs from its own folder. Instead:

```text
pnpm build      packages/cli/bin + packages/skills  →  embedded as text in server/vendor/
plugin start    embedded text  →  ~/.paseo/plugin-data/steno/<hash>/{vendor,skills}/
                steno-cli.mjs and steno-lsp.mjs started from there
```

- **`<hash>`** is taken from the embedded programs and skills. A rebuilt plugin unpacks into a new folder, so it
  never runs programs left by an older build. Later starts of the same build reuse the folder.
- **Without `PASEO_HOME`**, the programs go to `steno-paseo/` in the OS temp folder.
- `server/vendor/`, `client/vendor/` and `media/` are generated by `scripts/build.mjs`. Change the source and build again.

Paseo has no test harness for plugin screens, so check these by hand before a release, in the desktop app and a
narrow window, in a light and a dark theme. The rest is covered by `pnpm test`.

- [ ] Specs, documents and tasks show in the server's order; rows expand and collapse.
- [ ] Every text and icon follows the theme; nothing is black on dark.
- [ ] In a narrow window, the "more" button on each row offers the same actions as on desktop.
- [ ] A document, a steering file and an instruction file open read-only, with their lint problems and the row's actions.
- [ ] Approve a phase; a phase with a lint error is refused and lists each problem.
- [ ] Mark a task done and reopen it; declining the reopen changes nothing.
- [ ] Hand off to the agent you have open, to the most recent agent, and with no agent (clipboard).
- [ ] Create a feature written by an agent, and a bugfix you write yourself; a taken name is refused.
- [ ] Set up an empty folder; a folder inside a steno project is refused and names it.
- [ ] Every ⌘K item works, and one with nothing to apply to says so.
- [ ] Kill the server five times: the stopped bar shows, and Restart steno Server clears it.
- [ ] With a `steno` of another version on PATH, the warning bar names the install command.
