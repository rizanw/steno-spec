<p align="center">
  <img src="https://raw.githubusercontent.com/rizanw/steno-spec/main/assets/steno.png" alt="steno logo" width="140">
</p>

<h1 align="center">steno spec for VS Code</h1>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=rzndwb.steno-vscode"><img src="https://vsmarketplacebadges.dev/version-short/rzndwb.steno-vscode.svg?label=VS%20Marketplace" alt="Marketplace version"></a>
  <a href="https://open-vsx.org/extension/rzndwb/steno-vscode"><img src="https://img.shields.io/open-vsx/v/rzndwb/steno-vscode?label=Open%20VSX" alt="Open VSX version"></a>
  <a href="https://github.com/rizanw/steno-spec/actions/workflows/ci.yml"><img src="https://github.com/rizanw/steno-spec/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
  <a href="https://github.com/rizanw/steno-spec/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/steno-spec" alt="MIT license"></a>
</p>

<p align="center">
  <strong>Shorthand specs for any coding agent.</strong><br>
  Plan a feature before you build it: requirements, then design, then tasks, then code. Your agent
  writes each stage, and this sidebar shows where every spec stands, puts each lint finding on its
  line and gives you the approvals. It has no model in it and spends no tokens.
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="https://github.com/rizanw/steno-spec/blob/main/examples/link-shortener/TUTORIAL.md">Tutorial</a> ·
  <a href="https://github.com/rizanw/steno-spec/blob/main/docs/getting-started.md">Getting started</a> ·
  <a href="https://github.com/rizanw/steno-spec/blob/main/docs/concepts.md">Concepts</a> ·
  <a href="https://github.com/rizanw/steno-spec/blob/main/docs/cli.md">CLI reference</a>
</p>

---

- **Specs are plain Markdown.** `requirements.md`, `design.md` and `tasks.md`, with EARS criteria and
  stable IDs, so Claude Code, Codex, Cursor or Copilot can do the writing while you watch.
- **Every stage has a gate.** Lint errors send a document back for another pass, and only your
  approval moves a spec on. You can approve from your agent or right here in the tree.
- **A task gets a packet, not the whole spec.** Your agent reads `steno ctx T2.1`, usually a few
  hundred tokens. The tree, the findings and the approvals you click cost nothing.
- **Your agent writes, steno checks.** The extension has no language-model tool, no chat participant
  and no network call. The thinking stays with the agent you already use.

## Quick start

Install it from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=rzndwb.steno-vscode), or run:

```bash
code --install-extension rzndwb.steno-vscode
```

In Cursor, Windsurf, VSCodium and other editors that use Open VSX, search for **steno spec** in the
Extensions view, or get it from [Open VSX](https://open-vsx.org/extension/rzndwb/steno-vscode).

Open a folder that already has a `.steno/` directory. If it doesn't have one yet, choose
**Set up steno** in the view, or run **steno: Set Up steno in a Folder** from the command palette.
Pick the coding agents you use, and the extension creates `.steno/` and installs the steno skills for
them.

The extension brings its own copy of steno, so you need nothing else to read your specs. Writing them
is your agent's job, and the skills call `steno` directly, so install the CLI too:

```bash
npm install -g steno-spec
```

## The workflow

```text
brief?  →  requirements  →  design     →  tasks      →  execute      →  done
approve    ↺ lint           ↺ lint        ↺ lint        ↺ next task     drift review?
           ↺ review?        ↺ review?     ↺ review?
           approve →        approve →     approve →

↺ sends you back to revise the same stage; only approve moves to the next one.
```

Every stage has a skill that writes it and a gate that ends it. When lint or a review finds a
problem, the document goes back for another pass. A review is there whenever you want one: read-only
reviewers look at the document and never see your conversation. Nothing moves to the next stage until
you approve it, from your agent or from this view.

## See it in action

The steno icon in the activity bar opens two views, Specs and Steering, for every steno project in the
window:

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

- **Specs** lists each spec by its title, with its phase or the tasks left, then its documents and
  tasks. A tick marks an approved document or a finished task.
- **Steering** lists each steering file and when it reaches the agent: always on, for matching files,
  or on request.
- **Lint findings** show up on their line in the editor and in the Problems panel, for every spec and
  steering file, while you or your agent edit.
- **Approve** sits on the document being approved, so you approve with it in view; it is also in the
  spec's right-click menu. **Mark Done** and **Reopen** sit on the task rows. If lint
  reports errors, approving is refused and the findings are listed.
- **Reopen Spec** is in a finished spec's right-click menu, for when you want to add tasks to it. A
  finished spec that already has new, unticked tasks is back in execution without it.
- **Right-click** any spec, task or folder row to see every action it offers, the buttons on the row
  included: the agent's actions first, then approving, marking done and reopening.

## Hand work to your agent

The extension never writes a spec or runs a task itself. It sends your coding agent a short skill
call, such as `/steno-run T2.2 link-expiry`, and the agent fetches the rest with `steno`. The call
never contains your files.

| Action | Where | What the agent is asked to do |
|---|---|---|
| **Write** or **Revise** the phase, such as **Write Design** | a spec that isn't in execute yet; Revise once the phase's document is filled in | write the brief, requirements, design or tasks |
| **Review** the phase, such as **Review Tasks** or **Review Drift** | a spec in requirements, design or tasks, or a finished one | review that stage with fresh eyes, or check a finished spec for drift |
| **Run Task** | an open task, in the tree or in the lens above it in `tasks.md` | do that task |
| **Run Next Task** | a spec in execute | do its next open task |
| **Generate Steering** | the Steering view | write the steering files |

Pick your agent once with **steno: Choose Coding Agent**, or from the status bar. The list shows the
agents found on your machine:

| Agent | How the call arrives |
|---|---|
| Copilot Chat, Claude Code (extension) | typed into the chat box, waiting for you to send it |
| Claude Code, Codex CLI, Gemini CLI, OpenCode (terminal) | started in a new terminal in the project folder |
| Copy to clipboard | always available, and used whenever a call can't be delivered |

## Requirements

VS Code 1.125 or later, on macOS, Linux or Windows. The bundled server and CLI are the `steno-spec`
release that matches the extension's version, and they run on the editor's own Node. The extension
never looks for a `steno` on your PATH or in your `node_modules`.

In a Restricted Mode workspace, the tree, the diagnostics and the task actions work as usual. Handing
work to an agent, choosing the agent and setting up steno wait until you trust the folder.

## Docs

- [Tutorial](https://github.com/rizanw/steno-spec/blob/main/examples/link-shortener/TUTORIAL.md): build a feature on the example project
- [Getting started](https://github.com/rizanw/steno-spec/blob/main/docs/getting-started.md): install, a first spec from start to finish, quick mode, bugfixes
- [Concepts](https://github.com/rizanw/steno-spec/blob/main/docs/concepts.md): phases and gates, IDs, EARS, lint rules, context packets, steering
- [CLI reference](https://github.com/rizanw/steno-spec/blob/main/docs/cli.md): every command and flag
- [Agents & integrations](https://github.com/rizanw/steno-spec/blob/main/docs/agents.md): supported agents, EGM, coming from Kiro
- [JSON contract](https://github.com/rizanw/steno-spec/blob/main/docs/json-contract.md): what the bundled language server returns

## License

[MIT](https://github.com/rizanw/steno-spec/blob/main/LICENSE)
