---
title: Development wiki policy
section: Decisions
updated: 2026-10-21
status: Accepted
---
# Development wiki policy

On 2026-10-21, the user confirmed that jstack should have a wiki for relevant development information.

## Decision

Maintain `docs/wiki/` as jstack's development wiki. Track its Markdown and supporting evidence normally in Git. Ignore the locally copied reader builder and generated `index.html`; the canonical reader remains in `skills/wiki/assets/_build.mjs`.

The wiki can hold development decisions, findings, open questions, and verification evidence. Other projects retain their records in their own repositories. Generated sample wikis, random sample content, demos, and scratch sessions belong in temporary directories; their relevant findings can be documented here.

## Rationale

The user recalled that the earlier restriction was intended to stop agents from building unnecessary sample wikis with random data in this repository. The blanket exclusion also obstructed useful development notes, including the [Windows agent workflow feedback](../discussions/2026-10-21-windows-agent-workflow.md).

This decision replaces the blanket prohibition on a jstack development wiki. It preserves the distinction between jstack development information and unrelated project or sample content.

## Existing records

Preserve the earlier rich-authoring decisions and interview records as history. Their original interview-specific exception is no longer needed for future substantive development notes.

Raw grill-form output remains temporary when interviewing jstack itself. Relevant outcomes and supporting evidence can then be recorded in this wiki.

[Return to the wiki home](../index.md).
