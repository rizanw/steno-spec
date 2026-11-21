<p align="center">
  <img src="https://raw.githubusercontent.com/rizanw/steno-spec/main/assets/steno.png" alt="steno logo" width="140">
</p>

<h1 align="center">steno spec for Paseo</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/steno-paseo"><img src="https://img.shields.io/npm/v/steno-paseo" alt="npm version"></a>
  <a href="https://github.com/rizanw/steno-spec/actions/workflows/ci.yml"><img src="https://github.com/rizanw/steno-spec/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
  <a href="https://github.com/rizanw/steno-spec/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/steno-spec" alt="MIT license"></a>
</p>

<p align="center">
  <strong>Shorthand specs for any coding agent.</strong><br>
  Spec-driven development with a gate at every stage: requirements → design → tasks → execute,
  each one linted and approved by you before the next begins. Your agent does the writing in Paseo;
  the steno panel shows where every spec stands, lists each lint problem and gives you the approvals,
  without a model, a chat or a token.
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#use-it">Use it</a> ·
  <a href="#troubleshooting">Troubleshooting</a> ·
  <a href="https://github.com/rizanw/steno-spec/blob/main/docs/getting-started.md">Getting started</a> ·
  <a href="https://github.com/rizanw/steno-spec/blob/main/docs/concepts.md">Concepts</a> ·
  <a href="https://github.com/rizanw/steno-spec/blob/main/docs/cli.md">CLI reference</a>
</p>

---

- **Plain Markdown specs, any agent.** `requirements.md`, `design.md` and `tasks.md`, with EARS
  criteria and stable IDs, so whichever agent you run in Paseo can do the writing while you watch.
- **A gate at every stage.** Lint errors send a document back for another pass, and only your
  approval moves a spec on.
- **A task gets a packet, not the whole spec.** Your agent reads `steno ctx T2.1`, usually a few
  hundred tokens; the panel, the lint problems and the approvals cost nothing at all.
- **Self-contained.** The plugin carries its own steno language server and skills and runs them on
  Paseo's Node: no second runtime, no network call.

## Quick start

You need **Paseo 0.16 or later** with plugins turned on (Settings → Plugins → Enable plugins), and
npm on the Paseo daemon's `PATH`.

```bash
paseo plugin install npm:steno-paseo
paseo plugin ls                        # steno shows "running"
```

The panel works on its own. Your agents call `steno` from their skills, and they share the daemon's
`PATH`, so install the CLI where the daemon can find it:

```bash
npm install -g steno-spec
```

If the `steno` on that `PATH` is missing, older than the one the plugin carries, or speaks a different
protocol, the panel shows a warning bar with the command that installs the plugin's version.

Then open a workspace and pick the **steno** tab in the Explorer. For a folder with no `.steno/`,
choose **Set Up steno** and pick the coding agents that should get the steno skills.

## The workflow

```text
brief?  →  requirements  →  design     →  tasks      →  execute      →  done
approve    ↺ lint           ↺ lint        ↺ lint        ↺ next task     drift review?
           ↺ review?        ↺ review?     ↺ review?
           approve →        approve →     approve →

↺ sends you back to revise the same stage; only approve moves to the next one.
```

Each phase has a skill that does the writing and a gate that ends it. A fresh-context review, run by
read-only reviewers that never see your conversation, is there when you want one. Only you can
approve: no skill and no agent can do it for you.

## Use it

| You want to | Do this |
|---|---|
| See your specs | Expand a spec to see its documents and tasks. The next task is marked. |
| Read a document | Tap it. Its lint problems are listed above the text. Documents open read-only; your agent edits them. |
| Move a spec on | **Approve** on the document of the current phase. A lint error stops it and is listed. |
| Tick off a task | **Mark Done** on the task. **Reopen** asks before it changes anything. |
| Add work to a finished spec | **Reopen Spec** in the spec's "more" menu, then add tasks to `tasks.md`. A finished spec that already has new, unticked tasks is back in execution without it. |
| Hand work to an agent | **Run Task**, **Run Next Task**, **Write**, **Review** or **Revise** (Write, once the document is written). The skill call lands unsent in the agent you have open, else in an open New Agent screen, else in the most recent agent. With no agent, it is copied to the clipboard. |
| Start something new | **New Spec** on the Specs header, or **Generate Steering** on the Steering header. |
| Set up a folder | **Set Up steno** on a folder without `.steno/`, and choose which coding agents get the skills. |

Every action is also in the Command Center: press ⌘K (Ctrl+K on Windows and Linux) and type
`steno`. An item such as **Approve…** opens the panel with a list of what it applies to.

A row whose actions don't all fit as buttons has a **more** button (•••) with the rest.

## Update and uninstall

| To | Run |
|---|---|
| Update | `paseo plugin update steno` |
| Turn it off for a while | `paseo plugin disable steno` (and `enable` to bring it back) |
| Uninstall | `paseo plugin remove steno` |

The plugin unpacks its programs into `~/.paseo/plugin-data/steno/`, one folder per version. Removing
the plugin leaves that folder in place; delete it by hand if you want the space back.

## Troubleshooting

Start with the plugin's log:

```bash
paseo plugin logs steno
```

A healthy start has one line per bundled program:

```text
steno: programs in ~/.paseo/plugin-data/steno/<hash>
steno: cli started: <version>
steno: language server started: <name> <version>
```

| You see | What to do |
|---|---|
| steno is missing from `paseo plugin ls` | Turn plugins on in Settings → Plugins, then install again. |
| `cli failed` or `language server failed` in the log | `paseo plugin update steno`, then `paseo plugin reload steno`. If it persists, [open an issue](https://github.com/rizanw/steno-spec/issues) with the log. |
| `could not unpack the bundled programs` | Check that `~/.paseo/plugin-data/` is writable. |
| A warning bar naming `npm install -g steno-spec@<version>` | Your agents' `steno` is missing, older than the plugin's or a different protocol. Run that command where the daemon runs. |
| The panel says the steno server stopped | It crashed five times in a row. Choose **Restart steno Server**, and check the log if it stops again. |
| The install fails on `npm:` | npm must be on the daemon's `PATH`, with access to the npm registry. |

## Docs

- [Getting started](https://github.com/rizanw/steno-spec/blob/main/docs/getting-started.md): first spec end to end, quick mode, bugfixes
- [Concepts](https://github.com/rizanw/steno-spec/blob/main/docs/concepts.md): phases and gates, IDs, EARS, lint rules, context packets, steering
- [CLI reference](https://github.com/rizanw/steno-spec/blob/main/docs/cli.md): every command and flag
- [Agents & integrations](https://github.com/rizanw/steno-spec/blob/main/docs/agents.md): supported agents and reviewers
- [Contributing](https://github.com/rizanw/steno-spec/blob/main/CONTRIBUTING.md#the-paseo-plugin): build the plugin from source and test it

## License

[MIT](https://github.com/rizanw/steno-spec/blob/main/LICENSE)
