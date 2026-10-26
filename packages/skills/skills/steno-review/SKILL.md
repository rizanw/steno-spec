---
name: steno-review
description: Fresh-context review of a steno spec stage (requirements, design, tasks) or a drift check after implementation. Runs steno's own zero-history reviewers; hands off to EGM's egm-review only when the project sets `reviewer: egm` or the user asks for EGM. Use before approving a stage or after finishing a spec.
---

# steno-review — zero-history review

Why: a reviewer that shares your conversation agrees with you. Reviewers must see only the packet.

## Steps
1. `steno review --stage <requirements|design|tasks|drift>` → writes `reviews/<date>-<stage>-packet.md` containing the document, the traceability matrix and the source files to read. Note the path.
2. **EGM, only on request.** If `.steno/config.yaml` sets `reviewer: egm` or the user asked for EGM in this request, and EGM is installed: invoke `egm-review` on that packet file (for `drift`, `egm-drift-report`), telling it which stage the file is; for requirements or tasks, add that it is not a design document, so no architecture, alternatives or risks sections are expected. Save its findings as `reviews/<date>-<stage>.md`. Go to step 5.
3. **Otherwise** (the default) check whether this session can start sub-agents that do not inherit the conversation. If it cannot, stop and tell the user a fresh-context review is not possible here; do not review in your own context.
4. Start one sub-agent per persona in `reviewers/` that applies to the stage (each file says which). If a sub-agent type named `steno-reviewer-<persona>` is registered (Claude Code after `steno init`), use it and give it only the packet path: it is read-only and far cheaper. Otherwise start a plain sub-agent and give it only: the persona file, the packet path, read-only access. Collect their findings, merge duplicates, keep the reviewer's severity, and write `reviews/<date>-<stage>.md` as a list of `- [sev] <id or line>: <finding> → <suggested change>`.
5. Walk the findings with the user, highest severity first. Apply agreed edits to the spec, then `steno lint`. Record rejected findings with one line of reason at the bottom of the findings file.
6. **Open questions.** If the document still lists entries under `## Open questions`, or findings were left undecided, list them numbered and ask the user to pick one; never end with only a pointer to `steno approve`:
   - **Interview** (offer first): "I ask them one by one and update the spec for you." Ask one question at a time with your recommended answer and its trade-off. After each answer, edit the affected requirement or section, delete the question from `## Open questions`, and confirm the change in one line. The user can say "skip" (question stays) or "stop" at any point. Finish with `steno lint`.
   - **Edit myself**: the user edits the document; when they say done, run `steno lint` and re-list what is still open.
   - **Skip**: `steno approve <stage>`; the remaining questions stay in the document and are settled in the next stage (`steno-design` after requirements, `steno-tasks` after design, `steno-run` after tasks).
   An answer that changes scope or adds a requirement is a spec edit like any other: show it, get a yes, then write it. Skip this step for `drift`.

## Personas (reviewers/)
completeness · clarity · code-fit · implementability · ears
