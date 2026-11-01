# Tutorial: build a feature with steno

You will add **click statistics** to the link shortener: today a link only knows its total click count, and you want to see clicks per day. You describe the feature; your agent writes the spec and the code; steno keeps both in check.

Time: about 30 minutes. You need Node ≥ 22.18 and a coding agent (Claude Code, Codex, Antigravity, Cursor, Copilot, Gemini CLI, OpenCode or Kiro).

## 1. Set up

Install steno:

```bash
npm install -g steno-spec
```

From this folder, check the example works:

```bash
npm install && npm test
```

Install the steno skills for your agent. Replace `claude` with your agent, or list several separated by commas:

```bash
steno init --agent claude
```

The steering files are already written, so you can skip "generate steering". See them with:

```bash
steno steer list
```

## 2. Ask for the spec

Open your agent in this folder and say:

```text
> start a spec for click statistics: I want to see how many clicks a link got on each day
```

The agent runs the `steno-spec` skill. Expect it to:

1. Ask whether this is a feature or a bugfix, and which mode. Answer **feature** and **requirements-first**.
2. Read the steering files and the code the feature touches.
3. Show you an outline of requirements and ask whether to detail them.
4. Write `requirements.md` with EARS acceptance criteria, run `steno lint requirements`, and list its open questions.

Things worth deciding at this point, because they change the design:

- How many days of history are kept?
- Which time zone decides what "a day" is?
- Do visits to an expired link count? (Link expiry says they are not clicks.)
- What does a link created before this feature show?

Ask the agent to interview you on the open questions, or answer them in one message. Then:

```text
> approved
```

Check what you approved without reading the whole file:

```bash
steno show requirements
```

## 3. Design and tasks

```text
> write the design
```

The `steno-design` skill writes `design.md`. Every section carries a `_Satisfies:_` line naming the criteria it implements. Look at the coverage:

```bash
steno trace
```

Every requirement should list at least one design section. When you are happy:

```text
> approved. break it into tasks
```

The `steno-tasks` skill writes `tasks.md`. Each task names the criteria and design sections it covers, and the list ends with a checkpoint. Check that no criterion was left without a task:

```bash
steno trace --criteria
```

```text
> approved
```

## 4. Build, one task at a time

```text
> do the next task
```

The `steno-run` skill runs `steno next`, reads the packet from `steno ctx`, implements the task with its tests, runs `npm test`, and marks it done. See exactly what the agent was given:

```bash
steno ctx T1.1
```

Notice the size in the first line. The agent did not read the whole spec; it read this packet.

Repeat "do the next task", or say "run through the remaining tasks" once you trust the flow. Watch progress at any time:

```bash
steno status
```

## 5. Check the result

```bash
npm test && npm run typecheck
```

Start the server and try your feature by hand, using the flows the final checkpoint in `tasks.md` lists.

Optionally, ask for a review by an agent that has not seen your conversation:

```text
> review for drift
```

It compares the finished code against the spec and reports where they disagree.

## What to compare against

The finished [link-expiry spec](.steno/specs/link-expiry/) in this folder went through the same steps. If your spec looks very different in shape, compare:

- **Criteria** are one sentence each, with one `SHALL`, and name glossary terms instead of code.
- **Design sections** have a `{#D-…}` id and say which criteria they satisfy.
- **Tasks** carry their own tests and end in a checkpoint you can verify by hand.

## If something goes wrong

- **The agent does not know the steno skills:** run `steno init --agent <yours>` again and restart the agent so it reloads its skills.
- **`steno lint` reports errors:** ask the agent to fix them; the message names the rule and line.
- **A task turns out to be wrong:** tell the agent. The rule is spec first, then code: it should propose the edit to the requirement or design before changing the implementation.
- **You want to start over:** delete `.steno/specs/click-stats/` and undo the code changes with git.
