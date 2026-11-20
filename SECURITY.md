# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security problem.

Report it privately through GitHub instead: go to the [Security tab](https://github.com/rizanw/steno-spec/security) and click **Report a vulnerability**. Only the maintainer can see the report.

Include what you can:

- the steno version (`steno --version`), Node version and OS
- what an attacker can do, and what they need first
- steps or a small project that reproduces it

steno is maintained in spare time, so a reply can take a while. You will get an answer, and credit in the advisory if you want it.

## Trust

A task packet (`steno ctx`, or the language server's `steno/taskPacket`) copies spec and steering text from your repository word for word, because that text is the agent's instructions. Give a packet the same trust as the repository it came from: an agent that reads a packet from a repository you don't trust is as exposed as one that reads that repository's files directly.

## Supported versions

Fixes go into the latest release only.
