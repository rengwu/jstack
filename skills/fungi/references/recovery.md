# Recovery and diagnostics

Preserve the exact session receipt and environment.

| Outcome | Action |
| --- | --- |
| `pending` | End the turn; collect again only on a new completion cue or explicit user request. |
| `closed` | No answer. Explain that an acknowledged draft may be recoverable; reopen only when requested. |
| `cancelled` | No answer. Respect cancellation; do not automatically launch another interface. |
| `failed` or command error | Preserve the diagnostic and worker-log path. Use `fungi doctor` and `fungi help installation` for launch/runtime failures, or the relevant installed help topic. Do not repeatedly relaunch. |
| Unknown protocol or outcome | Preserve the result and report incompatibility. The calling workflow separately validates its data schema. |

Explicit recovery uses `fungi reopen SESSION --delivery DELIVERY_MODE` with the original `collectEnv` and the host's selected delivery mode/tool settings. This creates a new linked session from the original input and last acknowledged draft. Store its new receipt, or consume the final result directly for `wait`; the original result remains unchanged. Active and submitted sessions cannot be reopened. After an interruption, explain what happened before offering recovery.

Do not automatically install, update, rebuild, change system settings, or switch to a browser to repair an unavailable runtime. Keep the failure visible and give the relevant setup step.

For a bug report, retain the workflow revision or hashes, Fungi version/executable, OS, receipt, triggering action, expected/observed behavior, and result or diagnostic. Distinguish a callback being armed from its notification actually reaching the conversation. Keep private responses and attachments out of shared records unless relevant and authorized.

Classify workflow/schema/UI defects separately from native-window, bridge, persistence or delivery defects; unclear ownership remains unresolved until reproduced. Record findings in the target project. Upstream edits or external reports require authorization from the enclosing task.
