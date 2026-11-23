# steno in Orca

The Orca plugin adds a **steno** panel to [Orca](https://github.com/stablyai/orca)'s right sidebar. It shows the specs
and steering of the worktree you have focused, lists each document's lint problems, and lets you approve a
phase or tick a task off. It has no model in it and spends no tokens. To write, review or run something, it
starts the coding agent you pick in that worktree and types the skill call into its terminal, unsent. You
read the call and press Enter.

## Install

You need **Orca 1.4.262 or later**. The plugin is published through a catalog in the steno repository, so
add that catalog once, then install the plugin from it:

```bash
orca plugin catalog add rizanw/steno-spec
orca plugin install rizanw.steno
```

Each command first stops with `approval_required`, because a catalog decides where Orca installs plugins
from and this plugin runs code. Read what it lists, then run the command it prints, which ends in
`--approve <fingerprint>`.

Install by the catalog id `rizanw.steno`, not the repository name. Only the catalog's releases hold the
built plugin; the repository's own `v*` tags do not.

The plugin asks for these permissions:

| Permission | What it is for |
|---|---|
| `workspace:read`, `workspace:write` | Reading the specs, and the files steno writes when you approve, tick a task or create a spec |
| `agent:launch`, `agent:read`, `terminal:send` | Starting the agent you pick, finding the ones already running, and typing the skill call into its terminal |
| `storage:own` | Remembering each worktree's agent |
| `notifications:show` | Saying what an action did, or why it could not |

The panel works on its own: it carries its own steno language server and CLI. Your agents are another
matter. They call `steno` from their skills, and Orca starts them with its own `PATH`, so install the CLI
where they will find it:

```bash
npm install -g steno-spec
```

If the agents' `steno` is missing, older than the plugin's copy or speaks a different protocol, the panel
shows a warning bar with the exact command to install the right version. Install it, then press
**Re-check**.

Then focus a worktree and open the **steno** panel. If the folder has no `.steno/` yet, choose
**Set Up steno** and pick the coding agents that should get the steno skills.

## Use it

| You want to | Do this |
|---|---|
| See your specs | Expand a spec to see its documents and tasks. The next task is marked. |
| Read a document | Press its row. It opens in Orca's editor; a task opens its spec's `tasks.md`. |
| Move a spec on | Press **Approve** on the document of the current phase. If lint finds an error, the approval is refused and the problems are listed. |
| Tick off a task | Press **Mark Done** on the task. **Reopen** asks you before it changes anything. |
| Add work to a finished spec | Choose **Reopen Spec** from the spec's "more" menu, then add tasks to `tasks.md`. |
| Hand work to an agent | Press **Run Task**, **Run Next Task**, **Write**, **Review** or **Revise** (Write becomes Revise once the document is written). |
| Start something new | Press **New Spec** on the Specs header, or **Generate Steering** on the Steering header. |
| Set up a folder | Press **Set Up steno** on a folder without `.steno/`, and choose which coding agents get the skills. |

When a row has more actions than fit as buttons, the rest are behind its **more** button (•••).

### Handing work to an agent

The line above the specs says which agent this worktree hands work to: **Agent: asks each time** until you
pick one. The first agent you pick in a worktree becomes its agent, and **Change** picks another.

With an agent chosen, a hand-off starts it in the focused worktree and types a call such as
`/steno-run T2.1 link-expiry` into its terminal without pressing Enter. If one of that kind is already
running there, the panel asks whether to use it or start a new one.

When the call cannot be typed, because the agent did not start within 30 seconds or Orca refused to type
into its terminal, it is copied to the clipboard and a notification says where to paste it. On Linux that
needs `wl-copy`, `xclip` or `xsel`; without one, the notification shows the call to copy by hand.

## Update and uninstall

Orca keeps plugins from a catalog up to date. A release that asks for new permissions waits for your
approval.

| To | Run |
|---|---|
| Update now | `orca plugin update rizanw.steno` |
| Turn it off for a while | `orca plugin disable rizanw.steno` (and `enable` to bring it back) |
| Uninstall | `orca plugin uninstall rizanw.steno` |
| Remove the catalog | `orca plugin catalog rm rizanw/steno-spec` |

## Troubleshooting

Start with the plugin's log:

```bash
orca plugin logs rizanw.steno
```

| You see | What to do |
|---|---|
| A warning bar naming `npm install -g steno-spec@<version>` | Your agents' `steno` is missing, older than the plugin's or speaks a different protocol. Run that command, then press **Re-check**. |
| "steno stopped in this worktree after it kept crashing" | Press **Restart**. If it stops again, [open an issue](https://github.com/rizanw/steno-spec/issues) and attach the log. |
| "steno did not answer …, so whether it ran is unknown" | Orca stopped the plugin or it took too long. The specs below the bar show what steno reports now, so check whether the change happened before you try again. |
| `server for <folder> could not start` in the log | Run `orca plugin update rizanw.steno`, then `orca plugin restart rizanw.steno`. |
| A notification says the call was copied | The agent did not take the call. Paste it into the agent's terminal. |
| `rizanw.steno` is not found | Add the catalog first: `orca plugin catalog add rizanw/steno-spec`. |

## Docs

- [Getting started](getting-started.md): a first spec from start to finish, quick mode, bugfixes
- [Concepts](concepts.md): phases and gates, IDs, EARS, lint rules, context packets, steering
- [Agents & integrations](agents.md): supported agents and reviewers
- [Plugin README](../packages/orca/README.md): build the plugin from source and check it by hand
