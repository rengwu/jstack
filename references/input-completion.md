# Input completion

Both skills expose `wait.command`: one local process stays silent until submission, then prints the collector's JSON result and exits. It needs no harness API. A background-task notification or a single pending tool call can deliver that result to the agent. Follow [the shared selection policy](stack-contract.md#completion-and-waiting); a detached process by itself cannot wake an agent.

The default local deadline is one hour; `--timeout-seconds N` accepts 1–86400. Shorten it to fit the host's tool limit. Timeout, manual collection, or interruption never deletes the submission and never starts another wait. Closing the capture panel keeps its draft; a local waiter can still receive it if reopened and submitted before its deadline.

## Optional delivery helper

`completion.command` runs the shared Node helper:

```sh
node PLUGIN_DIR/scripts/input-completion.mjs start --session SESSION_DIR
```

It detects the session kind, starts its existing collector once, and sends one notice when it receives a valid submission. Node built-ins only: no server, packages, account setup, or persistent service. An exclusive `completion.json` in the session prevents duplicate attempts and records completion or delivery failure. Read it only for recovery, not as an agent polling loop. `armed` confirms the waiter was launched, not that future delivery is guaranteed. `fallback` means no new waiter was launched; its reason distinguishes missing adapter support from an existing attempt.

The bundled optional adapter uses `CODEX_THREAD_ID` and an installed `codex queue --thread ... --message ...` command. It probes CLI support before launching; older versions remain usable through the other routes. It targets the exact originating conversation and never searches for a latest thread. A notice contains the session path, not the answers; the resumed agent collects and validates them normally.

Other integrations can pass `--notify JSON_ARGV`; an argument exactly equal to `{message}` is replaced with the notice. Arguments are executed directly, never interpreted as shell code. This extension is optional; do not make the user install an integration. `--downloads` and `--answer` preserve grill-form's custom download location, and `--timeout-seconds` overrides the local deadline. A failed notifier is not retried: the original session remains collectible with “done.”

## Compatibility evidence

Checked 2026-10-13. Capabilities vary by version; inspect the current tool contract rather than assuming that every background process sends a completion event.

| Harness | No-setup route | Evidence and limits |
| --- | --- | --- |
| Codex | Bundled queue adapter when available; otherwise native completion or one pending tool call | CLI 0.162.1: a real grill-form submission woke the originating idle conversation and its answers were collected and finished. A process ID from the terminal tool alone is insufficient. |
| Claude Code | Run `wait.command` through background Bash, using its completion notification | [Background Bash](https://code.claude.com/docs/en/interactive-mode#background-bash-commands) is documented. Completion events are also described in the [upstream tracker](https://github.com/anthropics/claude-code/issues/18544). Not exercised in a live model session here; the subscription is unavailable. |
| OpenCode | Run `wait.command` through one pending Bash call, within that version's timeout; use native background completion if the installed tools expose it | [Bash](https://opencode.ai/docs/tools/#bash) is built in. The [upstream implementation](https://github.com/anomalyco/opencode/blob/dev/packages/core/src/tool/bash.ts) has bounded synchronous execution. CLI 1.18.34 was inspected locally, but no live model handoff was tested. This route resumes from a pending call, not an ended turn. |
| Other local harnesses | Use their completion capability or one pending call; otherwise “done” | No universal idle-conversation wake-up API is assumed. Cursor and Gemini CLI were not live-tested. |

Tests exercise silent receipt, isolation, duplicate attempts, timeouts, cancellation through collection, delivery failure, and preservation of files. Helper tests establish local behavior, not a live harness handoff. Keep those claims separate.
