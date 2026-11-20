<p align="center">
  <img src="https://raw.githubusercontent.com/rizanw/steno-spec/main/assets/steno.png" alt="steno logo" width="140">
</p>

<h1 align="center">steno spec for VS Code</h1>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=rzndwb.steno-vscode"><img src="https://img.shields.io/visual-studio-marketplace/v/rzndwb.steno-vscode" alt="Marketplace version"></a>
  <a href="https://github.com/rizanw/steno-spec/actions/workflows/ci.yml"><img src="https://github.com/rizanw/steno-spec/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
  <a href="https://github.com/rizanw/steno-spec/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/steno-spec" alt="MIT license"></a>
</p>

<p align="center">
  <strong>Shorthand specs for any coding agent.</strong><br>
  Spec-driven development with a gate at every stage: requirements → design → tasks → execute, 
  each one linted and approved by you before the next begins. Your agent does the writing, the sidebar
  shows where every spec stands, puts each lint finding on its line, and gives you the approvals —
  without a model, a chat or a token.
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="https://github.com/rizanw/steno-spec/blob/main/examples/link-shortener/TUTORIAL.md">Tutorial</a> ·
  <a href="https://github.com/rizanw/steno-spec/blob/main/docs/getting-started.md">Getting started</a> ·
  <a href="https://github.com/rizanw/steno-spec/blob/main/docs/concepts.md">Concepts</a> ·
  <a href="https://github.com/rizanw/steno-spec/blob/main/docs/cli.md">CLI reference</a>
</p>

---

- **Plain Markdown specs, any agent.** `requirements.md`, `design.md` and `tasks.md`, with EARS
  criteria and stable ids, so Claude Code, Codex, Cursor or Copilot can be driving while you watch.
- **A gate at every stage.** Lint errors send a document back for another pass, and only your
  approval moves a spec on — from your agent, or from the tree.
- **A task gets a packet, not the whole spec.** Your agent reads `steno ctx T2.1`, usually a few
  hundred tokens; the tree, the findings and the approvals you click cost nothing at all.
- **Your agent writes, steno checks.** The extension has no model in it: no language-model tool, no
  chat participant, no network call. The thinking stays in the agent you already use.

## Quick start

Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=rzndwb.steno-vscode), or:

```bash
code --install-extension rzndwb.steno-vscode
```

In Cursor, Windsurf, VSCodium and other editors that use Open VSX, search for **steno spec** in the Extensions view, or get it from [Open VSX](https://open-vsx.org/extension/rzndwb/steno-vscode).

Open a folder that already has a `.steno/` directory. For one that has none, choose **Set up steno**
in the view, or run **steno: Set Up steno in a Folder** from the command palette: pick the coding
agents you use, and the extension creates `.steno/` and installs the steno skills for them.

The extension carries its own copy of steno, so there is nothing else to install to *read* your specs.
Writing them is the agent's half of the job, and the skills call `steno` directly, so install the CLI 
for that:

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

Each phase has a skill that does the writing and a gate that ends it. Lint errors and review findings
send the document back for another pass; a fresh-context review — read-only reviewers that never see
your conversation — is there when you want one. Only your approval moves a spec to the next stage,
from your agent or from this view.

## See it in action

The steno icon in the activity bar opens two views, Specs and Steering, for every steno project in the window:

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

- **Specs** shows each spec by its title, with its phase or the tasks left, then its documents and its tasks. A tick marks an approved document and a finished task.
- **Steering** shows each steering file with when it reaches the agent: always on, matching files, or on request.
- **Lint findings** appear on their line in the editor and in the Problems panel, for every spec and steering file, as you or your agent edit.
- **Approve This Phase**, **Mark Task Done** and **Reopen Task** sit on the rows of the tree. Approving is refused while lint reports errors, and the findings are listed.

## Hand work to your agent

The extension never writes a spec or runs a task itself. It sends your coding agent a short skill call, such as `/steno-run T2.2 link-expiry`, and the agent fetches the rest with `steno`. No file contents are in the call.

| Action | Where | What the agent is asked to do |
|---|---|---|
| **Write This Phase** | a spec that is not yet in execute | write the brief, requirements, design or tasks |
| **Review This Phase** | a spec in requirements, design or tasks, or a finished one | a fresh-context review of that stage, or a drift review once the spec is done |
| **Run Task** | an open task, in the tree or the lens above it in `tasks.md` | that task |
| **Run Next Task** | a spec in execute | its next open task |
| **Generate Steering** | the Steering view | write the steering files |

Pick the agent once with **steno: Choose Coding Agent**, or from the status bar. The list shows the agents found on your machine:

| Agent | How the call arrives |
|---|---|
| Copilot Chat, Claude Code (extension) | typed into the chat box for you to send |
| Claude Code, Codex CLI, Gemini CLI, OpenCode (terminal) | started in a new terminal in the project folder |
| Copy to clipboard | always there; also the fallback when a call can't be delivered |

## Requirements

VS Code 1.125 or later, on macOS, Linux or Windows. The bundled server and CLI are the `steno-spec`
release that matches the extension's version and run on the editor's own Node; the extension never looks for a `steno` on
your PATH or in your `node_modules`. In a Restricted Mode workspace the tree, diagnostics and task actions work as
usual; handing work to a coding agent, choosing the agent and setting up steno wait until you trust the folder.

## Docs

- [Tutorial](https://github.com/rizanw/steno-spec/blob/main/examples/link-shortener/TUTORIAL.md): build a feature on the example project
- [Getting started](https://github.com/rizanw/steno-spec/blob/main/docs/getting-started.md): install, first spec end to end, quick mode, bugfixes
- [Concepts](https://github.com/rizanw/steno-spec/blob/main/docs/concepts.md): phases and gates, IDs, EARS, lint rules, context packets, steering
- [CLI reference](https://github.com/rizanw/steno-spec/blob/main/docs/cli.md): every command and flag
- [Agents & integrations](https://github.com/rizanw/steno-spec/blob/main/docs/agents.md): supported agents, EGM, coming from Kiro
- [JSON contract](https://github.com/rizanw/steno-spec/blob/main/docs/json-contract.md): what the bundled language server returns

## License

[MIT](https://github.com/rizanw/steno-spec/blob/main/LICENSE)
