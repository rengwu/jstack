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

The static form cannot notify an ended agent turn or confirm receipt. Browser download settings may require choosing a save location. **Submit feedback** downloads the answer file and leaves the form open. Closing the tab does not confirm a download; only the collector validates receipt. Draft recovery on file URLs depends on browser storage support.

## Inline images in answers

Paste clipboard images directly into Notes or a region comment. Each becomes a numbered `[Image #N]` chip at the cursor, alongside the text that refers to it. Click a chip (or focus it and press Enter) to preview the image; Escape closes the preview. Backspace after a chip, Delete before it, or deletion of a selection removes the whole chip. Native undo restores it. Copy and cut within the same form preserve image references; copying into other applications supplies the plain text labels.

PNG, JPEG, GIF, and WebP are supported: up to 5 MiB per image, 20 images, and 20 MiB total per form. Numbering is shared across questions, and deleting a chip does not renumber the remaining images. Notes still allow 12,000 characters, including image labels. Images stay local and are embedded in the single answer JSON download. Pending or unreadable images block submission until they finish loading or their chips are removed. If browser draft storage is unavailable or full, the form shows a message to keep the tab open until download.

The collector validates image types, size limits, and reference positions. Its output lists image metadata without base64 data. `finish` returns the saved image paths and links them from the transcript; inspect those files to interpret the inline references. Plain-text submissions from older forms remain supported.

## Finish

Use `create --project PROJECT_DIR --temporary` unless the project already uses jstack wiki at `docs/wiki/`, or when repository instructions prohibit project records. The project still supplies the form header, but `finish` saves the verified transcript in the OS temporary directory and creates no project files. This mode also supports interviews about jstack itself. Interpret the transcript through plan: reuse existing project documentation and ask before adopting jstack wiki when none exists. For jstack development, keep the discussion in the conversation. The transcript remains after session cleanup, but OS cleanup may eventually remove it.

```sh
node SKILL_DIR/scripts/grill-form.mjs finish --session SESSION_DIR
```

Finish requires a collected receipt. Without `--temporary` at creation, it writes and rereads a transcript at `PROJECT/docs/wiki/journal/DATE-grill-SESSION_ID.md` before cleanup. Images are verified under `docs/wiki/attachments/DATE-grill-SESSION_ID-images/`, following the [wiki attachment rules](../../wiki/SKILL.md#attachments). Temporary rounds keep their image directory beside the temporary transcript, outside the project. The transcript records submitted feedback, not accepted decisions; interpret it through the review or grill-me/plan, link it into the wiki, and build/check the reader. Use this journal as the round's source rather than creating another raw-answer record.

Matching answer downloads, the temporary HTML, session state, and receipt are then removed. Unrelated downloads remain untouched. A retry reuses identical transcripts and images; edited saved files stop cleanup so no newer work is overwritten. Validation failures can leave saved copies and the original temporary files intact.

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

Items support open feedback, optional recommendations and choices, and isolated visual previews. See [authoring](authoring.md) for the schema and examples. Optional `number` continues numbering; explicit question `id` and option `{id,label}` objects are supported. IDs use letters, digits, `_`, or `-`, start with a letter/digit, and are at most 80 characters; `other` is reserved.

Limits: title 200 characters; prompt 2,000; recommendation 3,000; option label 1,000; notes 12,000. The collector validates submissions against the round's identity and specification digest. Older sessions retain their original normalization, required-answer behavior, and transcript format.

For rounds with previews, `finish` also returns `preview`: a saved offline HTML review beside temporary transcripts or in the wiki's attachments folder. It restores submitted prototype state and feedback, disables resubmission, and embeds the original preview source. Region comments retain their own state, viewport, and scroll positions; use **View area** to reopen the selection. Wiki transcripts link a JSON source/state record alongside the HTML, preserving compatibility with the existing reader. Modified archives stop cleanup just like modified transcripts. A state change counts as feedback, never automatic approval.

## Maintenance

Only when changing this skill: edit the prepared HTML or scripts directly, then run `node --test scripts/grill-form.test.mjs` from the plugin root. Exercise the browser when changing the UI. Use disposable test sessions; do not mistake synthetic answers for user decisions. Preserve the one-way dependency on grill-me. Prebuilt renderer versions, hashes, and licenses are in [the vendor inventory](../assets/vendor/README.md); no install or bundling step is required during interviews.

The optional browser test uses an installed Chrome/Chromium executable and Node built-ins:

```sh
GRILL_FORM_BROWSER="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node --test scripts/grill-form.test.mjs
```

It runs an isolated headless browser with page networking disabled, checks rendering, iframe isolation, prototype state and comments, inline image editing, draft recovery, and expansion, and downloads synthetic answers into a disposable test directory. Without `GRILL_FORM_BROWSER`, browser tests are skipped. `GRILL_FORM_SCREENSHOT` optionally saves desktop/mobile PNGs, including `.images.png` and `.images-mobile.png` for the notes editor.
