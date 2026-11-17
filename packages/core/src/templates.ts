export function requirementsTemplate(title: string): string {
  return `# Requirements Document

## Introduction

<2 short paragraphs: the situation today, and what ${title} changes. No solution details.>

## Glossary

- **Term_Name**: <definition; use Term_Name in criteria instead of prose>

## Requirements

### Requirement 1: <short name>

**User Story:** As a <role>, I want <capability>, so that <benefit>.

#### Acceptance Criteria

1. WHEN <trigger>, THE <Component> SHALL <response>.
2. IF <unwanted condition>, THEN THE <Component> SHALL <response>.
3. WHILE <state>, THE <Component> SHALL <response>.
4. WHERE <option or mode>, THE <Component> SHALL <response>.
5. THE <Component> SHALL <always-true behaviour>.
`;
}

export function bugfixTemplate(title: string): string {
  return `# Bugfix Document

## Introduction

<what is broken, who hits it, and the impact>

## Glossary

- **Term_Name**: <definition>

## Current Behavior

<what happens now, with exact repro steps>

## Expected Behavior

<what should happen>

## Unchanged Behavior

<what must keep working exactly as today>

## Requirements

### Requirement 1: <bug summary>

**User Story:** As a <role>, I want <correct behaviour>, so that <benefit>.

#### Acceptance Criteria

1. WHEN <repro trigger>, THE <Component> SHALL <correct response>.
2. WHILE <unchanged scenario>, THE <Component> SHALL <behave as before>.
`;
}

export function designTemplate(title: string): string {
  return `# Design — ${title}

## Overview
<one paragraph: what changes and why; no footer here>

## Architecture {#D-arch}
<one diagram (mermaid) or a short bullet flow naming the components and the data they pass>

## Components and Interfaces
### <Component> {#D-component}
_Satisfies: 1.1, 1.2_
- Responsibility: <one line>
- File: \`src/<path>\`
- Interface: <signature or props, ≤ 10 lines in a code block if needed; no implementation bodies>
- Behaviour: <bullets, one per criterion it satisfies>

## Data Models {#D-data}
_Satisfies: <criteria that need these fields>_
| Field | Source | Used by |
|---|---|---|

## Correctness Properties
### Property 1: <invariant in one sentence> {#D-prop-1}
_Validates: 1.2_
*For any* <inputs>, <what must hold>.

## Error Handling {#D-errors}
_Satisfies: <criteria about failures and fallbacks>_
<bullets: failure case → user-visible result>

## Testing Strategy
<no footer; a table mapping criteria ranges → test type and file; property tests for the properties above>
`;
}

export function tasksTemplate(title: string): string {
  return `# Tasks — ${title}

- [ ] 1. <group>
  - [ ] 1.1 <concrete step, one sitting of work>
    - _Requirements: 1.1_ _Design: D-component_
  - [ ]* 1.2 <optional step, e.g. extra tests>
    - _Requirements: 1.2_
- [ ] 2. Checkpoint — <surface> end to end
  Verify: <type check, test command, and the user-visible flows to try>. No footer needed.
`;
}

export function briefTemplate(title: string): string {
  return `# Concept Brief — ${title}

## Problem
## Proposed direction
## Alternatives considered
## Open questions
## Decision
`;
}

export function configTemplate(): string {
  return `# steno project config
specsDir: .steno/specs
steeringDir: .steno/steering   # set to .kiro/steering to share steering with Kiro
ctxBudget: 1500          # tokens per \`steno ctx\` packet
steeringBudget: 4000     # token cap for all \`inclusion: always\` steering combined; read in full when a spec starts, trimmed in task packets
reviewer: default        # default | egm. default uses steno's own reviewers; egm hands reviews to EGM if it is installed
agents: []               # filled by \`steno init --agent ...\`
`;
}
