# Usage and recovery

The committed `bin/Feedback.app` contains a universal arm64/x86_64 executable targeting macOS 11 or later. Only Apple Silicon is exercised during development; Intel and older macOS versions need runtime verification. AppKit, Foundation, ImageIO, and `/usr/sbin/screencapture` come with macOS. There is no browser, server, package installation, runtime dependency, resident daemon, or build during skill use.

The app is ad-hoc signed, not Developer ID signed or notarized. A downloaded copy may be blocked by Gatekeeper. Report that clearly and let the user approve trusted software through macOS; do not remove quarantine or weaken security automatically. Windows and Linux are not supported. Remote/container harnesses need the helper on the user's Mac and explicit transfer or shared access to its files; a skill alone cannot provide that connection.

## Panel

Click **Capture** (⌘N), drag a rectangle anywhere on screen, and enter feedback beside its thumbnail. Escape cancels the selector. Only the selected region is saved. Edit notes in place, remove individual items, and capture more. Submit (⌘Return) becomes available when every item has a note. The window closes into a five-second floating notice and the process exits. The notice confirms local submission, not that an agent has read it.

macOS may request Screen Recording permission for the app or launching host. The user grants that through the system prompt or System Settings. The helper does not change permissions. No Accessibility permission is required by the helper.

Draft notes are saved atomically as they change. Closing preserves the draft. A session lock prevents concurrent editors. Captures stay full resolution on disk; the list decodes small thumbnails. Notes grow to show their full text. One scroll area moves the whole batch; the title bar and buttons stay fixed. The panel grows up to a compact maximum unless the user resizes it.

## Commands and storage

Run the executable at `SKILL_DIR/bin/Feedback.app/Contents/MacOS/Feedback`:

| Command | Result |
| --- | --- |
| `create --project ABSOLUTE_PATH` | Creates an isolated draft and returns launch/background commands. |
| `launch --session ABSOLUTE_PATH` | Opens the draft and returns promptly for the `done` workflow. |
| `show --session ABSOLUTE_PATH` | Runs the panel in this process; optional verified background completion only. |
| `collect --session ABSOLUTE_PATH` | Returns `waiting`, or paired absolute image paths, feedback, project, and receipt. Keeps files. |
| `finish --session ABSOLUTE_PATH --receipt HASH` | Deletes a submitted batch only if it still matches the collected receipt and has no unexpected files. Use only after handling the feedback. |

Sessions default to `~/Library/Application Support/jstack/feedback/UUID/`. They contain `batch.json`, capture PNGs, and a lock file; directories use 0700 and files use 0600. They persist across process exits and reboots. `create --sessions ABSOLUTE_PATH` overrides the parent for disposable tests. Successful CLI results are JSON on stdout; errors are JSON on stderr with exit 1. Returned `command` strings quote POSIX shell arguments; `argv` is available for other runners.

For recovery, use the session path from the conversation. If it is lost, inspect manifests under the session parent and match the project and captures with the user; do not automatically consume the newest directory. Reopen a draft with `launch`, or collect a submission. If cleanup finds changed files, a symlink, or unexpected files (including a capture left by an interrupted save), preserve everything and inspect the discrepancy. Do not bypass validation with recursive deletion. A stale `.lock` file is harmless: the OS releases the actual lock on process exit.

## Maintenance

Source is [Feedback.m](../native/Feedback.m); maintainers with Xcode build the committed app using:

```sh
skills/capture-feedback/native/build.sh
node --test scripts/capture-feedback.test.mjs
```

Commit source and the rebuilt app together. `build.sh` cross-compiles both architectures, strips local symbols, and ad-hoc signs the bundle. Session fixtures belong outside the repository. Exercise actual region selection, inline edits, scrolling, close/reopen, removal, and the five-second submission notice on macOS after UI changes. Measure startup and idle memory on the tested machine; binary architecture and signing checks do not establish runtime compatibility.
