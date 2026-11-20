# Review benchmark pilot: steno reviewers vs EGM

Run on 2026-11-13. One spec, requirements stage, 27 reviewer runs. This is a pilot: it shows direction, not a statistically solid result.

## Result in short

- **Detection: no difference.** Both found all 10 planted defects in both repeats. Every single steno reviewer found all 10 on its own, so the planted defects were too easy to separate the two.
- **Cost: steno's fallback used about 2.4 times the tokens of EGM**, despite running half as many reviewers. The cause was the agent type, not the review. With registered read-only reviewers the same review costs about 39,000 tokens, less than half of EGM's (see Cost).
- **Volume: both produced 55 to 90 findings per review**, including on the unseeded spec. After the steno personas were rewritten, steno's count on the unseeded spec fell from 69 to 11 with detection unchanged.

## Method

- **Spec:** the link-expiry requirements from `examples/link-shortener`, 5 requirements and 22 criteria.
- **Packets:** `packet-clean.md` and `packet-seeded.md`, both written by `steno review --stage requirements`. Each reviewer saw one packet and nothing else.
- **steno side:** the three personas that applied to the requirements stage at the time (clarity, completeness, ears; the scope reviewer came later and is not measured here), each as a general-purpose subagent given only the persona file and the packet path, as the `steno-review` skill instructs.
- **EGM side (v0.1.1):** the six reviewers its feature-spec flow uses (zoom-out, inventive catalyst, comprehension, design, structural, style), dispatched directly with the standards its skill names. Its fix-and-re-review loop was not run, since this measures detection only.
- **Runs:** seeded packet twice per side, clean packet once per side.
- **Scoring:** a planted defect counts as found when a finding names the same criterion or glossary entry and the same problem. Scored by the session that planted them, so not blind.

## Planted defects

All 10 pass `steno lint requirements`.

| # | Where | Defect |
|---|---|---|
| D1 | R5.2 | "SHALL handle that Link correctly": no testable outcome |
| D2 | R4.2 | generated code may reuse an expired link's code; contradicts R4.1 and the user story |
| D3 | R1 | criterion for a past or present expiry time removed |
| D4 | Glossary | Active_Link and Expired_Link both include "equal to" the current time |
| D5 | R3.4 | "marked as expired or an error": two allowed outcomes |
| D6 | R4.5 | automatic removal after 30 days; contradicts the introduction and R4 |
| D7 | R5 | criterion for links stored before the feature removed; story still promises it |
| D8 | Glossary | Expired_Error "the same as" not-found; contradicts R2.4 (status 410) |
| D9 | R1.3 | "valid timestamp" with no format or time zone rule |
| D10 | R2.6 | "SHALL notify the Link_Creator": no channel, conflicts with R2.5 |

## Detection

| | Reviewers | Run 1 | Run 2 |
|---|---|---|---|
| steno | 3 | 10 / 10 | 10 / 10 |
| EGM | 6 | 10 / 10 | 10 / 10 |

Per reviewer, out of 10:

| steno | Run 1 | Run 2 | | EGM | Run 1 | Run 2 |
|---|---|---|---|---|---|---|
| clarity | 10 | 10 | | comprehension | 10 | 10 |
| completeness | 10 | 10 | | design | 10 | 10 |
| ears | 10 | 10 | | style | 10 | 10 |
| | | | | zoom-out | 9 | 9 |
| | | | | inventive catalyst | 9 | 9 |
| | | | | structural | 9 | 7 |

Every EGM miss was D9 (timestamp format), except structural run 2, which also missed D3 and D7.

## Cost

| | Reviewers | Tokens per review | Tokens per reviewer | Wall time |
|---|---|---|---|---|
| steno | 3 | about 208,000 | about 69,000 | 43 to 61 s |
| EGM | 6 | about 87,000 | about 14,400 | 49 to 55 s |

The steno personas are about 100 tokens each and the packet about 1,500. The rest of the 69,000 is the base context of a general-purpose subagent: its system prompt and full tool list. EGM ships its reviewers as registered agents limited to Read, Grep and Glob, which start at a fraction of that. Token counts are the harness's `subagent_tokens` figure in Claude Code; other agents will differ.

### After the fix: registered read-only reviewers

`steno init` now writes each persona to `.claude/agents/steno-reviewer-<persona>.md` with only the Read, Grep and Glob tools. The same three personas were re-run that way on the same packets, once each.

