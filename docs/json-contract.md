# JSON contract

**Protocol version: 1**

This document describes every JSON shape that the steno language server (`steno lsp`) and the steno commands run with `--json` return. Editor plugins, scripts and CI jobs can rely on it. Each steno release speaks exactly one protocol version; `steno --version` prints it, for example `0.1.1 (protocol 1)`.

## Compatibility rules

- While the protocol version stays the same, no field listed here is removed, renamed, given another type or another meaning, and no value is added to a listed set of values (such as the error codes or `phase` names).
- A new field can be added without a new protocol version. **A Client ignores fields it does not know.**
- A change that breaks a rule above comes with a new protocol version, and this document is updated to match.
- Every top-level object carries `protocolVersion`, a number. The handshake result is the one exception: it carries the version under `capabilities.experimental.steno`.
- An optional field (marked `?` below) is left out when it has no value. `null` appears only where a type says so.
- Paths are relative to the project root and use `/` on every platform, except where a field says otherwise.

## What the contract covers

| Source | Returns |
|---|---|
| The language server handshake (`initialize`) | [Handshake](#handshake) |
| `steno/specTree` request, `steno list --json` | [SpecTree](#spectree) |
| `steno/taskPacket` request, `steno ctx <task> --json` | [TaskPacket](#taskpacket) |
| `steno/taskDone`, `steno/taskReopen` and `steno/approve` requests; `steno done`, `steno approve`, `steno new`, `steno quick` and `steno import` with `--json` | [ChangeResult](#changeresult) |
| `steno lint --json`, `steno steer lint --json` | [DiagnosticList](#diagnosticlist) |
| `steno show requirements\|design\|tasks --json` | [Outline](#outline) |
| Any refused request, and any failed command run with `--json` | [StructuredError](#structurederror) |
| `textDocument/codeLens`, `textDocument/documentSymbol` | steno fields inside the standard protocol messages: see [Task lenses](#task-lenses) and [Outline symbols](#outline-symbols) |

The `--json` output of every other command (`status`, `next`, `trace`, `review`, `steer list` and the rest) is **outside the contract** and can change in any release. The one exception is a failure: a failed command run with `--json` always writes a [StructuredError](#structurederror).

The server also sends the `steno/treeChanged` notification when a spec or steering file, the `.steno` folder or the configuration changes on disk, and after each change it applies itself. It carries no data. A Client that shows the tree asks for it again.

## Language server requests

| Method | Params | Result |
|---|---|---|
| `steno/specTree` | `{}` | SpecTree |
| `steno/taskPacket` | `{ spec, task, budget? }`; `budget` is a positive whole number of tokens, by default the project's `ctxBudget` | TaskPacket |
| `steno/taskDone` | `{ spec, task }` | ChangeResult |
| `steno/taskReopen` | `{ spec, task }` | ChangeResult |
| `steno/approve` | `{ spec, phase }`; `phase` is `brief`, `requirements`, `design` or `tasks` | ChangeResult |

A refused request is answered with a protocol error whose code is `RequestFailed` (-32803) and whose `data` is the [StructuredError](#structurederror).

## Shapes

Types are written in TypeScript notation. `Phase` is one of `"brief"`, `"requirements"`, `"design"`, `"tasks"`, `"execute"`, `"done"`.

### Handshake

The result of `initialize`. Only the steno fields are part of the contract.

| Field | Type | Meaning |
|---|---|---|
| `serverInfo.name` | `"steno"` | |
| `serverInfo.version` | `string` | The steno version, such as `0.1.1`. |
| `capabilities.experimental.steno.protocolVersion` | `number` | The protocol version. Check it before sending a steno request. |

### SpecTree

| Field | Type | Meaning |
|---|---|---|
| `protocolVersion` | `number` | |
| `notSetUp?` | `true` | Server only: the folder is not a set-up steno project; `specs` and `steering` are then empty. |
| `specs` | `TreeSpec[]` | One entry per spec folder, in name order. |
| `steering` | `TreeSteering[]` | One entry per steering file. |
| `specsDir?` | `string` | The specs folder in use, relative to the root with `/` separators, such as `.steno/specs`. Absent when `notSetUp` is set. A spec's documents are at `<specsDir>/<name>/<document>`. |
| `steeringDir?` | `string` | The steering folder in use, relative to the root with `/` separators. Absent when `notSetUp` is set. |

The server builds the tree from saved files only. `steno list --json` returns the same tree for the same files, with one difference: for a spec folder that has no `spec.yaml` yet, `steno list` writes one and shows today's date for each approval, where the server shows `null`.

### TreeSpec

A usable spec has every field except `unsupported`, `unreadable` and `files`. A spec steno cannot use has only `name`, exactly one of `unsupported` or `unreadable`, and `files`.

| Field | Type | Meaning |
|---|---|---|
| `name` | `string` | The spec's folder name (its slug). |
| `title?` | `string` | |
| `kind?` | `"feature" \| "bugfix"` | |
| `mode?` | `"gated" \| "quick"` | |
| `phase?` | `Phase` | |
| `approvals?` | `{ requirements?, design?, tasks?: string \| null }` | One key per approved stage, none for an unapproved one. The value is a `YYYY-MM-DD` date, or `null` for an approval derived from the documents and not written yet. |
| `tasks?` | `TaskCounts` | |
| `next?` | `{ id: string; title: string } \| null` | The task `steno next` would report; `null` when none is left. |
| `documents?` | `string[]` | File names, such as `design.md`. |
| `taskItems?` | `OutlineItem[]` | Every task of `tasks.md`, nested as in the [Outline](#outlineitem), each with `done` and `optional`; `[]` when the spec has no tasks. |
| `unsupported?` | `true` | The spec's `spec.yaml` has a format this steno does not support. |
| `unreadable?` | `true` | A file of the spec cannot be opened, is not UTF-8 text or cannot be parsed. |
| `files?` | `{ file: string; reason: string }[]` | Each file that makes the spec unusable, with why. |

### TaskCounts

Counts tasks without subtasks.

| Field | Type | Meaning |
|---|---|---|
| `total`, `done` | `number` | Required tasks, and how many of them are checked. |
| `optionalTotal`, `optionalDone` | `number` | The same for optional (`*`) tasks. |

### TreeSteering

| Field | Type | Meaning |
|---|---|---|
| `path` | `string` | |
| `inclusion?` | `"always" \| "fileMatch" \| "manual"` | Absent when the file is unreadable. |
| `unreadable?` | `true` | |
| `reason?` | `string` | Why the file is unreadable. |

### TaskPacket

The same packet `steno ctx` prints.

| Field | Type | Meaning |
|---|---|---|
| `protocolVersion` | `number` | |
| `spec`, `task` | `string` | |
| `text` | `string` | The packet itself, as Markdown. |
| `tokens` | `number` | Its estimated size. |
| `budget` | `number` | The token budget it was built for. |
| `files` | `string[]` | Files the task likely touches; an entry ends with ` (new)` when the file does not exist yet. |
| `trimmed` | `string[]` | Parts left out to fit the budget, and steering files left out with the reason in brackets, such as `steering/tech.md (unsaved edits)`. |

### ChangeResult

The state of the spec after a change.

| Field | Type | Meaning |
|---|---|---|
| `protocolVersion` | `number` | |
| `spec` | `string` | |
| `phase` | `Phase` | The spec's phase after the change. |
| `task?` | `string` | Done and reopen: the task changed. |
| `done?` | `boolean` | Done and reopen: whether the task is now checked. |
| `approved?` | `Phase` | Approve: the stage approved. |
| `forced?` | `true` | `steno approve --force` recorded the approval although lint reported errors. |
| `created?` | `string[]` | New, quick and import: the files created. |

### DiagnosticList

| Field | Type | Meaning |
|---|---|---|
| `protocolVersion` | `number` | |
| `spec?` | `string` | The spec checked; absent for `steno steer lint`. |
| `diagnostics` | `Diagnostic[]` | |

Lint errors are returned as this list, never as a StructuredError; the command then exits with code 2.

### Diagnostic

| Field | Type | Meaning |
|---|---|---|
| `file` | `string` | |
| `line` | `number` | 1-based. |
| `severity` | `"error" \| "warning"` | |
| `rule` | `string` | The rule, such as `ears/vague` or `spec/unreadable`. |
| `message` | `string` | |
| `spec?` | `string` | Set when the file belongs to a spec. |

The server publishes the same findings as standard `textDocument/publishDiagnostics`: `source` is `steno`, `code` is the `rule`, and the range covers the whole line (0-based in the protocol). `steno steer lint` also reports `steering/no-match`, a fileMatch pattern that matches no file in the repo; the server does not publish that warning.

### Outline

| Field | Type | Meaning |
|---|---|---|
| `protocolVersion` | `number` | |
| `spec` | `string` | |
| `document` | `string` | The file name, such as `tasks.md`. |
| `items` | `OutlineItem[]` | |

### OutlineItem

| Field | Type | Meaning |
|---|---|---|
| `kind` | `"requirement" \| "criterion" \| "section" \| "task" \| "heading"` | |
| `id?` | `string` | Such as `R1`, `R1.2`, `D-auth` or `T3.1`. |
| `title` | `string` | At most 80 characters. |
| `line`, `endLine` | `number` | 1-based, inclusive. |
| `children` | `OutlineItem[]` | Criteria under a requirement, subtasks under a task. |
| `done?` | `boolean` | Tasks only: whether the task is checked. |
| `optional?` | `boolean` | Tasks only: whether the task is marked optional (`*`). |

### StructuredError

| Field | Type | Meaning |
|---|---|---|
| `protocolVersion` | `number` | |
| `code` | one of the [error codes](#error-codes) | |
| `message` | `string` | Readable text for a person. |
| `field?` | `string` | The request field or argument that was wrong. |
| `file?` | `string` | The file concerned. |
| `spec?` | `string` | The spec concerned. |
| `reason?` | `string` | Why the file cannot be used. |
| `findings?` | `Diagnostic[]` | `lint-blocked` only: the errors that block the approval. |

## Error codes

| Code | Meaning |
|---|---|
| `invalid-request` | A missing or malformed argument or field, an unknown option, or an approval out of order. |
| `not-set-up` | The folder is not a set-up steno project, or its configuration cannot be read. |
| `not-found` | No such spec or task. |
| `unsupported` | The spec's `spec.yaml` has a format this steno does not support. |
| `unreadable` | A file of the spec cannot be opened, is not UTF-8 text or cannot be parsed. |
| `unsaved-edits` | Server only: a document the request needs has unsaved edits in the editor. |
| `lint-blocked` | An approval is blocked by lint errors; `findings` lists them. |
| `failed` | Anything else, such as a write that failed. Files a failed change wrote are restored. |

When several apply, the first in this order is reported: `invalid-request` for the arguments, `not-set-up`, `not-found` for the spec, `unsupported` or `unreadable`, `not-found` for the task, `invalid-request` for the approval rules, `unsaved-edits`, `lint-blocked`, `failed`.

Exit codes of the CLI: 0 on success, 2 for lint errors and for `lint-blocked`, 1 for every other failure.

## Steno fields in protocol messages

### Task lenses

`textDocument/codeLens` on an open `tasks.md` returns one lens above each task without subtasks: a run lens for an unchecked task and a done lens for a checked one. The steno fields sit in the lens's `command`:

| Where | Value |
|---|---|
| `command.command` | `steno.task.run` or `steno.task.done` |
| `command.title` | `Run T3.1` or `Done`, followed by ` (optional)` for an optional task |
| `command.arguments[0]` | `{ spec: string; task: string; optional: boolean }` |

The server registers no handler for either command. A Client registers `steno.task.run` and `steno.task.done` itself and decides what they do, for example ask for the task packet and hand it to an agent, or send `steno/taskReopen`.

### Outline symbols

`textDocument/documentSymbol` returns each [OutlineItem](#outlineitem) as a `DocumentSymbol`:

| Where | Value |
|---|---|
| `name` | The item's `title` (its `id` when the title is empty) |
| `detail` | The item's `id` |
| `range` | `line` to `endLine`, 0-based in the protocol |
| `children` | The item's `children` |
