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
    "id": "concerns",
    "prompt": "What would block you from using this?"
  }]
}
```

Use 1–10 questions, up to 8 options per question. `number` can continue a prior round. IDs are optional; explicit IDs use letters, digits, `_` and `-`, start with a letter/digit, and have at most 80 characters. `other` is reserved. Options can be strings or `{id,label,preview}` objects. Notes and “Something else” are built in; the latter needs an explanation. No answer is selected by default.

Each item needs a `prompt`, `context`, or `preview`. Recommendations and choices are optional. `required:true` is for an answer necessary to proceed; otherwise partial feedback is accepted. Empty items remain unresolved, and a completely blank form cannot submit.

`context` supports offline Markdown, tables, code and fenced Mermaid diagrams through bundled Marked, DOMPurify and Pele. Raw HTML is text. Omit diagram configuration directives, links, external images and custom icons. External navigation is disabled.

`preview:{html,height,state}` shows a sandboxed inline frame. Height is 64–1200 pixels (default 280); state is a JSON object. Include the preview’s own styles. Embed SVG or raster data URLs. External scripts, styles, fonts, requests and nested frames are blocked. For interactive controls, read `window.fungiPreview.state` and call `window.fungiPreview.setState({...})` (the existing `window.grill` alias also works) with the complete state when a meaningful value changes. DOM changes alone do not persist. Avoid clocks and randomness when the submitted view must be reproducible.

Open previews support region comments; option previews select an option. Notes and comments accept pasted PNG/JPEG/GIF/WebP images, represented by numbered chips. Review [examples.json](../assets/examples.json) for visual options, a stateful control and region feedback. Example content is not a project decision.

Limits inherited from jstack: title 200 characters; prompt 2,000; recommendation 3,000; option label 1,000; notes/context/state 12,000; 20 comments per item; 20 images with 5 MiB per image and 20 MiB total. The runtime’s advertised JSON and artifact limits also apply and can be lower. Split large rounds rather than changing the transport limits. Drafts save after a short typing pause; only the “Draft saved” acknowledgment establishes persistence.
