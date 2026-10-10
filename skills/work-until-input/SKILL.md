---
name: work-until-input
description: Carry an authorized task forward autonomously until completion or a consequential decision requires the user's input, then use grill-form. Use when the user asks to work independently and return only when judgment or missing constraints are needed.
---
# Work until input

Continue the user's authorized task through implementation, relevant verification,
and project records. Read [jstack conventions](../../references/stack-contract.md)
and resume from the target project's instructions and existing checkpoint.
Preserve the agreed outcome, constraints and earlier authorization; this workflow
does not expand scope or grant additional permissions.

## Keep moving

Resolve discoverable facts through code, tools, sources and tests. Choose routine,
reversible implementation details using existing requirements and judgment. A
research gap, difficult bug or failed first attempt calls for investigation, not
an interview asking the user to supply facts the agent can discover.

Use [verify-change](../verify-change/SKILL.md) for relevant behavior checks and
[plan](../plan/SKILL.md) for substantive planning outcomes. Distinguish verified
behavior from planned work and unresolved evidence. Follow the target project's
commit conventions; this skill does not request committing unrelated changes.
Keep progress updates concise so the user can steer ongoing work.

## Recognize a real decision

Return to the user when further progress depends on a consequential preference,
missing constraint, conflicting requirement or scope choice that existing records
do not resolve. First complete the independent work that makes the choice concrete:
explain the evidence, alternatives, recommendation and practical consequence.
Do not reopen settled decisions or pad a round with speculative questions.

Use [grill-form](../grill-form/SKILL.md) to present the ready decisions, following
its interview and collection lifecycle. Open the form and end the turn as that
skill requires; do not poll or treat elapsed time as an answer. Preserve the
checkpoint and identify which work depends on the answers.

Required action approvals are separate from design interviews: use the applicable
approval mechanism and explain the actual requirement. A form is not a substitute
for required authorization. If a blocker needs an unavailable external input rather
than a judgment, report the specific missing input and completed work directly.

## Resume or finish

After submitted answers, collect and interpret them through grill-form/plan, then
resume work within the existing authorization. A user correction steers the active
task; an explicit pause or cancellation stops it.

When the requested outcome is complete, report the result, relevant verification
and material remaining limits. Do not invent another decision merely to produce a
form. If execution is interrupted, leave an accurate checkpoint with the next
concrete action; interruption is not completion.
