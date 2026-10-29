# Bundled renderers

Prebuilt upstream browser distributions. No package installation or build is needed to create or use a form. Preserve these licenses and the notices inside each bundle.

| Package | Version | SHA-256 of bundled JavaScript |
| --- | --- | --- |
| [marked](https://registry.npmjs.org/marked/-/marked-18.1.0.tgz) | 18.1.0 | `f424dcb508fdf93e0137a970cfce8f3207ea2e3f37eca5f7556a52875683632a` |
| [dompurify](https://registry.npmjs.org/dompurify/-/dompurify-3.4.16.tgz) | 3.4.16 | `2c90a9b46d6463f26038a29b686e82bc91de01fdac9d5229e7cfe3b360134ea2` |
| [pele](https://registry.npmjs.org/pele/-/pele-1.6.0.tgz) | 1.6.0 | `b82d1bcd435302779a945e1e0f4a54ea56fb26e010ce3f2122f4216fcfc095d7` |

## Fonts

Theme typefaces under [fonts/](fonts/), licensed under the SIL Open Font License 1.1. Only the `latin` and `latin-ext` WOFF2 subsets are bundled; [fonts.css](../fonts.css) declares them with their unicode ranges, so a page downloads only the faces and ranges it renders.

| Package | Version | Bundled faces | Licence |
| --- | --- | --- | --- |
| [@fontsource-variable/ibm-plex-sans](https://registry.npmjs.org/@fontsource-variable/ibm-plex-sans/-/ibm-plex-sans-5.3.0.tgz) | 5.3.0 | IBM Plex Sans, variable weight, roman and italic | [ibm-plex-sans-LICENSE](fonts/ibm-plex-sans-LICENSE) |
| [@fontsource/ibm-plex-mono](https://registry.npmjs.org/@fontsource/ibm-plex-mono/-/ibm-plex-mono-5.3.0.tgz) | 5.3.0 | IBM Plex Mono 400, 500, 600 and 400 italic | [ibm-plex-mono-LICENSE](fonts/ibm-plex-mono-LICENSE) |

Add a face by copying its subset files and licence from the pinned tarball, adding its `@font-face` rules to `fonts.css` with paths relative to `assets/`, and updating this table. Page templates need `font-src 'self'` in their policy.

## Updating

To update, download the pinned package tarball from the npm registry, copy the corresponding prebuilt file and license files, update this table, and rerun the form tests and browser verification. Do not add package manifests or lockfiles. Pele renders Mermaid syntax without runtime dependencies. The form disables diagram links/images and configuration directives, sanitizes SVG output, and bounds source/output size.
