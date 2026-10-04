# Release procedure

1. Keep `package.json` and `package-lock.json` versions aligned. Use exact direct dependency versions and commit the lock file.
2. Run `npm ci`, `npm run licenses:update`, and inspect the resulting third-party notice changes. `khroma` has an explicit MIT exception based on its original license file; platform esbuild binaries use esbuild's common MIT license.
3. For any ELK change, inspect upstream `build.gradle`, map elkjs to the actual Java ELK revision and any patches, update Java source artifacts, original notices and SHA-256 manifests. Do not assume the Java ELK version matches the elkjs patch version.
4. Run `npm run build`, `npm test`, `npm run audit:licenses`. CI runs Node.js 22 and 24. Audit does not automatically approve a new license; maintainers must review its conditions.
5. In an actual browser, check sample rendering, external save rerender, dark mode after edits, and PNG/SVG downloads. Browser testing is separate from mocked app coordinator tests.
6. Create the release archive from tracked source files. Include exactly `examples/sample.mmd`; exclude `.runtime`, node_modules, local diagrams, personal paths and prior repository history. Build output can be produced with `npm ci && npm run build`. If distributing `dist`, include its license tree, source notice and every emitted `.LEGAL.txt`.
7. Attach `third-party-sources-vVERSION.tar.gz` to the GitHub Release. Preserve upstream ELK/elkjs source archives, patches, source JARs, POMs, licenses, source manifest and build instructions. Verify all SHA-256 hashes in `docs/third-party-source-checksums.json`. Keep previous release sources available.
8. Tag the verified commit and publish release notes with installation steps, license and source links. Verify the repository is public, the tag matches, download URLs work, and CI passed.

## Initial release

Version: `v0.1.0`. GitHub source distribution; no npm publication. The new repository starts with one root commit, `feat: initialize ChatERD`, without earlier repository history. Existing internal `@db-camp` comments, MCP namespace and browser preference keys remain for compatibility. The application and package names are ChatERD / chaterd.

The original MermAId vendor tree is absent from this release. This release uses the standalone Node.js runtime, custom SVG renderer, Mermaid parser and ELK layout. Layout design references are linked in `references/layout-feedback.md`; those links do not distribute yFiles, Oracle Data Modeler or a Graphviz executable.
