---
title: Windows agent workflow feedback
section: Discussions
updated: 2026-10-21
status: Proposed
---
# Windows agent workflow feedback

Recorded at the user's request after a Windows compatibility review and a live grill-form questionnaire. Most agent friction came from environment setup, launching the form, and coordinating the handoff. The live submission succeeded, including automatic notification, collection, preservation of feedback, and cleanup.

## Context

The review used jstack revision `ac01535`, Windows PowerShell, and an existing Node.js 24.11.0 runtime invoked by absolute path. Browser checks used Edge and Helium; the user completed the live questionnaire in Helium. Screencap was excluded.

The eight-question “Midnight Market” demo exercised single-choice answers, Markdown tables and code, diagrams, visual options, an interactive preview, region comments, and pasted image notes. This is feedback on the agent's experience with that workflow, rather than a claim that every Windows scenario passed.

## Friction and proposed improvements

| Area | Observed friction | Proposed improvement |
| --- | --- | --- |
| Runtime discovery | `node` was not on PATH. The agent had to locate an existing runtime before running the CLI. | Add a short prerequisite check with a clear error and recovery instructions. Make the supported Node version easy to find. |
| PowerShell invocation | The creation example uses a Bash heredoc. Returned command strings use POSIX quoting and fail to parse in PowerShell. The existing `argv` interface worked. | Document a PowerShell creation example and make argument arrays the primary execution interface for runners. Retain shell-specific strings as conveniences. |
| Browser launch | Opening the file through Windows' default association stalled. Launching the same default browser, Helium, directly succeeded. | Offer an optional opening helper with a bounded timeout, an explicit browser override, and a clear fallback to the HTML path. |
| Handoff orchestration | The agent coordinated create, open, arm completion, collect, and finish as separate steps. | Consider convenience operations such as `present` and `collect --finish`. Preserve individual commands for recovery, session identity checks, and verification of saved output before cleanup. |
| Rich-preview authoring | The showcase required substantial custom HTML and JavaScript for visual choices, controls, and state capture. | Include a small set of reusable examples: visual comparison, slider/settings preview, and an annotated layout. Keep them compatible with the prepared offline template. |
| Test portability and readiness | Unix executable stubs, `/bin/sh`, path-separator assumptions, and unavailable symlink permissions obscured product behavior. Fixed browser delays and transition-sensitive assertions produced additional failures. | Make fixtures portable, report unsupported prerequisites clearly, and wait for observable rendering, interaction, and download completion instead of fixed delays. |
| Feedback readability | Detailed region coordinates are useful for replay but make collected output harder to scan. A comment can capture different settings from the final preview. | Lead with selected answers, changed settings, comment text, and image paths. Keep full geometry available and explicitly label comment-time state versus final state. |

The convenience-command names are suggestions, not an agreed interface.

## What worked well

- The submission notification reached the originating conversation automatically.
- Collection used the exact session, with feedback from other sessions kept separate.
- Choices, free text, prototype settings, and region comments were preserved.
- The pasted PNG was saved, opened, and inspected, with its accompanying text retained.
- An untouched question remained unanswered.
- Finish saved a transcript and an offline review before removing the temporary session and matching answer download.

The live round provided a useful state-preservation example: the final preview used a **40 px heading, mint accent, Books, and Snacks**. A comment on that preview retained its earlier **30 px, lavender** state. That distinction is valuable and should remain visible to the interpreting agent.

Both region comments worked in the live round despite intermittent failures in the earlier automated browser checks. This confirms the exercised live interaction; it does not resolve the cause of the automated failures.

## Suggested priority

1. **Windows invocation and test reliability.** Improve runtime guidance, PowerShell instructions, portable fixtures, and readiness checks.
2. **Fewer orchestration steps.** Add convenience operations once the underlying behavior is reliable, retaining recoverable individual steps.
3. **Authoring and interpretation ergonomics.** Add reusable preview examples and a concise feedback summary without losing detailed state.

Retain the offline HTML-and-download approach. It worked in the live test, including notification and image handling.

Some agent effort belonged to the compatibility investigation: disposable QA sessions, temporary Windows-native notification stubs, and inspection of implementation details. Those should not become routine prerequisites for presenting a questionnaire.

## Related records

- [Wiki home](../index.md)
- [Earlier rich-authoring decisions](../decisions/index.md)
- [Earlier rich-authoring open questions](open-questions.md)
