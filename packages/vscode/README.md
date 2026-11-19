<p align="center">
  <img src="https://raw.githubusercontent.com/rizanw/steno-spec/main/assets/steno.png" alt="steno logo" width="140">
</p>

<h1 align="center">steno spec for VS Code</h1>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=rizanw.steno-vscode"><img src="https://img.shields.io/visual-studio-marketplace/v/rizanw.steno-vscode" alt="Marketplace version"></a>
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

Install from the Marketplace, or:

```bash
code --install-extension rizanw.steno-vscode
```

Open a folder that already has a `.steno/` directory, or run `steno init` in one you want to track.
A folder that is not a steno project says so in the view, and names the command that makes it one.

The extension carries its own copy of steno, so there is nothing else to install to *read* your
specs. Writing them is the agent's half of the job, and the skills call `steno` directly, so install
the CLI for that:

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

The steno icon in the activity bar opens every steno project in the window:

```text
specs
├─ link-expiry                                 execute · gated · 2/3
│  ├─ requirements.md
│  ├─ design.md
│  └─ tasks.md
│     ├─ ✓ T1 Parse and store the expiry
│     │  ├─ ✓ T1.1 Accept expiresAt in LinkService.create
│     │  └─ ✓ T1.2 Reject an expiry in the past
│     └─ ○ T2 Redirect rules
│        ├─ → T2.1 Skip an expired link in the resolver        next
│        └─ ○ T2.2 Sweep expired links on a timer          optional
└─ Steering
   ├─ product.md                                             always
   └─ api.md                                              fileMatch
```

Clicking any line opens that document where the item lives, at the requirement, section or task you
clicked. Lint findings arrive in the editor and the Problems panel as you type, so a stage that is
not ready to approve says so before you ask.

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

## License

[MIT](LICENSE)
