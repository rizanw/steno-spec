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

The scope names the feature or area, such as `vscode`, `paseo`, `orca`, `lsp-server`, `review` or `deps`. Leave it out when the change is not about one area.

Pull requests are squashed into one commit on merge, so the pull request title is the one that has to follow this format.

Please leave version numbers alone. A release bumps every package together and is published by the Release workflow.

## Layout

| Package | What it is |
|---|---|
| `packages/core` | parsers, EARS lint, traceability, context packets, state, the JSON contract |
| `packages/host` | the Node side a host shares: starting the bundled CLI and language server, one server per folder, the instruction-file watcher and the agents' `steno` check; its pure rules live in `@steno/core/host` |
| `packages/cli` | the `steno` command and the `steno lsp` language server, a thin layer over core; every command takes `--json` |
| `packages/skills` | the seven `steno-*` skills and the reviewer personas |
| `packages/vscode` | the VS Code extension; it bundles its own copy of the CLI and language server |
| `packages/paseo` | the Paseo plugin; it also bundles its own copy of the CLI and language server |
| `packages/orca` | the Orca plugin; it also bundles its own copy of the CLI and language server |

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
7. **No model inside.** The CLI, the language server, the extension and the Paseo and Orca plugins make no model call and no network request.
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
- **The plugin's server** takes core's host rules, `@steno/host` and JSON-RPC from `server/vendor/host.mjs`, one bundle,
  since Paseo installs no dependencies for a plugin.
- **The panel's client** takes core's rules from `client/vendor/host.mjs`, a browser bundle of `@steno/core/host/ui`.
  The build fails if a Node module reaches that bundle, since the panel does not run in Node.

Paseo has no test harness for plugin screens, so check these by hand before a release, in the desktop app and a
narrow window, in a light and a dark theme. The rest is covered by `pnpm test`.

- [ ] Specs, documents and tasks show in the server's order; rows expand and collapse.
- [ ] Every text and icon follows the theme; nothing is black on dark.
- [ ] A row has the "more" button only when an action has no button of its own, and its sheet lists every action, in a narrow window too.
- [ ] A document, a steering file and an instruction file open read-only, with their lint problems and the row's actions.
- [ ] Approve a phase; a phase with a lint error is refused and lists each problem.
- [ ] Mark a task done and reopen it; declining the reopen changes nothing.
- [ ] Hand off to the agent you have open, to the most recent agent, and with no agent (clipboard).
- [ ] Create a feature written by an agent, and a bugfix you write yourself; a taken name is refused.
- [ ] Set up an empty folder; a folder inside a steno project is refused and names it.
- [ ] Every ⌘K item works, and one with nothing to apply to says so.
- [ ] Kill the server five times: the stopped bar shows, and Restart steno Server clears it.
- [ ] With an older `steno` on PATH, the warning bar names both versions and the install command with the plugin's version.

### The Orca plugin

Load the plugin from your clone as a development plugin. Orca runs no build, so build first:

```bash
pnpm build
orca plugin dev load "$PWD/packages/orca"
orca plugin logs local.steno            # a folder you load is local.<id>
```

`pnpm build` is required: Orca runs no build and installs no npm dependencies, so
`packages/orca/scripts/build.mjs` writes everything the plugin runs into `packages/orca/dist/`, which is not
committed:

```text
src/worker.ts              →  dist/worker.mjs     Orca's worker, on Node
src/panel/panel.tsx        →  dist/panel.{js,css} the sidebar page, with Preact bundled in
packages/cli/bin           →  dist/vendor/        the language server and CLI the worker starts
packages/skills/skills     →  dist/skills/        what Set Up steno installs
assets/steno.png           →  dist/icon.png
```

After a change, run `pnpm build`, then `orca plugin dev reload`. `orca plugin types` rewrites the Orca
typings in `packages/orca/types/`, committed so CI needs no Orca install.

#### Releases

The plugin is released with the rest of steno, from the **Release** workflow in the Actions tab (Run
workflow, with the version). Every package on main, `packages/orca/package.json` and `orca-plugin.json` too,
must already carry that version. The `tag` job in `.github/workflows/release.yml` tests main's commit, commits
`dist/` on top of it and tags that commit `v<version>`, so the tag holds the built plugin and main never does. The
`catalog` job then adds a release pointing at that commit to `orca-catalog.json` on main.

