# Bundled renderers

Prebuilt upstream browser distributions. No package installation or build is needed to create or use a form. Preserve these licenses and the notices inside each bundle.

| Package | Version | SHA-256 of bundled JavaScript |
| --- | --- | --- |
| [marked](https://registry.npmjs.org/marked/-/marked-18.1.0.tgz) | 18.1.0 | `f424dcb508fdf93e0137a970cfce8f3207ea2e3f37eca5f7556a52875683632a` |
| [dompurify](https://registry.npmjs.org/dompurify/-/dompurify-3.4.16.tgz) | 3.4.16 | `2c90a9b46d6463f26038a29b686e82bc91de01fdac9d5229e7cfe3b360134ea2` |
| [@mermaid-js/tiny](https://registry.npmjs.org/@mermaid-js/tiny/-/tiny-12.1.0.tgz) | 12.1.0 | `143c1b9345c45963ff429da4bdcd9051316a43522ea9edd7ccb7a87ff947a804` |

To update, download the pinned package tarball from the npm registry, copy the corresponding prebuilt file and license files, update this table, and rerun the form tests and browser verification. Do not add package manifests or lockfiles. Mermaid Tiny is self-contained; supported diagram types are deliberately limited by the form renderer.
