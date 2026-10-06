# Rich question descriptions

Write the description in the existing JSON `context` string. Only this field renders Markdown; the title, question (`prompt`), recommendation, and option labels stay plain text. The layout remains question → description → recommendation → options. Use rich content when it makes the decision easier to understand; ordinary prose is fine.

| Content | Syntax and support |
| --- | --- |
| Prose | Paragraphs, headings, bold, emphasis, strikethrough, lists, blockquotes, horizontal rules |
| Comparisons | GFM pipe tables, including column alignment |
| Code | Inline backticks and fenced code blocks; no syntax highlighting |
| Links | Explicit `https://` or `http://` links open separately; rendering itself stays offline |
| Diagrams | Fenced `mermaid` blocks: `flowchart`/`graph`, `sequenceDiagram`, `stateDiagram`/`stateDiagram-v2` |

Raw HTML is displayed as text. Images show their alt text only. Relative links, HTML styling, Mermaid configuration/frontmatter/directives, external assets, and other diagram types are outside this contract. Use standard Markdown rather than adding custom markup or renderer code.

## Example

The CLI still accepts JSON on stdin. Use `\n` for newlines inside JSON strings; no separate Markdown file or `body` field is needed.

```json
{
  "title": "Publishing workflow",
  "questions": [{
    "number": 1,
    "prompt": "When should edits go live?",
    "context": "Compare the two workflows:\n\n| Choice | Benefit | Cost |\n| --- | --- | --- |\n| Publish explicitly | Review before release | One extra action |\n| Publish automatically | Immediate updates | Mistakes go live immediately |\n\nProposed review flow:\n\n```mermaid\nflowchart LR\n  Edit --> Preview\n  Preview --> Publish\n```",
    "recommendation": "Publish explicitly so editors can review changes.",
    "options": ["Publish explicitly", "Publish automatically"]
  }]
}
```

Descriptions allow up to 12,000 characters and preserve their source whitespace. Keep diagrams readable and within 150 edges. The form can expand descriptions and scroll wide content. Unsupported or invalid diagrams show an error and their source; the user can still answer and submit.

Inspect rich forms in the browser before handing them over, especially diagrams and wide tables. Correct any authoring errors rather than relying on the fallback. Do not submit synthetic answers to a real interview.

The saved transcript includes the original description source inside a protective code fence, alongside the question and answer. Matching wiki diagram rendering is deferred; do not rewrite the source or upgrade the wiki as part of an interview.
