<p align="center">
  <img src="https://raw.githubusercontent.com/rizanw/steno-spec/main/assets/steno.png" alt="steno logo" width="140">
</p>

<h1 align="center">steno spec for Orca</h1>

<p align="center">
  <strong>Shorthand specs for any coding agent.</strong><br>
  Plan a feature before you build it: requirements, then design, then tasks, then code. Your agent
  writes each stage in Orca, and the steno panel shows where every spec stands, lists each lint
  problem and gives you the approvals. It has no model in it and spends no tokens.
</p>

---

```bash
orca plugin catalog add rizanw/steno-spec
orca plugin install rizanw.steno
npm install -g steno-spec               # the steno your agents run
```

Both Orca commands stop once to ask for your approval. **[Install and use it](../../docs/orca.md)** covers
that, the panel, handing work to an agent, updates and troubleshooting.

## Build from source

```bash
pnpm build
orca plugin dev load "$PWD/packages/orca"
orca plugin logs local.steno            # a folder you load is local.<id>
```

`pnpm build` is required: Orca runs no build and installs no npm dependencies, so `scripts/build.mjs` writes
everything the plugin runs into `dist/`, which is not committed:

```text
src/worker.ts              →  dist/worker.mjs     Orca's worker, on Node
src/panel/panel.tsx        →  dist/panel.{js,css} the sidebar page, with Preact bundled in
packages/cli/bin           →  dist/vendor/        the language server and CLI the worker starts
packages/skills/skills     →  dist/skills/        what Set Up steno installs
assets/steno.png           →  dist/icon.png
```

After a change, run `pnpm build`, then `orca plugin dev reload`. `orca plugin types` rewrites the Orca
typings in `types/`, committed so CI needs no Orca install.

## Releases

The plugin is released with the rest of steno, from the **Release** workflow in the Actions tab (Run
workflow, with the version). Every package on main, `packages/orca/package.json` and `orca-plugin.json` too,
must already carry that version. The workflow's `tag` job tests main's commit, commits `dist/` on top of it and
tags that commit `v<version>`, so the tag holds the built plugin and main never does. The `catalog` job then
adds a release pointing at that commit to `orca-catalog.json` on main.

Orca's community directory picks up the same tag: it lists the newest `v<major>.<minor>.<patch>` tag of a
repository with the `orca-plugin` topic, finding the plugin through `source.path` in the root
`orca-catalog.json`. Its listing status is at <https://orca.dev/plugins/rizanw/steno-spec>.

If the `catalog` job cannot push to main, list the release by hand from a checkout of main:

```bash
git fetch origin tag v<version>
p=$(mktemp -d); git archive v<version>:packages/orca | tar -x -C "$p"
node packages/orca/scripts/catalog.mjs orca-catalog.json "$p" "$(git rev-parse 'v<version>^{commit}')" rizanw/steno-spec
```

Orca refuses a release whose files hash differently from the catalog's `contentHash`. `scripts/content-hash.mjs`
computes it the way Orca does, and `scripts/catalog.mjs` builds the release entry `orca plugin release-entry`
prints; their tests pin values Orca computed. To compare with Orca by hand:

```bash
orca plugin inspect packages/orca --json      # contentHash of a folder
node packages/orca/scripts/content-hash.mjs <folder>
```

Hash a folder holding only committed files and `dist/`: Orca hashes every file in it, `node_modules/` too.

### Listing images

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
`test/manifest.test.ts` fails on one instead; `orca plugin validate packages/orca` checks the same.

Each catalog release pins every image's SHA-256, and Orca refuses an image whose bytes changed. To change a
picture, commit it under a new file name and leave the old one, so earlier releases still show theirs.

## Check by hand

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

## License

[MIT](https://github.com/rizanw/steno-spec/blob/main/LICENSE)
