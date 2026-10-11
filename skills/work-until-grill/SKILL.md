---
name: work-until-grill
description: Work autonomously on a task until completion or a consequential unresolved user decision, then use grill-form. Use when the user asks to work independently and return only when their judgment is needed.
---
# Work until grill

You have been given a task or a goal. Work on it autonomously based on the
project's instructions and checkpoint, preserving agreed scope and constraints.
Conform to [jstack's conventions](../../references/stack-contract.md).

Investigate discoverable facts through code, tools, sources and tests.

Carry work through implementation, verification, and records following
the project's standards. Keep progress updates infrequent and concise.

## Return when decision is necessary

Ask for human input when work hits a significant or meaningful blocker, and
progress depends on a consequential preference, missing constraint, conflicting
requirement or scope choice that existing records cannot resolve.

Collect input with [grill-form](../grill-form/SKILL.md), following its lifecycle.
Use further rounds only when consequential uncertainty remains. When the tension is
finally resolved, resume working autonomously.

## No premature stoppage

If authorized work remains that needs no user input, you must continue.
Milestones, commits, passing tests and checkpoints are progress updates,
not reasons to stop.

Only pause or stop when:
- the requested outcome or tasks are complete
- user input or approval is required
- the user/system stops execution
- an external blocker leaves us with no continuable work

## Closing up

At completion, report the result, verification and material limits.
If interrupted, leave a checkpoint with the next concrete action.
