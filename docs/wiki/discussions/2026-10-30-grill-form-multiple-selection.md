---
title: Grill-form multiple selection and content limits
section: Discussions
updated: 2026-10-30
status: Accepted
---
# Grill-form multiple selection and content limits

The user reported being unable to choose several proposals in a grill-form and requested a solution. They also rejected arbitrary limits for a tool intended to handle generic work. They subsequently accepted this proposal and authorized implementation. The behavior is implemented locally; see the [verification run](../verification/runs/2026-10-30-grill-form-multiple-selection.md) for the tested scope.

## Findings before implementation

Source inspection at `b94c1ac` shows that `skills/grill-form/assets/form.mjs` renders radio controls and stores one `choiceId` per question. Its model and draft validation share that assumption. The shared `fungi-ui` control already accepts `type: 'checkbox'`.

The model rejects more than ten questions or eight options. It also imposes separate text, preview-state, comment-count, image-count, and image-size limits. The transport separately checks Fungi's advertised JSON, per-artifact, and aggregate artifact byte budgets. The questionnaire count caps are jstack rules, not requirements of that transport. The screenshot shows radio choices inside a preview; the original session input has not been inspected.

## Accepted behavior

- Add `selection: "single" | "multiple"` to choice questions, defaulting to `single` for existing inputs. Reject unknown modes instead of silently falling back.
- Render multiple-selection questions with checkboxes and a short “Select all that apply” instruction. Users can select several items, toggle any off, and clear the selection. Label, card, keyboard, and preview interactions must toggle exactly once.
- Preserve all selections through draft saving, cancellation, reopening, and submission. Nothing starts selected. An empty selection with no other feedback remains unresolved; it does not mean “none” or approval.
- Allow “Something else” alongside other selections, with an explanation required. Preserve the existing notes, comments, partial-feedback, and required-feedback semantics.
- Use multiple selection when several independent proposals can be chosen. Use single selection when the decision actually requires one answer. Ordinary choices belong in the prepared form rather than custom selection controls inside a preview.

## Content limits

Remove hard upper bounds on question and option counts. Raising eight to twenty was an initial suggestion in the conversation and was rejected in favor of removing arbitrary caps.

Apply the same policy to inherited content caps: remove arbitrary per-field lengths and comment/image counts or size ceilings that merely duplicate lower fixed budgets. Enforce the installed runtime's actual advertised JSON and artifact limits, valid data types, unique identifiers, valid image data, and consistent references. Report an actual exceeded budget clearly and preserve editable input and the last acknowledged draft; do not truncate content silently.

Keep advice about focused rounds as authoring guidance, separate from schema acceptance. Align grill-form instructions and relevant interview guidance so agents do not recreate removed caps. Audit the shared notes editor and preview bridge as well as the model: removing a validator alone would leave hidden restrictions. Shared changes must preserve other workflows' behavior and be checked there too.

No fixed pagination threshold or configurable count-limit subsystem is proposed. Use the existing scrolling layout; address demonstrated performance or navigation problems separately.

## Result contract and compatibility

Use `grill-form/v2` for newly generated results, with `selection`, `choiceIds`, and `choices` on answers. Arrays hold every selected ID and its matching label in option order; single-selection answers contain at most one entry. This gives consumers one representation without discarding additional selections. Reject duplicate or unknown selected IDs.

Update the skill's result interpretation with the contract. Continue interpreting retained v1 results and restore compatible v1 drafts by converting their scalar choice to an array while retaining notes, images, states, and comments. Preserve old retained bundles and their original inputs. Version handling must fail explicitly on unsupported formats rather than reading multiple selections as an unanswered item.

## Implementation and verification scope

Update the workflow model, form interactions, draft/result transport, authoring examples and instructions, and relevant shared controls/editors. Follow the existing [Fungi workflow boundary](../features/fungi-workflows.md); Fungi retains session and completion ownership.

Use the [existing test and native verification setup](../verification/setup.md). Cover mixed single/multiple/review questions, independent toggle and clear actions, “Something else” with other selections, untouched versus explicit feedback, invalid IDs/modes, v1 draft/result compatibility, and cancel → reopen → submit without lost choices. Include rounds larger than the former question/option caps, content beyond removed field caps, and actual runtime-budget failures. The verification run records the executed checks and their limits.

The plugin manifest is now `0.4.0` for the changed result contract. Shared Notes and image feedback in show-outcome also use runtime budgets; its report-input schema is unchanged. Diagram renderer bounds remain rendering safeguards with source fallback, not questionnaire rejection or truncation. The [feature record](../features/fungi-workflows.md) is the authoritative current behavior; this discussion preserves the accepted design and earlier findings.
