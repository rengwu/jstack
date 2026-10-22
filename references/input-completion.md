# Input completion

Both skills expose `wait.argv` (and a POSIX-only `wait.command`): one local process stays silent until submission, then prints the collector's JSON result and exits. It needs no harness API. A background-task notification or a single pending tool call can deliver that result to the agent. Follow [the shared selection policy](stack-contract.md#completion-and-waiting); a detached process by itself cannot wake an agent.

The default local deadline is one hour; `--timeout-seconds N` accepts 1–86400. Shorten it to fit the host's tool limit. Timeout, manual collection, or interruption never deletes the submission and never starts another wait. Closing the capture panel keeps its draft; a local waiter can still receive it if reopened and submitted before its deadline.

## Optional delivery

`completion.argv` runs the collector's `complete --session SESSION_DIR` command. A shared Node launcher checks for a notification adapter, starts that collector's `wait`, and exits after its startup acknowledgement. Only the collector remains running. The launcher knows nothing about either skill's files or submission format. It uses Node built-ins: no server, packages, account setup, or resident service.

Each collector exclusively creates one `.wait` file to prevent duplicate attempts. It holds only the latest status: waiting, stopped, timed_out, received, notified, or failed. Manual collection stops the waiter. Original submissions and receipts remain authoritative; delivery does not save another copy of the answers. Old session markers are recognized to prevent accidental restarts after an upgrade.

`armed` confirms the collector started, not that future delivery is guaranteed. `fallback` means no waiter started; its reason distinguishes an unavailable adapter from an existing attempt. An error or failed notification preserves the session for manual collection. The status file is for recovery, not agent polling.

The bundled optional adapter uses `CODEX_THREAD_ID` and an installed `codex queue --thread ... --message ...` command. It probes CLI support before launching; older versions remain usable through the other routes. It targets the exact originating conversation and never searches for a latest thread. The short notice, `screencap ready: SESSION_PATH` or `grill-form ready: SESSION_PATH`, identifies the saved submission. The resumed agent collects and validates it normally.

Internally, the launcher passes the adapter's argument array through `wait --notify JSON_ARGV`; the collector replaces an argument exactly equal to `{message}` and executes it without a shell. `complete` and `wait` both accept `--timeout-seconds`; grill-form also accepts `--downloads` or `--answer` for a custom answer location and `--details` for full comment geometry. Use argv arrays on Windows; [invocation examples](../skills/grill-form/references/usage.md#invocation) cover PowerShell and explicit Node paths.

## Waiting cost

Measured on Apple Silicon on 2026-10-13 with Node 22.19.0, disposable drafts, a stub notification adapter, and the UI closed. Each value is one idle `ps` RSS sample, not a benchmark across machines.

| Collector | Before | After |
| --- | --- | --- |
| screencap | 2 processes, 48.7 MiB | 1 process, 9.6 MiB |
| grill-form | 2 processes, 84.1 MiB | 1 process, 43.8 MiB |

The universal native executable remains about 250 KiB. Removing the resident launcher accounts for the memory reduction; startup timings are not compared because the measurements used different adapter probes.

## Compatibility evidence

Checked 2026-10-13. Capabilities vary by version; inspect the current tool contract rather than assuming that every background process sends a completion event.

| Harness | No-setup route | Evidence and limits |
| --- | --- | --- |
| Codex | Bundled queue adapter when available; otherwise native completion or one pending tool call | CLI 0.162.1: real grill-form and screencap submissions woke the originating idle conversation. Answers and the captured image with its paired note were read, then both sessions were finished. A process ID from the terminal tool alone is insufficient. |
| Claude Code | Run `wait.command` through background Bash, using its completion notification | [Background Bash](https://code.claude.com/docs/en/interactive-mode#background-bash-commands) is documented. Completion events are also described in the [upstream tracker](https://github.com/anthropics/claude-code/issues/18544). Not exercised in a live model session here; the subscription is unavailable. |
| OpenCode | Run `wait.command` through one pending Bash call, within that version's timeout; use native background completion if the installed tools expose it | [Bash](https://opencode.ai/docs/tools/#bash) is built in. The [upstream implementation](https://github.com/anomalyco/opencode/blob/dev/packages/core/src/tool/bash.ts) has bounded synchronous execution. CLI 1.18.34 was inspected locally, but no live model handoff was tested. This route resumes from a pending call, not an ended turn. |
| Other local harnesses | Use their completion capability or one pending call; otherwise “done” | No universal idle-conversation wake-up API is assumed. Cursor and Gemini CLI were not live-tested. |

After refactor `7a7c919`, both short notices independently resumed the originating Codex conversation without polling or “done.” Synthetic submissions were collected and finished. The capture fixture's invalid PNG checksum was corrected in `dcefe20`, then its image was viewed with the paired note. This checked delivery and collection; it did not repeat the native capture UI test.

Tests exercise silent receipt, isolation, duplicate attempts, timeouts, cancellation through collection, delivery failure, and preservation of files. Helper tests establish local behavior, not a live harness handoff. Keep those claims separate.
