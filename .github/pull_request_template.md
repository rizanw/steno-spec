## What and why

<!-- One or two sentences. -->

Closes #

## Checklist

- [ ] The title follows Conventional Commits, such as `fix: accept IF without THEN`
- [ ] `pnpm build && pnpm test && pnpm lint:skills` pass
- [ ] Docs updated (README, `docs/`, or `--help` text), or no change needed
- [ ] JSON shape changed: ran `pnpm contract:record` and updated `docs/json-contract.md`, or no shape changed
- [ ] Extension changed: `pnpm --filter steno-vscode test:e2e` passes, or the extension is untouched
- [ ] Linked the issue this fixes, if there is one
