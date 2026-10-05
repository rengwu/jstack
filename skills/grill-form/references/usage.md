# Recovery and advanced use

Normal use needs only SKILL.md and the script's returned `next.command`. When `next.when` is `user_done`, end the turn and run the command only after the user says they have submitted. No polling or background processes. Commands use Node built-ins; there is no server, package installation, or build step. `next.command` is quoted for POSIX shells; `next.argv` supplies the equivalent argument array for other runners.

## Resume or change the download location

```sh
node SKILL_DIR/scripts/grill-form.mjs collect --session SESSION_DIR
node SKILL_DIR/scripts/grill-form.mjs collect --session SESSION_DIR --downloads CUSTOM_DOWNLOADS
node SKILL_DIR/scripts/grill-form.mjs collect --session SESSION_DIR --answer EXACT_FILE
```

The default is `~/Downloads`. Collection checks once and exits. The returned next command preserves a custom download location. Already-collected answers return from the receipt, so an interrupted turn can resume. An unfinished/invalid answer file produces an error and remains untouched; retry on user request after the browser finishes saving it. Older saved commands containing `--wait-seconds` must omit that removed option.

The static form cannot notify an ended agent turn or confirm receipt. Browser download settings may require choosing a save location. Draft recovery on file URLs depends on browser storage support.

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

Errors are JSON on stderr with exit 1. Successful results are JSON on stdout with exit 0; `waiting` means no answer was found and the process has exited. Report the missing download and end the turn.

## Cancel

Only after the user explicitly cancels/discards a round:

```sh
node SKILL_DIR/scripts/grill-form.mjs cleanup --session SESSION_DIR --discard
```

This deletes only the session's known files and matching validated answer downloads. Supply `--downloads CUSTOM_DOWNLOADS` if applicable. A timeout or an ended turn is not cancellation.

## Question data

Each question needs `prompt`, `recommendation`, and 2–8 distinct option strings. Optional `number` continues numbering; optional `context` explains the choice. Explicit question `id` and `{ "id": "...", "label": "..." }` option objects are also supported. IDs use letters, digits, `_`, or `-`, start with a letter/digit, and are at most 80 characters; `other` is reserved.

Limits: title 200 characters; prompt 2,000; context/recommendation 3,000 each; option label 1,000; notes 12,000. Use 1–10 questions per round. Content is plain text. The script creates IDs, detects duplicates, safely embeds data, and validates downloads against the round's identity and question digest.

## Maintenance

Only when changing this skill: edit the prepared HTML or scripts directly, then run `node --test scripts/grill-form.test.mjs` from the plugin root. Exercise the browser when changing the UI. Use disposable test sessions; do not mistake synthetic answers for user decisions. Preserve the one-way dependency on grill-me.
