# Prepared page

The bundled [page](../assets/outcome.html) needs only this input:

```json
{
  "schema": "outcome/v1",
  "id": "result-1",
  "title": "Result",
  "markdown": "Your response."
}
```

Use the [workflow assembler](../scripts/assemble.mjs) and [launch instructions](../SKILL.md). Install `show-outcome`, `fungi-ui` and `fungi` as siblings. Node.js 22+ assembles a retained page bundle containing the shared components and this workflow's composition; the source HTML is a template, not a standalone entry point.

## Input

| Field | Format |
| --- | --- |
| `schema` | `outcome/v1` |
| `id` | Distinct report ID: 1–80 letters, digits, underscores or hyphens; starts with a letter/digit |
| `title` | Required, up to 200 characters |
| `projectName` | Optional label |
| `markdown` | Required, up to 900,000 characters; Fungi's overall input limit also applies |
| `nextSteps` | Optional array of `{id,label,recommendation?}` actions; unique IDs use the same format as the report ID, labels are nonempty and at most 1,000 characters. Optional `recommendation` is a nonempty plain-text reason, at most 1,000 characters |

Markdown supports tables, code and fenced Mermaid. Diagrams render offline without configuration directives, links or external images. Raster images use PNG/JPEG/GIF/WebP data URLs; remote/file/SVG image URLs are not loaded. Raw HTML displays as text. Web links display their labels and URLs.

The report is followed by selectable next steps when supplied, then Notes. Next steps start unchecked and support multiple selections. Use action labels such as “Decide the note-import scope” instead of leaving recommended work only in a prose list. Keep the report’s context, but avoid duplicating the selectable list. Questionnaire input is not supported.

An action with `recommendation` shows a “Recommended” marker and its reason beneath the label. Put the strongest next action first and explain why it should come next; recommend multiple actions only when they are useful together. An omitted recommendation leaves an ordinary choice, and never changes selection behavior.

## Feedback

Submitted data has `schema: outcome/v1`, `outcomeId`, `title`, `selectedNextSteps` and one `answers` entry with `questionId: outcome-notes`. Each selected step contains its original `id`, `label` and optional `recommendation`, in report order. Match `outcomeId` to the report and read both the selections and `notes`. Selections request which work to pursue; they are not answers to that work’s unresolved questions. An empty selection does not reject the proposed work.

Pasted images appear as clickable inline chips in Notes and serialize as `[Image #N]`. Each `images` entry supplies its `id`, text `offset`, `mimeType` and `artifact` key. Match keys to Fungi's returned artifacts and inspect the images alongside their text. Notes and pasted images use Fungi's advertised JSON, per-artifact and aggregate artifact byte budgets, without a separate text-length or image-count cap.

A selection can submit without Notes, and Notes can submit without a selection. With neither, submission is disabled. Selection changes, Notes and images share normal draft persistence and collection. Earlier report-only drafts without `selectedNextSteps` restore with nothing selected. Old combined-round drafts remain incompatible and are preserved for recovery.
