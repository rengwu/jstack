---
title: Grill-form rich authoring
updated: 2026-10-06
---
# Grill-form rich authoring

Design discussion for extending grill-form. These records are here under the user's explicit exception for this interview; the normal project-target rules remain unchanged.

- [Accepted decisions](decisions/index.md)
- [Open questions](discussions/open-questions.md)
- [Round-one answers](journal/2026-10-05-grill-863620f9-6754-4523-a4d4-df829ac2de6a.md)
- [Round-two answers](journal/2026-10-05-grill-1524864d-d2c2-4cca-b2c1-c5541d50db4f.md)

- [Round-three answers](journal/2026-10-05-grill-911b2856-2c6c-45f9-8e4a-588835770d99.md)

The interview is complete. Rich forms are the initial scope; matching wiki rendering is a separate follow-up.

The user subsequently authorized implementation. The initial rich-form feature is now implemented locally: Markdown descriptions, tables, code blocks, the three agreed Mermaid diagram types, expansion and scrolling, error fallback, and original-source preservation. The authoring entrypoint gained one capability sentence and a linked reference. Matching wiki rendering remains deferred.

Validation on 2026-10-06: all 35 repository tests passed with the optional offline Chrome test enabled. The subsequent narrow-screen diagram sizing adjustment passed the browser test again. Desktop and mobile screenshots were visually reviewed. All seven skill frontmatter checks and plugin validation passed. These checks cover the current local changes; they do not claim compatibility with every browser.
