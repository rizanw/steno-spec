# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security problem.

Report it privately through GitHub instead: go to the [Security tab](https://github.com/rizanw/steno-spec/security) and click **Report a vulnerability**. Only the maintainer can see the report.

Include what you can:

- which part is affected: the `steno` command, the language server (`steno lsp`), the VS Code extension or a skill
- the steno version (`steno --version`), Node version and OS; for the extension, its version and the editor's
- what an attacker can do, and what they need first
- steps or a small project that reproduces it

steno is maintained in spare time, so a reply can take a while. You will get an answer, and credit in the advisory if you want it.

## Trust

A task packet (`steno ctx`, or the language server's `steno/taskPacket`) copies spec and steering text from your repository word for word, because that text is the agent's instructions. Give a packet the same trust as the repository it came from: an agent that reads a packet from a repository you don't trust is as exposed as one that reads that repository's files directly.

The VS Code extension starts only the two programs it ships with, the steno CLI and language server, and makes no network request. In a folder you have not trusted (Restricted Mode) it still reads specs, shows lint findings, and can approve a phase or tick a task, which write to `spec.yaml` and `tasks.md` in that folder. Handing work to a coding agent, choosing the agent and setting up steno are off until you trust the folder, because they start a program from your PATH or install files. A hand-off sends the agent a short skill call with a spec name and a task id, never file contents.

## Supported versions

Fixes go into the latest release only. The npm package and the VS Code extension are released together under one version number.
