---
title: Rich authoring open questions
section: Discussions
updated: 2026-10-06
status: Deferred
---
# Rich authoring open questions

No blocking product questions remain for the initial rich-form change.

## Deferred: matching wiki rendering

Per [DEC-011](../decisions/index.md), deliver rich forms first and plan matching wiki rendering separately. The follow-up should let preserved descriptions render with the form's supported rich formats, including its Mermaid types. The original source must be preserved in the initial change; wiki renderer changes are outside that change's scope.

## Resolved

[Decisions DEC-001 through DEC-011](../decisions/index.md) settle JSON authoring, upgrading the existing description, rich-content scope, documentation discoverability, agent discretion, initial Mermaid types, error fallback, expandable content, source preservation, and delivery scope.

## Implementation details

Renderer selection, the precise documented Markdown subset, compatibility for existing question data and saved sessions, and transcript serialization require implementation investigation. These are technical details to resolve within the accepted scope, not reasons to extend the preference interview.

Existing offline operation and the prepared-template workflow remain constraints. Implementation has not started.
