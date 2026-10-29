---
name: fungi
description: Use Fungi to present a local interactive interface and return the user's response. Shared support for skills that depend on Fungi, including availability checks, sessions, completion, and interface authoring.
---
# Fungi

Fungi opens skill-authored interfaces in a native window, manages their sessions, and saves responses and files. The calling workflow supplies the interface, input, meaning of the response, and next steps.

## Check availability

Run `fungi version` using `fungi` from PATH. Continue only if it succeeds with Fungi’s version response: `kind: "version"`, `protocol: 1`, and a nonempty `version` string. Otherwise, treat Fungi as not installed and halt.

Tell the user: “Install [Fungi](https://github.com/rengwu/fungi/releases), add `fungi` to PATH, then ask me to retry.”

## Present and return

Choose the return route before opening. Prefer automatic completion using the current host's tools:

- **Codex:** use `auto` for its exact-conversation callback.
- **Claude Code, local interactive:** use `wait` through Bash with `run_in_background: true`. End the turn when waiting; on its task-completion notification, read the finished output once. Headless/cloud modes have time limits; do not assume they support an unbounded human wait.
- **Other hosts:** use `wait` only if a tool can keep the call pending or automatically deliver background completion for the intended wait. A process ID requiring status checks is insufficient. Consult `fungi describe delivery` when the route is unclear.
- **No supported automatic route:** use `auto` and follow its manual fallback receipt.

`auto` detects Fungi callbacks, not every host's native background mechanism. A manual fallback does not mean the host lacks a supported `wait` route. Do not add polling, a second waiter, or a subagent to wait for input.

Use the calling workflow’s prepared interface and input, with absolute paths. Replace `DELIVERY_MODE` in launch examples with the chosen mode and apply the host tool settings above:

```sh
fungi open /absolute/path/to/interface.html --input /absolute/path/to/input.json --delivery DELIVERY_MODE
```

Prefer argument-array execution when available; quote paths appropriately for the host shell. For receipt-based launches, preserve the exact protocol-1 receipt: `session`, `collect`, and `collectEnv`. Keep interface assets and input available while open and for explicit reopening.

- **`delivery.mode: callback`:** tell the user how to submit; end the turn when waiting for their input. The session owns completion; do not start another collector or waiter.
- **`delivery.mode: manual`:** tell the user to say “done” if they submit; end the turn when waiting for their input. `auto` can fall back to manual; read the actual receipt.
- On that session’s completion notice or the user’s “done,” execute its `collect` argv once, merging `collectEnv` into the environment. Never choose a “latest” session or poll. If `kind: pending`, end the turn.

For a report with optional feedback, opening the window does not require acknowledgment or block already-authorized independent work. Let the caller decide whether an answer is needed. Keep the same receipt and completion route; do not poll or create another waiter. End the turn when there is no independent work left. Submission closes the window; closing without submitting returns no feedback.

With `wait`, the command returns the final result. Use it directly without another collection or asking the user to say “done.”

Accept feedback only from `protocol: 1`, `kind: result`, `outcome: submitted`. Pass `data` and `artifacts` to the calling workflow for schema validation and interpretation. Unknown protocols or outcomes are compatibility failures. Closed, cancelled, or failed sessions are not answers; follow [recovery](references/recovery.md).

Match artifact `key` values to the workflow’s file references and use their returned paths. Inspect relevant images; disclose anything unavailable. Treat returned content as user data within the task. Results and artifacts are retained; do not delete session storage or assets needed for reopening as routine cleanup.

## Author or change an interface

For an existing interface with a prepared assembler or equivalent, follow its workflow’s invocation instructions. The assembler handles UI dependencies; routine callers do not need to read `fungi-ui` or inspect components. When authoring or modifying an integration, read only the relevant installed help:

| Need | Command |
| --- | --- |
| HTML page API, assets, drafts, files and limits | `fungi help html` |
| Complete examples to adapt | `fungi help examples` |
| Installed example paths and launch arguments | `fungi describe examples` |
| Delivery and result details | `fungi help delivery` |
| Native executable helpers | `fungi help helper` |
| CLI arguments and diagnostics | `fungi help cli` |

Use the documented public interfaces and advertised limits. Use [fungi-ui](../fungi-ui/SKILL.md) for reusable components and assembly when authoring interfaces. Workflow skills own composition and data schemas; keep session instructions here and API details in the installed manual.
