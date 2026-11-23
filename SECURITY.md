# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security problem.

Report it privately through GitHub instead: go to the [Security tab](https://github.com/rizanw/steno-spec/security) and click **Report a vulnerability**. Only the maintainer can see the report.

Include what you can:

- which part is affected: the `steno` command, the language server (`steno lsp`), the VS Code extension, the Paseo plugin, the Orca plugin or a skill
- the steno version (`steno --version`), Node version and OS; for the extension, its version and the editor's; for the Paseo or Orca plugin, its version and the app's
- what an attacker can do, and what they need first
- steps or a small project that reproduces it

steno is maintained in spare time, so a reply can take a while. You will get an answer, and credit in the advisory if you want it.

## Trust

A task packet (`steno ctx`, or the language server's `steno/taskPacket`) copies spec and steering text from your repository word for word, because that text is the agent's instructions. Give a packet the same trust as the repository it came from: an agent that reads a packet from a repository you don't trust is as exposed as one that reads that repository's files directly.

The VS Code extension starts only the two programs it ships with, the steno CLI and language server, and makes no network request. In a folder you have not trusted (Restricted Mode) it still reads specs, shows lint findings, and can approve a phase or tick a task, which write to `spec.yaml` and `tasks.md` in that folder. Handing work to a coding agent, choosing the agent and setting up steno are off until you trust the folder, because they start a program from your PATH or install files. A hand-off sends the agent a short skill call with a spec name and a task id, never file contents.

The Paseo plugin runs as trusted code in the Paseo daemon, as every Paseo plugin does. It writes the CLI and language server it ships with to Paseo's plugin data folder and starts them from there, runs `steno --version` from the daemon's PATH to check the CLI your agents use, and makes no network request. Approving a phase or ticking a task writes to `spec.yaml` and `tasks.md`; Set Up steno runs `steno init` in the folder you pick. A hand-off puts the same short skill call in an agent's composer without sending it, or on the clipboard.

The Orca plugin runs as a trusted worker on Node inside Orca, with the permissions Orca shows when you install it. It starts the CLI and language server it ships with from its own plugin folder, runs `steno --version` from Orca's PATH to check the CLI your agents use, and makes no network request. Approving a phase or ticking a task writes to `spec.yaml` and `tasks.md`; New Spec and Set Up steno run the bundled CLI in the focused worktree. A hand-off starts the agent you pick, or reuses one already running there, and types the same short skill call into its terminal without pressing Enter. When it cannot, it puts the call on the clipboard with the platform's copy program (`pbcopy`, `clip`, `wl-copy`, `xclip` or `xsel`).

## Supported versions

Fixes go into the latest release only. The npm packages, the VS Code extension and the Paseo and Orca plugins are released together under one version number.
