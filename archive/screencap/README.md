# Screencap archive

Deprecated on 2026-10-30 at the user's request. Screencap is preserved here for reference and explicit maintenance, outside jstack's active `skills/` directory. The active plugin no longer discovers it, and the normal root test command no longer runs its checks.

The original relative layout is retained so the signed app, completion helper, and tests can still find each other without changing or rebuilding the executable.

| Contents | Location |
| --- | --- |
| Skill instructions, metadata, native source, app, and usage guide | [skills/screencap/](skills/screencap/SKILL.md) |
| Completion policy and historical compatibility notes | [references/input-completion.md](references/input-completion.md) |
| Completion launcher and optional Codex adapter | `scripts/input-completion.mjs`, `scripts/completion/codex.mjs` |
| Capture, layout, and completion tests; original fixture helpers | `scripts/screencap.test.mjs`, `scripts/screencap-layout.m`, `scripts/input-completion.test.mjs`, `scripts/helpers/fixtures.mjs` |
| Earlier capture-feedback mockups | [mock](output/capture-feedback-mock.html), [preview](output/capture-feedback-preview.html) |

To check the archive explicitly from the jstack root:

```sh
node --test archive/screencap/scripts/*.test.mjs
```

Native checks require macOS; the layout check also requires Xcode command-line tools. The original test helper is retained intact here; active reader/report tests keep only their own symlink utility. User sessions remain at their existing application-support paths and are not part of this repository archive.

Historical records covering several jstack features remain in the development wiki and continue to describe their original builds. The [active collection](../../README.md) uses Fungi for its interface workflows.
