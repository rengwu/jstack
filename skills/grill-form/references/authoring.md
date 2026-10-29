# Authoring

Write JSON, run the workflow’s assembler, then open the returned page. See the [launch instructions](../SKILL.md). Do not develop a new page per interview. The source HTML composes shared components and must be assembled with the sibling `fungi-ui` kit.

```json
{
  "projectName": "My project",
  "title": "Release decisions",
  "questions": [{
    "id": "scope",
    "prompt": "Which scope should we ship first?",
    "recommendation": "Start with the core flow so we can observe real usage.",
    "options": ["Core flow", "Full workflow"]
  }, {
    "id": "improvements",
    "prompt": "Which improvements should we explore?",
    "selection": "multiple",
    "options": ["Search", "Activity overview", "Workspace recipes"]
  }, {
    "id": "concerns",
    "prompt": "What would block you from using this?"
  }]
}
```

Use as many questions and options as the task needs. Prefer focused rounds for readability; this is guidance, not a count limit. `number` can continue a prior round. IDs are optional; explicit IDs use letters, digits, `_` and `-`, and start with a letter/digit. `other` is reserved. Options can be strings or `{id,label,preview}` objects. Set `selection: "multiple"` for checkboxes when several choices can apply; omit it or use `"single"` for radios when one answer is needed. Unknown modes are rejected. Notes and “Something else” are built in; the latter can accompany other checkboxes and needs an explanation. No answer is selected by default.

Each item needs a `prompt`, `context`, or `preview`. Recommendations and choices are optional. `required:true` is for an answer necessary to proceed; otherwise partial feedback is accepted. Empty items remain unresolved, and a completely blank form cannot submit.

`context` supports offline Markdown, tables, code and fenced Mermaid diagrams through bundled Marked, DOMPurify and Pele. Raw HTML is text. Omit diagram configuration directives, links, external images and custom icons. External navigation is disabled.

`preview:{html,height,state}` shows a sandboxed inline frame. Height is a positive integer in pixels (default 280); state is a JSON object. Include the preview’s own styles. Embed SVG or raster data URLs. External scripts, styles, fonts, requests and nested frames are blocked. For interactive controls, read `window.fungiPreview.state` and call `window.fungiPreview.setState({...})` (the existing `window.grill` alias also works) with the complete state when a meaningful value changes. DOM changes alone do not persist. Avoid clocks and randomness when the submitted view must be reproducible.

Open previews support region comments; option previews toggle a checkbox or select a radio. Use native options for ordinary choices instead of recreating selection controls in a preview. Notes and comments accept pasted PNG/JPEG/GIF/WebP images, represented by numbered chips. Review [examples.json](../assets/examples.json) for visual options, a stateful control and region feedback. Example content is not a project decision.

There are no fixed field-length, question, option, comment, or image-count caps. Fungi’s advertised JSON and artifact byte budgets apply; the runtime also accounts for retained artifacts. A rejected save keeps the editor content and the last acknowledged draft available. Reduce the payload or split the round if a runtime budget is exceeded; content is never silently truncated. Diagram rendering can fall back to its preserved source if its renderer cannot handle a definition. Drafts save after a short typing pause; only the “Draft saved” acknowledgment establishes persistence.

## Results and drafts

New results use `grill-form/v2`. Each answer has `selection`, `choiceIds` and matching `choices` arrays in option order, alongside notes, comments, preview states and status. Single-selection answers have zero or one choice. Empty selections with no other feedback are `untouched`, not an explicit rejection or approval. Selecting “Something else” requires notes or a comment. `required` still requires feedback, which can be notes or comments rather than a choice.

Selections save and restore with the rest of the draft. Retained v1 results use `choiceId` and `choice`; compatible v1 drafts are converted when restored by the new page. Unknown schemas, changed selection modes, duplicate selected IDs and unavailable choices fail explicitly. Keep older retained bundles and inputs for reopening.
