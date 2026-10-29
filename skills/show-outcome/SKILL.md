---
name: show-outcome
description: Present results in a Fungi window with optional feedback and a detailed, slightly shorter CLI summary. Use when requested or when useful in a conversation where the user has enabled show-outcome.
---
# Show outcome

Read [fungi](../fungi/SKILL.md) for presenting an interface and receiving feedback.

Present the response you would otherwise give in a Fungi window. Choose the content, structure and visuals freely to suit the task. Once enabled, use your judgment about when an outcome is useful for the rest of the conversation. When in doubt, use it.

Make clear what was accepted, what remains proposed, and what was actually implemented or checked.

Use the prepared interface and its [input format](references/authoring.md). Focus on the problem and the response; the assembler handles UI components and the page always provides optional Notes. Keep questionnaires and spikes in their own sessions.

Prefer a 1200 × 900 window unless the user requests another size; add sizing flags only when supported by the installed CLI. Older builds use their default size.

When recommending next work, put the actionable items in `nextSteps` so the user can select them directly. Use short action labels and avoid repeating the same list in the prose. Multiple items can be selected; Notes are not required.

Recommend the strongest next action with a short `recommendation` reason on that item and put it first. Recommend several only when doing them together is useful; omit recommendations when there is no justified preference. The page shows “Recommended” and the reason without preselecting the action.

Keep a detailed summary in the CLI, only slightly more concise than the window's content, so its conclusions, reasoning, caveats and next steps remain traceable. If the window fails to open, explain briefly and give the result in the CLI.

Reading needs no acknowledgment; submitting feedback closes the window. Read Notes and `selectedNextSteps` against the outcome the user saw, even if newer work has happened. Selected items request next work; they do not answer the underlying design questions. Unselected items and closing without feedback establish no decision.

Continue from the feedback. Receiving feedback or dismissing a window does not itself need another outcome.

## Prepared-page example

Save as `outcome.json`:

```json
{
  "schema": "outcome/v1",
  "id": "round-1",
  "title": "Outcome",
  "markdown": "The changes are ready for review.",
  "nextSteps": [
    {"id": "review", "label": "Review the layout", "recommendation": "Confirm the visual direction before checking the remaining scenarios."},
    {"id": "verify", "label": "Check the remaining scenarios"}
  ]
}
```

Run the prepared [assembler](scripts/assemble.mjs) with Node.js 22+ and the installed `fungi-ui` sibling. Reading its component guide is unnecessary for routine use:

```sh
node /absolute/path/to/show-outcome/scripts/assemble.mjs --input /absolute/path/to/outcome.json
```

Launch the returned `html` and `input` paths with the shared skill's chosen delivery mode and tool settings. Keep the bundle for the session and any reopening.

```sh
fungi open /returned/bundle/outcome.html --input /returned/bundle/input.json --delivery DELIVERY_MODE
```
