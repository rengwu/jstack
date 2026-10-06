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

The implementation uses bundled prebuilt Marked, DOMPurify, and Mermaid Tiny browser distributions. The supported Markdown subset is documented in the skill's authoring reference. Existing saved sessions retain their prior normalization and transcript format; new descriptions preserve whitespace and are saved as source inside a protective code fence. These details are implemented and covered by form tests.

Existing offline operation and the prepared-template workflow remain constraints. The initial form implementation is complete locally; matching wiki rendering remains a separate follow-up.
