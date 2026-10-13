# Recovery and advanced use

Normal use needs only SKILL.md and the script's returned next action. Collection uses a local Node CLI with built-ins; there is no server, package installation, or build step. Optional delivery adapters are separate from collection. `next.command` is quoted for POSIX shells; `next.argv` supplies the equivalent argument array for other runners.

The host needs file access, ordinary command execution, Node, and access to the browser's downloaded answer file. Install the linked grill-me, plan, and wiki skills and shared references with their relative layout intact; copying only this skill's instructions is insufficient. Skill discovery and plugin installation use each host's own conventions. For a remote/container agent, supply an accessible download directory or explicit answer path; it cannot read a local browser's Downloads automatically.

## Completion without agent polling

Follow [the shared waiting policy](../../../references/stack-contract.md#completion-and-waiting). Creation returns `wait` for host-managed completion, `completion` for optional adapter delivery, and `next` for manual collection. [Input completion](../../../references/input-completion.md) describes the launcher and compatibility evidence.

`wait` checks locally once per second, exits on receipt, and times out after one hour (`--timeout-seconds N`, 1–86400). The collector owns one `.wait` status file. `collect` marks it stopped and checks once; an in-flight wait notices within a second. Waiting never deletes session files.

```sh
node SKILL_DIR/scripts/grill-form.mjs collect --session SESSION_DIR
node SKILL_DIR/scripts/grill-form.mjs collect --session SESSION_DIR --downloads CUSTOM_DOWNLOADS
node SKILL_DIR/scripts/grill-form.mjs collect --session SESSION_DIR --answer EXACT_FILE
# Optional adapter delivery:
node SKILL_DIR/scripts/grill-form.mjs complete --session SESSION_DIR --downloads CUSTOM_DOWNLOADS
# Run once through host completion or a pending tool call:
node SKILL_DIR/scripts/grill-form.mjs wait --session SESSION_DIR --downloads CUSTOM_DOWNLOADS
```

The default is `~/Downloads`. Returned collection commands preserve the custom location or explicit answer path. Already-collected answers return from the receipt after an interrupted turn. An unfinished or invalid download produces an error and remains untouched; retry on user request after saving completes. Old `poll` commands now perform one manual check. Removed `--wait-seconds` and `--poll-step` options must be omitted; never reconstruct an old schedule.

The static form cannot notify an ended agent turn or confirm receipt. Browser download settings may require choosing a save location. **Download and close form** starts the download and requests tab closure; browsers may refuse. Closing the tab does not confirm a download; only the collector validates receipt. Draft recovery on file URLs depends on browser storage support.

## Finish

Use `create --project PROJECT_DIR --temporary` unless the project already uses jstack wiki at `docs/wiki/`, or when repository instructions prohibit project records. The project still supplies the form header, but `finish` saves the verified transcript in the OS temporary directory and creates no project files. This mode also supports interviews about jstack itself. Interpret the transcript through plan: reuse existing project documentation and ask before adopting jstack wiki when none exists. For jstack development, keep the discussion in the conversation. The transcript remains after session cleanup, but OS cleanup may eventually remove it.

```sh
node SKILL_DIR/scripts/grill-form.mjs finish --session SESSION_DIR
```

Finish requires a collected receipt. Without `--temporary` at creation, it writes and rereads a transcript at `PROJECT/docs/wiki/journal/DATE-grill-SESSION_ID.md` before cleanup. The transcript records submitted answers, not accepted decisions; grill-me/plan must interpret it, link it into the wiki, and build/check the reader. Use this journal as the round's source rather than creating another raw-answer record.

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

Errors are JSON on stderr with exit 1. Successful results are JSON on stdout with exit 0. `waiting` means no receipt was returned and the process has exited: end the turn and collect only on user request. `stopped` means another command finished or discarded the session while the local process was waiting.

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
