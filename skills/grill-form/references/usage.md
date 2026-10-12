# Recovery and advanced use

Normal use needs only SKILL.md and the script's returned next action. All mechanical operations use a local Node CLI with built-ins; there is no server, package installation, build step, or agent-specific API. `next.command` is quoted for POSIX shells; `next.argv` supplies the equivalent argument array for other runners.

The host needs file access, ordinary command execution, Node, and access to the browser's downloaded answer file. Install the linked grill-me, plan, and wiki skills and shared references with their relative layout intact; copying only this skill's instructions is insufficient. Skill discovery and plugin installation use each host's own conventions. For a remote/container agent, supply an accessible download directory or explicit answer path; it cannot read a local browser's Downloads automatically.

## Polling and immediate collection

Creation returns `next.when: now` and a `poll` command. Run it immediately with an ordinary command runner. The CLI uses Node timers, checks downloads only when due, and saves its start time and completed checks in `polling.json`. The schedule is defined in [polling.mjs](../scripts/polling.mjs). Each invocation waits at most 30 seconds, then returns either a receipt, a command to continue, or a manual next action. No agent-specific wait tool, task scheduler, or background process is required.

When the user says “done,” run `next.immediate.command` once. This is the ordinary `collect` command: it writes a persistent stop marker, cancels an in-flight polling wait, and checks once. Even a missing download ends automatic polling. A receipt or polling error also stops polling. After exhaustion or expiry, `next.when` becomes `user_done`: report that polling ended, end the turn, and collect again only on user request. Do not discard the form or answers when polling ends. A stale `poll` command cannot restart a stopped session.

Re-run the same `poll` command after an interrupted process; deadlines and progress resume from disk. Missed checks are skipped after one overdue check, rather than replayed in a burst; an expired schedule stops without checking again. Unrelated user input does not reset the schedule. Explicit cancellation follows the procedure below.

For runners with a shorter command timeout, `poll --max-wait-seconds N` accepts 1–60 and preserves that limit in subsequent commands; it changes only how often the CLI returns control, not the download-check schedule. The host controls when a new chat message reaches the agent. If it queues messages behind a running command, interrupt the turn before sending “done”; a script cannot override that interface behavior.

## Resume or change the download location

```sh
node SKILL_DIR/scripts/grill-form.mjs poll --session SESSION_DIR
node SKILL_DIR/scripts/grill-form.mjs poll --session SESSION_DIR --downloads CUSTOM_DOWNLOADS --max-wait-seconds 10
node SKILL_DIR/scripts/grill-form.mjs collect --session SESSION_DIR
node SKILL_DIR/scripts/grill-form.mjs collect --session SESSION_DIR --downloads CUSTOM_DOWNLOADS
node SKILL_DIR/scripts/grill-form.mjs collect --session SESSION_DIR --answer EXACT_FILE
```

The default is `~/Downloads`. `collect` checks once and returns a manual next action if no download exists. Both next commands preserve a custom download location or explicit answer path. Already-collected answers return from the receipt, so an interrupted turn can resume. An unfinished/invalid answer file produces an error and remains untouched; retry on user request after the browser finishes saving it. Older saved commands containing `--wait-seconds` or `--poll-step` must omit those removed options and use manual collection; do not reconstruct an old schedule from conversation memory.

The static form cannot notify an ended agent turn or confirm receipt. Browser download settings may require choosing a save location. **Download and close form** starts the same answer download and requests tab closure; browsers may refuse to close a tab they did not open through a script. If it stays open, the form tells the user to save the file and close it manually. Closing the tab does not confirm a download; only the collector validates receipt. Draft recovery on file URLs depends on browser storage support.

## Finish

```sh
node SKILL_DIR/scripts/grill-form.mjs finish --session SESSION_DIR
```

Finish requires a collected receipt. It writes and rereads a transcript at `PROJECT/docs/wiki/journal/DATE-grill-SESSION_ID.md` before cleanup. The transcript records submitted answers, not accepted decisions; grill-me/plan must interpret it, link it into the wiki, and build/check the reader. Use this journal as the round's source rather than creating another raw-answer record.

Matching answer downloads, the temporary HTML, session state, and receipt are then removed. Unrelated downloads remain untouched. A retry reuses an identical transcript; an edited transcript stops cleanup so no newer work is overwritten. Validation failures can leave a saved transcript and the original temporary files intact.

Common errors:

| Error | Recovery |
| --- | --- |
| Missing project / ENOENT during create | Use the correct existing target directory; create it only within the user's authorized scope. Never substitute jstack's source directory. |
| Invalid question data | Correct the named field and rerun create; validation happens before any temporary session is created. |
| Different session or question revision | Use the answer download from this exact form. |
| Conflicting submissions | Ask which submission is intended, then collect with `--answer EXACT_FILE`. Preserve conflicting copies until resolved. |
| Changed answer/transcript, symlink, or unexpected session files | Preserve the files and report the conflict. Do not bypass checks or use broad deletion. |
| Session created by an older skill version lacks a project | Preserve its answer files and recover through the previous version or an explicitly requested migration. Do not invent a destination. |

Errors are JSON on stderr with exit 1. Successful results are JSON on stdout with exit 0. `waiting` means no receipt was returned and the process has exited; a short polling slice may end before a download check is due. Follow the next command while `next.when` is `now`; for `user_done`, report the missing download and end the turn. `stopped` means another command finished or discarded the session while this poll was waiting.

## Cancel

Only after the user explicitly cancels/discards a round:

```sh
node SKILL_DIR/scripts/grill-form.mjs cleanup --session SESSION_DIR --discard
```

This deletes only the session's known files and matching validated answer downloads. Supply `--downloads CUSTOM_DOWNLOADS` if applicable. A timeout or an ended turn is not cancellation.

## Question data

Each question needs `prompt`, `recommendation`, and 2–8 distinct option strings. Optional `number` continues numbering; optional `context` is the description and accepts [rich Markdown](authoring.md). Explicit question `id` and `{ "id": "...", "label": "..." }` option objects are also supported. IDs use letters, digits, `_`, or `-`, start with a letter/digit, and are at most 80 characters; `other` is reserved.

Limits: title 200 characters; prompt 2,000; context 12,000; recommendation 3,000; option label 1,000; notes 12,000. Use 1–10 questions per round. All fields except context are plain text. The script creates IDs, detects duplicates, safely embeds data, and validates downloads against the round's identity and question digest. Existing sessions retain their original plain-text normalization and transcript format; new sessions preserve description whitespace and embed the needed renderers in one offline HTML file.

## Maintenance

Only when changing this skill: edit the prepared HTML or scripts directly, then run `node --test scripts/grill-form.test.mjs` from the plugin root. Exercise the browser when changing the UI. Use disposable test sessions; do not mistake synthetic answers for user decisions. Preserve the one-way dependency on grill-me. Prebuilt renderer versions, hashes, and licenses are in [the vendor inventory](../assets/vendor/README.md); no install or bundling step is required during interviews.

The optional browser test uses an installed Chrome/Chromium executable and Node built-ins:

```sh
GRILL_FORM_BROWSER="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node --test scripts/grill-form.test.mjs
```

It runs an isolated headless browser with page networking disabled, checks rendering and expansion, and downloads synthetic answers into a disposable test directory. Without `GRILL_FORM_BROWSER`, the browser test is skipped. `GRILL_FORM_SCREENSHOT` optionally saves a desktop PNG and a companion `.mobile.png` for visual review.