| | Reviewers | Planted defects found | Tokens per review | Tokens per reviewer | Wall time |
|---|---|---|---|---|---|
| steno, general-purpose sub-agents | 3 | 10 / 10 | about 208,000 | about 69,000 | 43 to 61 s |
| steno, registered reviewers | 3 | 10 / 10 | 38,664 | about 12,900 | 42 s |
| EGM | 6 | 10 / 10 | about 87,000 | about 14,400 | 49 to 55 s |

- The registered reviewers cost 5.4 times fewer tokens than before and 2.2 times fewer than EGM's six.
- Each of the three again found all 10 planted defects on its own.
- On the unseeded spec they returned 69 findings (clarity 27, completeness 21, ears 21), against 56 before. That is one run each way, so the difference may be run-to-run variation; the reviewers are no quieter.
- This is one run on Claude Code. Other agents still use the general-purpose fallback.

### After the persona rewrite: less noise, same detection

The five personas of the time were then rewritten with a stage rule (no field names, status codes or payload shapes at the requirements stage), severity definitions, a limit of 3 low findings, and narrower briefs for ears and completeness. Same packets, registered reviewers, one run each.

| | Planted defects found | Findings on the seeded spec | Findings on the unseeded spec | High on the unseeded spec |
|---|---|---|---|---|
| Personas before | 10 / 10 | 70 | 69 | 14 |
| Personas after | 10 / 10 | 38 | 11 | 0 |

- Each reviewer still found all 10 planted defects on its own, including the unspecified timestamp format, which sits closest to the new "do not ask for formats" rule.
- On the unseeded spec: ears returned "No blocking findings."; completeness 5 (2 med, 3 low); clarity 6 (3 med, 3 low).
- What remains on the unseeded spec is mostly real: the creation response does not say whether it carries the expired marker; no outcome for a stored expiry time that cannot be read; "ISO 8601 with a time zone" admits several forms; the Link glossary entry omits Expiry_Time.
- Two real but minor defects the old personas reported are no longer reported: "a single mode" in the introduction against "the optional mode" in the glossary, and R5.4 being triggered by a link "becoming" expired. Quieter cost a little recall on wording-level issues.
- Cost fell slightly as well: about 35,000 tokens for the three reviewers on the unseeded spec, because shorter reports cost fewer output tokens.

## Findings on the unseeded spec

The numbers in this section are from the original personas.

| | Findings | Top severity |
|---|---|---|
| steno | 56 (clarity 22, completeness 14, ears 20) | 8 high |
| EGM | 58 (design 15, style 13, structural 12, comprehension 10, zoom-out 6, catalyst 2) | 4 blockers |

These were not judged one by one, so there is no noise percentage. Reading them:

- **Real defects in the "clean" spec, found by both sides:** the introduction says "a single mode" while the glossary calls Persistent_Storage "the optional mode"; R5.4 is triggered by a link "becoming" expired, an event R2.5 says never happens; R2.5 covers visits but not inspection; the Link glossary entry omits Expiry_Time; nothing says whether expiry can be changed after creation; "my links" implies ownership the spec never defines.
- **steno noise:** many clarity and ears findings ask for field names, status codes and null-versus-omitted. The `steno-spec` skill forbids those in requirements and sends them to design, so the reviewers contradict the writer.
- **EGM noise:** all 4 blockers are "no Alternatives Considered section" and "no Risks section". They come from applying a design-document standard to a requirements file. The structural reviewer also reports the packet's own heading levels and blank lines.
- **Found by EGM's design reviewer only:** an expired link's target URL is still returned on inspection; behaviour after rolling back to an older build; clock adjustments reviving expired links. steno's completeness reviewer independently raised redirect caching and unbounded retention.

## What this does not show

- Whether either side catches subtle defects. All 10 were found by nearly every reviewer, so the test hit its ceiling.
- Behaviour at the design or tasks stage, or with code to read. The requirements packet lists no source files.
- A noise rate. That needs a blind judge over the clean-spec findings.
- Anything about other models or agent harnesses.

## What changed in steno because of this

1. The steno reviewers ship as registered read-only agents, as EGM's do, so a review costs tens of thousands of tokens, not 200,000. Measured: see "After the fix" under Cost.
2. The clarity and ears personas say what the requirements stage excludes (field names, status codes), to match `steno-spec`. Measured: see "After the persona rewrite".
3. When `steno-review` hands a requirements or tasks packet to EGM, it says which stage the file is and that it is not a design document, so EGM's design-document checks do not fire on the wrong target.

Raw per-run scores are in `runs.tsv`.