Orca's community directory picks up the same tag: it lists the newest `v<major>.<minor>.<patch>` tag of a
repository with the `orca-plugin` topic, finding the plugin through `source.path` in the root
`orca-catalog.json`. Its listing status is at <https://orca.dev/plugins/rizanw/steno-spec>.

If the `catalog` job cannot push to main, list the release by hand from a checkout of main:

```bash
git fetch origin tag v<version>
p=$(mktemp -d); git archive v<version>:packages/orca | tar -x -C "$p"
node packages/orca/scripts/catalog.mjs orca-catalog.json "$p" "$(git rev-parse 'v<version>^{commit}')" rizanw/steno-spec
```

Orca refuses a release whose files hash differently from the catalog's `contentHash`.
`packages/orca/scripts/content-hash.mjs` computes it the way Orca does, and `packages/orca/scripts/catalog.mjs`
builds the release entry `orca plugin release-entry` prints; their tests pin values Orca computed. To compare
with Orca by hand:

```bash
orca plugin inspect packages/orca --json      # contentHash of a folder
node packages/orca/scripts/content-hash.mjs <folder>
```

Hash a folder holding only committed files and `dist/`: Orca hashes every file in it, `node_modules/` too.

#### Listing images

Orca's plugin page shows the icon (`assets/steno.png`), and can show a cover and up to 6 screenshots. Take them in
Orca with the plugin installed, commit them under `packages/orca/images/`, and name them in `orca-plugin.json`:

```json
"cover": { "path": "images/cover.png", "alt": "The steno panel beside a spec in Orca" },
"screenshots": [
  { "path": "images/panel-dark.png", "alt": "The steno panel listing specs and tasks", "caption": "Specs, tasks and lint problems", "theme": "dark" }
]
```

| Image | Format | Size | At most |
|---|---|---|---|
| Cover | PNG, JPEG or WebP, static | at least 800×500, 1600×1000 (16:10) recommended | 1 MB |
| Screenshot | PNG, JPEG or WebP, static | at least 1280×800, 16:10 recommended, up to 2560×1600 | 1.5 MB each, 8 MB for all images together |

`alt` is required (up to 160 characters) and `caption` is optional (up to 120). `theme` shows a screenshot only
with a light or a dark Orca theme. Orca's release entry silently drops an image outside these limits, so
`packages/orca/test/manifest.test.ts` fails on one instead; `orca plugin validate packages/orca` checks the same.

Each catalog release pins every image's SHA-256, and Orca refuses an image whose bytes changed. To change a
picture, commit it under a new file name and leave the old one, so earlier releases still show theirs.

#### Check by hand

Orca draws the panel, so these are checked in Orca before a release, in a light and a dark theme and a
narrow sidebar. `orca plugin shot packages/orca --panel steno --theme dark` saves a PNG of the panel as Orca draws
it. The rest is covered by `pnpm test`.

- [ ] Specs, documents and tasks show in the server's order; rows expand and collapse.
- [ ] Every text and icon follows the theme; nothing is black on dark.
- [ ] A row has the "more" button only when an action has no button of its own, and its menu lists every action.
- [ ] Pressing a document, a steering file or a task opens the file in Orca's editor; a file deleted since the panel drew says so.
- [ ] Approve a phase; a phase with a lint error is refused and lists each problem.
- [ ] Mark a task done and reopen it; declining the reopen changes nothing.
- [ ] Create a feature and a bugfix with **New Spec**; a taken name is refused.
- [ ] Set up an empty folder with **Set Up steno**; the skills land for the agents picked.
- [ ] Hand off with no agent chosen: the pick appears, and the agent picked becomes the worktree's agent.
- [ ] Hand off with an agent chosen: it starts in the focused worktree and the call is typed unsent.
- [ ] Hand off while that agent already runs: the panel offers it and a new one.
- [ ] Hand off when the call cannot be typed: it is on the clipboard and the notification says where to paste it.
- [ ] Switch worktrees: the panel follows the focused one.
- [ ] Kill the language server until it stops: the stopped bar shows, and **Restart** clears it.
- [ ] With an older `steno` on `PATH`, the warning bar names both versions and the install command with the plugin's version.
