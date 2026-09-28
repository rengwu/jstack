# jstack development

This plugin contains five cooperating skills: grill-me, planning-wiki, feature-map, verify-change, and maintain-verification. Shared record formats and ownership rules live in `skills/planning-wiki/references/stack-contract.md`; link to that file instead of duplicating its rules.

The reader source is `skills/planning-wiki/assets/_build.mjs`. Preserve its bundled licenses. `examples/wiki/` is a preserved demonstration, not this plugin's active wiki. Do not create or maintain `docs/wiki/` in jstack or add plugin-development discussions to the example. When intentionally updating the example reader, synchronize its `_build.mjs` from the asset, rebuild its HTML, and run `--check`.

Project-specific requirements, decisions, feature maps, verification runs, and evidence belong in the target project's repository. Resolve that project before writing; the plugin source or installation directory is never a fallback target. Reuse the skills and reader asset, not the example's project content. Preserve historical reports and evidence inside the example. Never install packages or create package/lock files for wiki work. Reader tests use Node built-ins.

Run `node --test scripts/reader.test.mjs` for reader behavior changes. Build/check `examples/wiki/` when the example changes. Validate all skill frontmatter and the plugin manifest with the installed skill-creator/plugin-creator validators before handoff. Plugin-authoring changes belong in this source directory; project work using the skills belongs in the target project. The original Desktop planning-wiki is a preserved starting reference.
