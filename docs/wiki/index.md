---
title: jstack development
updated: 2026-10-30
---
# jstack development

Development decisions, findings, open questions, and verification evidence for jstack.

## Development notes

- [Features](features/index.md) — expected behavior and verification recipes.
- [Fungi workflows in jstack](decisions/fungi-workflows.md) — the self-contained daily-use bundle and replacement of the browser-based grill-form.
- [Grill-form multiple selection and content limits](discussions/2026-10-30-grill-form-multiple-selection.md) — accepted checkbox support and removal of arbitrary content caps.
- [jstack icon](discussions/2026-10-30-jstack-icon.md) — the accepted realistic cairn icon, its assets and manifest fields, and the three review rounds.
- [Fungi verification setup](verification/setup.md) — local tests, native workflow checks, and portable installation checks.
- [Fungi import verification](verification/runs/2026-10-29-fungi-import.md) — results for this migration.
- [Screencap archive verification](verification/runs/2026-10-30-screencap-archive.md) — preserved files and separate active/archive checks after deprecation.
- [Development wiki policy](decisions/development-wiki.md) — the accepted scope and tracking policy for this wiki.
- [Windows agent workflow feedback](discussions/2026-10-21-windows-agent-workflow.md) — observed friction, proposed improvements, what worked, and suggested priorities.

## Rich authoring history

The following records document the October 2026 grill-form rich-authoring interview and implementation. They were originally added under an interview-specific exception and remain part of the development history.

- [Accepted decisions](decisions/index.md)
- [Open questions](discussions/open-questions.md)
- [Round-one answers](journal/2026-10-05-grill-863620f9-6754-4523-a4d4-df829ac2de6a.md)
- [Round-two answers](journal/2026-10-05-grill-1524864d-d2c2-4cca-b2c1-c5541d50db4f.md)
- [Round-three answers](journal/2026-10-05-grill-911b2856-2c6c-45f9-8e4a-588835770d99.md)

The interview is complete. Rich forms are the initial scope; matching wiki rendering is a separate follow-up.

The user subsequently authorized implementation. The initial rich-form feature is now implemented locally: Markdown descriptions, tables, code blocks, the three agreed Mermaid diagram types, expansion and scrolling, error fallback, and original-source preservation. The authoring entrypoint gained one capability sentence and a linked reference. Matching wiki rendering remains deferred.

Validation on 2026-10-06: all 35 repository tests passed with the optional offline Chrome test enabled. The subsequent narrow-screen diagram sizing adjustment passed the browser test again. Desktop and mobile screenshots were visually reviewed. All seven skill frontmatter checks and plugin validation passed. These checks cover the current local changes; they do not claim compatibility with every browser.
