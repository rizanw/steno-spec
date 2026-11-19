---
name: steno-spec
description: Create a steno spec and write its requirements (requirements.md, EARS acceptance criteria): intake, codebase exploration, outline, detailing, lint, review. Use when the user wants to start a feature or bugfix, "write the requirements", or the spec phase is "requirements".
---

# steno-spec — requirements phase

Goal: `requirements.md` a reviewer with no context can test against: WHAT must be true, never HOW.
Hard rules: never read a spec file back in full (use `steno show <id>`); no code in criteria.

## Spec name
When the request ends with a spec name, append the spec name to every steno command that takes `[spec]`, never to `steno new` or `steno quick`.

## 0. Resume (the spec already exists)
`steno status <slug>` first, then branch; never redo intake.
- `requirements.md: not started` or `skeleton: requirements.md …` → go to step 2.
- phase `requirements`, no skeleton line, not approved → `steno show requirements`, then go to step 5.
- `requirements` already approved → stop; the next skill is `steno-design`.
- phase `brief` → stop; finish `steno-brainstorm` (`steno approve brief`) first.

## 1. Intake (new spec only; skip what the user already said)
Ask once, in one message: (a) feature or bugfix? (b) mode: **requirements-first** (default, gated), **quick** (all three artifacts, no gates, small work), or **brief first** (unclear idea → `steno-brainstorm`).
Then `steno new <kebab-slug> --title "<Title>"` (add `--bugfix`), or `steno quick <slug>`.

## 2. Explore (one bounded pass)
- If the spec has a brief: `steno show brief`. It is the primary input: its Decision sets scope, its Open questions carry into step 5.
- Steering: read `product.md` and the topic file for the area (`steno show steering/<f>`). If `steno status` printed `steering: none`, offer `steno-steer` first; if it printed nothing, the repo is greenfield: skip steering.
- Find what the feature touches: pages, queries, data fields, i18n, existing filters or modes.
  If a sub-agent is available, delegate to **one** capped at 15 files: paths, a ≤250-word summary of data fields, modes, conventions, small UI rules worth keeping, and ambiguities. Otherwise look yourself. Greenfield: skip this; the brief is the code knowledge.
- That summary is all the code knowledge needed; no writers that re-read code.

## 3. Outline
`steno scaffold` writes the `requirements.md` skeleton if missing. Replace its `<…>` placeholders with the outline; never a separate file.
- **Introduction**: two short paragraphs: situation today, what changes.
- **Glossary**: `- **Term_Name**: definition` for each view, control, mode and entity the criteria name (`THE Wallet_Picker SHALL …`, never "the dropdown"), defined by what the user sees.
- One `### Requirement N: <title>` per user-visible capability (3–8), each with its `**User Story:**`. Always consider one for **data availability** (what existing records must provide) and one for **modes and localisation**.
Gated mode: show titles and stories (not the file), ask "proceed to detail these?". Quick mode or told to run through: continue.

## 4. Detail each requirement (you, in this context)
Fill each `#### Acceptance Criteria`: 3–6 each (aim near 4), one EARS sentence, exactly one SHALL, at most 35 words:
`WHEN <trigger>, THE <Term> SHALL …` · `IF <condition>, THEN THE <Term> SHALL …` · `WHILE <state>, …` · `WHERE <mode/option>, …` · `THE <Term> SHALL …`
Cover happy path, empty/zero cases, the inverse action, modes, what must NOT happen. Concrete values only when given by the user or data.
Forbidden in criteria: file paths, component/prop/state names, function signatures, CSS, i18n keys. Wanting them means design; note it for `steno-design`.

## 5. Check and hand over
1. `steno lint requirements`; fix every error and warning (`ears/implementation`, `ears/too-long`: rewrite in user terms; `ears/undefined-term`: add the term).
2. Put every ambiguity the explorer flagged, every assumption and invented value under a final `## Open questions` list; never silently pick a side.
3. Report: `steno show requirements`, the open questions, then offer **resolve** (open questions: interview the user one at a time, recommended answer first; write each answer into its requirement, delete the question, and the heading with the last one; re-lint), **approve** (`steno approve requirements`, then `steno-design`; open questions carry over), **review** (`steno-review --stage requirements`) or **edit** (one requirement, re-lint).
Never `steno approve` without the user's yes, except in quick mode.
