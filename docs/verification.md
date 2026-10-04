# v0.1.0 verification

- Clean `npm ci`, build and 70 tests passed in the independent project directory on Node.js 25.2.1, macOS arm64.
- License audit: 163 npm lock entries, 69 code-bearing browser packages. Java and embedded JS original notices are tracked separately.
- HTTP tests fetch every original notice link, verify the icon PNG, ensure licenses serve as plain text, and reject access to package-lock/runtime paths.
- Real browser: six-table public sample rendered; ChatERD title and supplied project icon loaded; license page showed source and original notice links.
- External save of a temporary sample copy rerendered automatically while page and SVG stayed dark.
- Actual downloaded PNG: 4596 × 2044, corner RGBA (17, 24, 39, 255). Actual downloaded SVG retained `data-theme="dark"`.
- ELK #955 final diff passed `git apply --check` against the fixed ELK 0.9.1 source archive.
- Source archive file SHA-256 hashes verified before packaging. Java/GWT compilation was not rerun, so byte-identical upstream Java rebuilds are not claimed.
- Optional model-powered draw/discuss calls were not made for this release. Tests cover isolated CLI/MCP contracts; the local viewer requires no model service.

GitHub CI also runs Node.js 22 and 24; its result is reported in the Actions run for the published commit.
