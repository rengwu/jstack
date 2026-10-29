---
name: grill-form
description: Run batched decision interviews and visual reviews, then interpret the feedback. Use when the user requests grill-form or a grill form through Fungi.
---
# Grill form

Read and follow [fungi](../fungi/SKILL.md) for availability, presentation, and response collection before preparing a round.

## Prepare the round

Establish what the user needs to decide or review. For decision interviews, use [grill-me](../grill-me/SKILL.md) and [plan](../plan/SKILL.md) when available; otherwise ask consequential unresolved questions and recommend an answer when useful. For design critique, show the design and invite open feedback. Reuse settled context.

Write a UTF-8 JSON file in a unique temporary directory. Use [authoring](references/authoring.md) for the schema, previews, and examples. Keep rounds to 1–10 items. Show the design being judged when appearance matters; allow notes and partial feedback. Unanswered items remain unresolved.

## Present the form

Run the prepared [assembler](scripts/assemble.mjs) with Node.js 22+ and the installed `fungi-ui` sibling. It handles the UI components; no per-round UI development or reading of the component guide is needed:

```sh
node /absolute/path/to/grill-form/scripts/assemble.mjs --input /absolute/path/to/questions.json
```

Use the returned `html` and `input` paths and the delivery mode/tool settings chosen above:

```sh
fungi open /returned/bundle/form.html --input /returned/bundle/input.json --delivery DELIVERY_MODE
```

Keep the returned bundle for the session and any reopening. Prefer a 1200 × 900 window unless the user requests another size; add sizing flags only when supported by the installed CLI. Older builds use their default size.

## Interpret the feedback

For a submitted result, require `data.schema: grill-form/v1`. If the schema is unrecognized, preserve the result and report incompatibility before interpreting it.

`data.answers` includes the original question, selected label, notes, `status`, final prototype `states`, and comments. A comment’s `state` is its own captured view; it may differ from final `states`. `status: untouched` is unresolved, never approval. Images use inline `[Image #N]` references and `artifact` keys; preserve their positions when interpreting the notes.

## Continue the work

Distinguish submitted feedback from accepted decisions. Record accepted outcomes and important open questions in the target project’s existing notes, with relevant evidence. Do not create a wiki just to run a form.

Use another round when consequential questions remain; otherwise continue the original task. A changed sample or preview setting is feedback, not automatically a request to change the product.
