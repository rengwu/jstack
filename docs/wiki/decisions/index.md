---
title: Rich authoring decisions
section: Decisions
updated: 2026-10-06
status: Accepted
---
# Rich authoring decisions

Accepted on 2026-10-05 from the [submitted interview answers](../journal/2026-10-05-grill-863620f9-6754-4523-a4d4-df829ac2de6a.md). The interview resolved how to add richer question presentation while keeping SKILL.md lean.

| ID | Decision | Rationale |
| --- | --- | --- |
| DEC-001 | Keep JSON input and add rich Markdown question bodies. | Preserve structured question validation and the existing answer workflow. |
| DEC-002 | Support Markdown formatting, tables, code blocks, and Mermaid in the first version. | Cover the requested explanatory formats within a defined initial scope. |
| DEC-003 | Rich content belongs only in the body; all other fields remain plain text. Display question title, rich body, recommendation, then options. | Preserve the current question and answer controls while adding explanatory content in a predictable location. |
| DEC-004 | Add one capability sentence and an optional authoring-reference link to SKILL.md. | Make capabilities discoverable while keeping detailed syntax and examples outside the entrypoint. |
| DEC-005 | Agents may choose rich presentation when it helps the user decide. | The user need not explicitly request rich content for each question. |

These are expected behaviors, not implementation or verification claims. Exact renderer choices and compatibility details remain implementation work; see [open questions](../discussions/open-questions.md).

## Round two — 2026-10-06

Source: [round-two answers](../journal/2026-10-05-grill-1524864d-d2c2-4cca-b2c1-c5541d50db4f.md). The transcript filename uses the form creation date; these decisions were interpreted on 2026-10-06.

| ID | Decision | Rationale |
| --- | --- | --- |
| DEC-006 | Clarify DEC-001 and DEC-003: upgrade the existing description to rich Markdown in its existing position, rather than adding a separate body beside it. | The user wants the existing question, description, recommendation, and answer options layout. The current implementation calls the description `context`. |
| DEC-007 | Initial Mermaid support covers flowcharts, sequence diagrams, and state diagrams. | A focused supported set covers common planning diagrams. |
| DEC-008 | On diagram rendering failure, show an error and the original source; answering and submission remain available. | A rendering failure should not prevent the user from responding. |
| DEC-009 | Preserve the reading column and allow rich content to expand. | Wide diagrams and tables need room without widening all question controls. |
| DEC-010 | Save the original rich source alongside the answers. | Preserve the exact content that informed the answer instead of replacing it with a summary. |

The question-six note referred to “4 questions” in the existing layout. This is understood as referring to the answer-options area, not as establishing a new global option-count requirement. No option-count change is planned from this note alone.

The user raised matching wiki rendering as a possible extension in round two; round three resolves its scope below.


## Round three — 2026-10-06

Source: [round-three answers](../journal/2026-10-05-grill-911b2856-2c6c-45f9-8e4a-588835770d99.md).

| ID | Decision | Rationale |
| --- | --- | --- |
| DEC-011 | Deliver rich forms first. Plan matching wiki rendering as a separate follow-up. | Keep the first change focused on the form; preserve rich source now so the wiki can render it in the future. |

The scoped interview is complete. Implementing the accepted behavior is the next step when requested; these records do not claim it has been implemented or verified.
