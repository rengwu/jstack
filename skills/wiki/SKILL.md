---
name: wiki
description: Create, read, edit, link, validate, and render Markdown wikis with an offline HTML reader and local attachments. Use for wiki operations and presentation; content and workflow are supplied by the caller.
---
# Wiki

Maintain a browsable Markdown tree and generate a standalone HTML snapshot. Markdown is authoritative. The caller supplies the pages, their meaning, metadata, and when they should change.

## Location and initialization

Resolve the target project from the user's request and workspace before writing. Use its existing wiki location, or `docs/wiki/` in that project by default. Never put project content in jstack's source, installation directory, or examples. Ask for the destination if it cannot be determined.

Read the target project's instructions and inspect existing pages and builder before editing. Preserve local modifications. For a new wiki, copy [assets/_build.mjs](assets/_build.mjs) beside its Markdown and create `index.md` with the caller's title and navigation. Resolve the asset relative to this skill, not the target project. Do not execute the builder in the skill's asset directory: it scans its own directory.

Only create pages and folders needed for the supplied content. Do not prescribe a topic taxonomy or add a workflow to the project's instructions. When upgrading an existing builder, compare it with the asset and preserve intentional customizations; existing Markdown does not need to move.

## Page operations

- Read the home page for navigation, then the requested pages and their relevant links.
- Create or edit topic pages using the supplied content. Keep the home page and affected inbound links current when adding, renaming, or moving pages.
- Use relative `.md` links with optional heading anchors. URL-encode spaces and special characters in paths. Headings use lowercase anchors with punctuation and spaces replaced by hyphens; duplicate headings get numbered suffixes. Build/check validates targets.
- Keep one authoritative copy of content and link to it where needed. Do not rewrite unrelated pages as part of a local edit.

## Markdown and metadata

Plain Markdown works. Optional frontmatter is flat `key: value`, not nested YAML. The presentation keys are `title`, `section`, `updated`, `order`, and `summary`:

- A supplied title must match the first H1; `index.md` supplies the reader's title.
- Section controls navigation grouping; the fallback is the top-level folder.
- Updated is a real `YYYY-MM-DD` date; order is numeric.
- Summary is optional and is not displayed as a decorative subtitle.

Additional metadata keys are rendered as escaped labels and values. Their allowed values and meaning belong to the caller. The reader does not infer a workflow or validate domain-specific states.

Tables, lists, and fenced code work. Raw HTML is sanitized. `search.md` is reserved for the search route. Hidden paths, symlinks, and dependency directories are skipped.

## Attachments

Place local attachments under `attachments/`. Existing `evidence/` directories are also supported. Link files with ordinary relative Markdown links; inline image syntax remains unsupported. Supported formats are PNG/JPEG/GIF/WebP, MP4/WebM, PDF, TXT/LOG, JSON, and CSV.

The builder checks local files, rejects symlinks and paths outside the attachment directories, and fingerprints content with SHA-256. Changed attachments require a rebuild. HTTP(S) links are allowed but their contents and availability are not checked. Attachments open separately; share their directories alongside the HTML to keep links working.

## Build and hand off

From the target project, adapting paths to its wiki location:

```sh
node docs/wiki/_build.mjs
node docs/wiki/_build.mjs --check
```

Node.js 22+ is the only prerequisite. The builder includes its parser, sanitizer, reader, styles, and third-party licenses. No package installation, package files, server, CDN, or separate build configuration is needed for wiki operations. Preserve bundled licenses.

Never edit generated `index.html` directly. Rebuild after changing Markdown, attachments, or the reader. Refreshing the browser alone does not load source edits. Open the generated HTML locally; it needs no network or folder selection. Share the HTML for reading, plus attachments when linked, or Markdown and builder for editing.

Keep the lean reader UI focused on navigation, content, metadata, and useful controls. Changes to the reader belong in the asset's named `template`, `css`, and `js` constants. Report the wiki location and structural check outcome; a successful build establishes document integrity only.
