# Third-party notices / 제3자 고지

ChatERD 자체 코드·문서·샘플과 프로젝트 로고는 루트 [MIT LICENSE](LICENSE)로 제공합니다. 제3자 소프트웨어·Lucide SVG는 아래 별도 라이선스로 제공되며 프로젝트의 MIT가 이를 대체하지 않습니다. 각 저작권 고지·라이선스 및 NOTICE 원문은 `licenses/`에 포함합니다.

## 주요 구성 요소

| 구성 요소 | 버전 | 용도 | 라이선스 |
|---|---|---|---|
| Mermaid | 12.0.0 | Mermaid 파서 | MIT |
| elkjs / Eclipse Layout Kernel | 0.11.0, 0.9.3 | 그래프 배치·Mermaid 포함 코드 | EPL-2.0 |
| CodeMirror 및 Lezer | 잠금 파일 참조 | 코드 편집기 | MIT |
| js-yaml | 5.4.2 | YAML front matter | MIT |
| pngjs | 7.0.0 | PNG 검증 | MIT |
| esbuild | 0.28.2 | 빌드 도구 | MIT |
| Lucide SVG | 0.468.0 | 버튼 아이콘 12개 | ISC; 일부 Feather 유래 부분 MIT 고지 |

Lucide 저작권과 사용 조건은 [원문](licenses/lucide.txt)에 있습니다. 로컬 SVG를 포함하며 Lucide npm 패키지나 CDN을 사용하지 않습니다. 프로젝트 로고 `web/assets/chaterd.png`는 사용자가 제공한 별도 이미지이며 Lucide 아이콘이 아닙니다.

ELK에 컴파일된 Java 입력은 **EMF GWT (EPL-1.0)**, Xtext/Xtend (EPL-2.0), Guava 및 GWT (Apache-2.0 및 원래 포함 고지), EMF ecore 내 Xerces XML 정규식 코드 (Apache-1.1)를 포함합니다. [소스 제공 안내](docs/third-party-sources.md), [Java 버전·고지 manifest](docs/embedded-java-manifest.json), [`licenses/embedded/`](licenses/embedded/)에서 원문과 출처를 확인할 수 있습니다. 이 소스는 각각의 EPL 또는 해당 upstream 라이선스로 제공됩니다.

DOMPurify는 `(MPL-2.0 OR Apache-2.0)`의 선택 라이선스이며 이 배포에서는 Apache-2.0 조건을 사용합니다. 두 원래 라이선스 자료는 보존합니다. khroma 2.1.0은 npm 메타데이터에 license 값이 없으나 패키지의 원래 `license` 파일에서 MIT를 확인했습니다.

## ELK의 내장 JavaScript 코드

elkjs에는 worker 브라우저 shim (web-worker, Apache-2.0), Browserify/browser-pack·UMD 로더 (MIT), Babel이 생성한 helper 코드 (MIT)가 포함됩니다. elkjs 0.11.0 upstream 잠금 파일의 web-worker 1.4.1, browser-pack 6.1.0, umd 3.0.3, @babel/helpers 7.27.6 원문과 소스를 보존합니다. Babel 6 계열 wrapper를 사용하는 0.9.3에 대해서는 babel-core 6.26.3의 MIT 원문도 보수적으로 포함합니다. 0.9.3 shim의 정확한 npm 패치 버전은 번들에서 식별할 수 없으며 배포 파일의 실제 shim과 저작권 고지를 그대로 보존했습니다.

[내장 JS manifest](docs/embedded-js-manifest.json)와 [`licenses/embedded-js/`](licenses/embedded-js/)를 참조하세요. 이 입력은 위 npm 잠금 목록 밖에 이미 컴파일되어 들어간 코드이므로 별도로 고지합니다.

This product includes software developed by the Apache Software Foundation (http://www.apache.org/).

## 전체 npm 잠금 의존성

아래 목록은 설치·개발·선택적 플랫폼 의존성을 모두 포함합니다. “브라우저”는 esbuild 출력에 실제 코드가 들어간 패키지를 뜻하며, 그 외 패키지는 서버·빌드 또는 설치 입력일 수 있습니다. 선택적 esbuild 플랫폼 바이너리는 그 버전의 공통 esbuild MIT 원문을 포함합니다. 전체 npm 목록만으로 ELK 내부 Java 의존성 검토를 대신하지 않습니다.

각 링크의 파일은 저작권자·조건이 기재된 **원문**입니다. 출처 URL, npm integrity, 원문 SHA-256은 [manifest](docs/dependency-manifest.json)에 있습니다. 새 의존성·번들 변경은 `npm run audit:licenses`가 실패하도록 구성했습니다.

<!-- npm inventory:start -->
| 패키지 | 버전 | 라이선스 | 브라우저 | 라이선스·고지 원문 |
|---|---|---|---|---|
| @antfu/install-pkg | 2.1.0 | MIT |  | [LICENSE](licenses/npm/antfu--install-pkg--2.1.0/LICENSE) |
| @braintree/sanitize-url | 7.1.2 | MIT | 예 | [LICENSE](licenses/npm/braintree--sanitize-url--7.1.2/LICENSE) |
| @chevrotain/cst-dts-gen | 11.1.2 | Apache-2.0 |  | [LICENSE.txt](licenses/npm/chevrotain--cst-dts-gen--11.1.2/LICENSE.txt) |
| @chevrotain/gast | 11.1.2 | Apache-2.0 | 예 | [LICENSE.txt](licenses/npm/chevrotain--gast--11.1.2/LICENSE.txt) |
| @chevrotain/regexp-to-ast | 11.1.2 | Apache-2.0 | 예 | [LICENSE.txt](licenses/npm/chevrotain--regexp-to-ast--11.1.2/LICENSE.txt) |
| @chevrotain/types | 11.1.2 | Apache-2.0 |  | [LICENSE.txt](licenses/npm/chevrotain--types--11.1.2/LICENSE.txt) |
| @chevrotain/utils | 11.1.2 | Apache-2.0 | 예 | [LICENSE.txt](licenses/npm/chevrotain--utils--11.1.2/LICENSE.txt) |
| @codemirror/autocomplete | 6.20.3 | MIT | 예 | [LICENSE](licenses/npm/codemirror--autocomplete--6.20.3/LICENSE) |
| @codemirror/commands | 6.11.1 | MIT | 예 | [LICENSE](licenses/npm/codemirror--commands--6.11.1/LICENSE) |
| @codemirror/language | 6.12.4 | MIT | 예 | [LICENSE](licenses/npm/codemirror--language--6.12.4/LICENSE) |
| @codemirror/lint | 6.9.7 | MIT | 예 | [LICENSE](licenses/npm/codemirror--lint--6.9.7/LICENSE) |
| @codemirror/search | 6.7.2 | MIT | 예 | [LICENSE](licenses/npm/codemirror--search--6.7.2/LICENSE) |
| @codemirror/state | 6.7.6 | MIT | 예 | [LICENSE](licenses/npm/codemirror--state--6.7.6/LICENSE) |
| @codemirror/view | 6.43.13 | MIT | 예 | [LICENSE](licenses/npm/codemirror--view--6.43.13/LICENSE) |
| @esbuild/aix-ppc64 | 0.28.2 | MIT |  | [LICENSE.md](licenses/npm/esbuild--aix-ppc64--0.28.2/LICENSE.md) |
| @esbuild/android-arm | 0.28.2 | MIT |  | [LICENSE.md](licenses/npm/esbuild--android-arm--0.28.2/LICENSE.md) |
| @esbuild/android-arm64 | 0.28.2 | MIT |  | [LICENSE.md](licenses/npm/esbuild--android-arm64--0.28.2/LICENSE.md) |
| @esbuild/android-x64 | 0.28.2 | MIT |  | [LICENSE.md](licenses/npm/esbuild--android-x64--0.28.2/LICENSE.md) |
| @esbuild/darwin-arm64 | 0.28.2 | MIT |  | [LICENSE.md](licenses/npm/esbuild--darwin-arm64--0.28.2/LICENSE.md) |
| @esbuild/darwin-x64 | 0.28.2 | MIT |  | [LICENSE.md](licenses/npm/esbuild--darwin-x64--0.28.2/LICENSE.md) |
| @esbuild/freebsd-arm64 | 0.28.2 | MIT |  | [LICENSE.md](licenses/npm/esbuild--freebsd-arm64--0.28.2/LICENSE.md) |
| @esbuild/freebsd-x64 | 0.28.2 | MIT |  | [LICENSE.md](licenses/npm/esbuild--freebsd-x64--0.28.2/LICENSE.md) |
| @esbuild/linux-arm | 0.28.2 | MIT |  | [LICENSE.md](licenses/npm/esbuild--linux-arm--0.28.2/LICENSE.md) |
| @esbuild/linux-arm64 | 0.28.2 | MIT |  | [LICENSE.md](licenses/npm/esbuild--linux-arm64--0.28.2/LICENSE.md) |
| @esbuild/linux-ia32 | 0.28.2 | MIT |  | [LICENSE.md](licenses/npm/esbuild--linux-ia32--0.28.2/LICENSE.md) |
| @esbuild/linux-loong64 | 0.28.2 | MIT |  | [LICENSE.md](licenses/npm/esbuild--linux-loong64--0.28.2/LICENSE.md) |
| @esbuild/linux-mips64el | 0.28.2 | MIT |  | [LICENSE.md](licenses/npm/esbuild--linux-mips64el--0.28.2/LICENSE.md) |
| @esbuild/linux-ppc64 | 0.28.2 | MIT |  | [LICENSE.md](licenses/npm/esbuild--linux-ppc64--0.28.2/LICENSE.md) |
| @esbuild/linux-riscv64 | 0.28.2 | MIT |  | [LICENSE.md](licenses/npm/esbuild--linux-riscv64--0.28.2/LICENSE.md) |
| @esbuild/linux-s390x | 0.28.2 | MIT |  | [LICENSE.md](licenses/npm/esbuild--linux-s390x--0.28.2/LICENSE.md) |
| @esbuild/linux-x64 | 0.28.2 | MIT |  | [LICENSE.md](licenses/npm/esbuild--linux-x64--0.28.2/LICENSE.md) |
| @esbuild/netbsd-arm64 | 0.28.2 | MIT |  | [LICENSE.md](licenses/npm/esbuild--netbsd-arm64--0.28.2/LICENSE.md) |
| @esbuild/netbsd-x64 | 0.28.2 | MIT |  | [LICENSE.md](licenses/npm/esbuild--netbsd-x64--0.28.2/LICENSE.md) |
| @esbuild/openbsd-arm64 | 0.28.2 | MIT |  | [LICENSE.md](licenses/npm/esbuild--openbsd-arm64--0.28.2/LICENSE.md) |
| @esbuild/openbsd-x64 | 0.28.2 | MIT |  | [LICENSE.md](licenses/npm/esbuild--openbsd-x64--0.28.2/LICENSE.md) |
| @esbuild/openharmony-arm64 | 0.28.2 | MIT |  | [LICENSE.md](licenses/npm/esbuild--openharmony-arm64--0.28.2/LICENSE.md) |
| @esbuild/sunos-x64 | 0.28.2 | MIT |  | [LICENSE.md](licenses/npm/esbuild--sunos-x64--0.28.2/LICENSE.md) |
| @esbuild/win32-arm64 | 0.28.2 | MIT |  | [LICENSE.md](licenses/npm/esbuild--win32-arm64--0.28.2/LICENSE.md) |
| @esbuild/win32-ia32 | 0.28.2 | MIT |  | [LICENSE.md](licenses/npm/esbuild--win32-ia32--0.28.2/LICENSE.md) |
| @esbuild/win32-x64 | 0.28.2 | MIT |  | [LICENSE.md](licenses/npm/esbuild--win32-x64--0.28.2/LICENSE.md) |
| @iconify/types | 2.0.0 | MIT |  | [license.txt](licenses/npm/iconify--types--2.0.0/license.txt) |
| @iconify/utils | 3.1.7 | MIT | 예 | [license.txt](licenses/npm/iconify--utils--3.1.7/license.txt) |
| @lezer/common | 1.5.3 | MIT | 예 | [LICENSE](licenses/npm/lezer--common--1.5.3/LICENSE) |
| @lezer/highlight | 1.2.5 | MIT | 예 | [LICENSE](licenses/npm/lezer--highlight--1.2.5/LICENSE) |
| @lezer/lr | 1.4.10 | MIT |  | [LICENSE](licenses/npm/lezer--lr--1.4.10/LICENSE) |
| @marijn/find-cluster-break | 1.0.4 | MIT | 예 | [LICENSE](licenses/npm/marijn--find-cluster-break--1.0.4/LICENSE) |
| @mermaid-js/parser | 2.0.0 | MIT | 예 | [LICENSE](licenses/npm/mermaid-js--parser--2.0.0/LICENSE) |
| @types/d3 | 7.4.3 | MIT |  | [LICENSE](licenses/npm/types--d3--7.4.3/LICENSE) |
| @types/d3-array | 3.2.2 | MIT |  | [LICENSE](licenses/npm/types--d3-array--3.2.2/LICENSE) |
| @types/d3-axis | 3.0.6 | MIT |  | [LICENSE](licenses/npm/types--d3-axis--3.0.6/LICENSE) |
| @types/d3-brush | 3.0.6 | MIT |  | [LICENSE](licenses/npm/types--d3-brush--3.0.6/LICENSE) |
| @types/d3-chord | 3.0.6 | MIT |  | [LICENSE](licenses/npm/types--d3-chord--3.0.6/LICENSE) |
| @types/d3-color | 3.1.3 | MIT |  | [LICENSE](licenses/npm/types--d3-color--3.1.3/LICENSE) |
| @types/d3-contour | 3.0.6 | MIT |  | [LICENSE](licenses/npm/types--d3-contour--3.0.6/LICENSE) |
| @types/d3-delaunay | 6.0.4 | MIT |  | [LICENSE](licenses/npm/types--d3-delaunay--6.0.4/LICENSE) |
| @types/d3-dispatch | 3.0.7 | MIT |  | [LICENSE](licenses/npm/types--d3-dispatch--3.0.7/LICENSE) |
| @types/d3-drag | 3.0.7 | MIT |  | [LICENSE](licenses/npm/types--d3-drag--3.0.7/LICENSE) |
| @types/d3-dsv | 3.0.7 | MIT |  | [LICENSE](licenses/npm/types--d3-dsv--3.0.7/LICENSE) |
| @types/d3-ease | 3.0.2 | MIT |  | [LICENSE](licenses/npm/types--d3-ease--3.0.2/LICENSE) |
| @types/d3-fetch | 3.0.7 | MIT |  | [LICENSE](licenses/npm/types--d3-fetch--3.0.7/LICENSE) |
| @types/d3-force | 3.0.10 | MIT |  | [LICENSE](licenses/npm/types--d3-force--3.0.10/LICENSE) |
| @types/d3-format | 3.0.4 | MIT |  | [LICENSE](licenses/npm/types--d3-format--3.0.4/LICENSE) |
| @types/d3-geo | 3.1.1 | MIT |  | [LICENSE](licenses/npm/types--d3-geo--3.1.1/LICENSE) |
| @types/d3-hierarchy | 3.1.7 | MIT |  | [LICENSE](licenses/npm/types--d3-hierarchy--3.1.7/LICENSE) |
| @types/d3-interpolate | 3.0.4 | MIT |  | [LICENSE](licenses/npm/types--d3-interpolate--3.0.4/LICENSE) |
| @types/d3-path | 3.1.1 | MIT |  | [LICENSE](licenses/npm/types--d3-path--3.1.1/LICENSE) |
| @types/d3-polygon | 3.0.2 | MIT |  | [LICENSE](licenses/npm/types--d3-polygon--3.0.2/LICENSE) |
| @types/d3-quadtree | 3.0.6 | MIT |  | [LICENSE](licenses/npm/types--d3-quadtree--3.0.6/LICENSE) |
| @types/d3-random | 3.0.4 | MIT |  | [LICENSE](licenses/npm/types--d3-random--3.0.4/LICENSE) |
| @types/d3-scale | 4.0.9 | MIT |  | [LICENSE](licenses/npm/types--d3-scale--4.0.9/LICENSE) |
| @types/d3-scale-chromatic | 3.1.0 | MIT |  | [LICENSE](licenses/npm/types--d3-scale-chromatic--3.1.0/LICENSE) |
| @types/d3-selection | 3.0.12 | MIT |  | [LICENSE](licenses/npm/types--d3-selection--3.0.12/LICENSE) |
| @types/d3-shape | 3.2.0 | MIT |  | [LICENSE](licenses/npm/types--d3-shape--3.2.0/LICENSE) |
| @types/d3-time | 3.0.4 | MIT |  | [LICENSE](licenses/npm/types--d3-time--3.0.4/LICENSE) |
| @types/d3-time-format | 4.0.3 | MIT |  | [LICENSE](licenses/npm/types--d3-time-format--4.0.3/LICENSE) |
| @types/d3-timer | 3.0.2 | MIT |  | [LICENSE](licenses/npm/types--d3-timer--3.0.2/LICENSE) |
| @types/d3-transition | 3.0.9 | MIT |  | [LICENSE](licenses/npm/types--d3-transition--3.0.9/LICENSE) |
| @types/d3-zoom | 3.0.9 | MIT |  | [LICENSE](licenses/npm/types--d3-zoom--3.0.9/LICENSE) |
| @types/geojson | 7946.0.16 | MIT |  | [LICENSE](licenses/npm/types--geojson--7946.0.16/LICENSE) |
| @types/trusted-types | 2.0.7 | MIT |  | [LICENSE](licenses/npm/types--trusted-types--2.0.7/LICENSE) |
| @upsetjs/venn.js | 2.0.0 | MIT | 예 | [LICENSE](licenses/npm/upsetjs--venn.js--2.0.0/LICENSE) |
| argparse | 2.0.1 | Python-2.0 |  | [LICENSE](licenses/npm/argparse--2.0.1/LICENSE) |
| chevrotain | 11.1.2 | Apache-2.0 | 예 | [LICENSE.txt](licenses/npm/chevrotain--11.1.2/LICENSE.txt) |
| codemirror | 6.0.2 | MIT | 예 | [LICENSE](licenses/npm/codemirror--6.0.2/LICENSE) |
| commander | 7.2.0 | MIT |  | [LICENSE](licenses/npm/commander--7.2.0/LICENSE) |
| cose-base | 1.0.3 | MIT | 예 | [LICENSE](licenses/npm/cose-base--1.0.3/LICENSE) |
| crelt | 1.0.7 | MIT | 예 | [LICENSE](licenses/npm/crelt--1.0.7/LICENSE) |
| cytoscape | 3.34.3 | MIT | 예 | [LICENSE](licenses/npm/cytoscape--3.34.3/LICENSE), [license-update.mjs](licenses/npm/cytoscape--3.34.3/license-update.mjs) |
| cytoscape-cose-bilkent | 4.1.0 | MIT | 예 | [LICENSE](licenses/npm/cytoscape-cose-bilkent--4.1.0/LICENSE) |
| cytoscape-fcose | 2.2.0 | MIT | 예 | [LICENSE](licenses/npm/cytoscape-fcose--2.2.0/LICENSE) |
| cose-base | 2.2.0 | MIT | 예 | [LICENSE](licenses/npm/cose-base--2.2.0/LICENSE) |
| layout-base | 2.0.1 | MIT | 예 | [LICENSE](licenses/npm/layout-base--2.0.1/LICENSE) |
| d3 | 7.9.0 | ISC |  | [LICENSE](licenses/npm/d3--7.9.0/LICENSE) |
| d3-array | 3.2.4 | ISC | 예 | [LICENSE](licenses/npm/d3-array--3.2.4/LICENSE) |
| d3-axis | 3.0.0 | ISC | 예 | [LICENSE](licenses/npm/d3-axis--3.0.0/LICENSE) |
| d3-brush | 3.0.0 | ISC | 예 | [LICENSE](licenses/npm/d3-brush--3.0.0/LICENSE) |
| d3-chord | 3.0.1 | ISC |  | [LICENSE](licenses/npm/d3-chord--3.0.1/LICENSE) |
| d3-color | 3.1.0 | ISC | 예 | [LICENSE](licenses/npm/d3-color--3.1.0/LICENSE) |
| d3-contour | 4.0.2 | ISC |  | [LICENSE](licenses/npm/d3-contour--4.0.2/LICENSE) |
| d3-delaunay | 6.0.4 | ISC |  | [LICENSE](licenses/npm/d3-delaunay--6.0.4/LICENSE) |
| d3-dispatch | 3.0.1 | ISC | 예 | [LICENSE](licenses/npm/d3-dispatch--3.0.1/LICENSE) |
| d3-drag | 3.0.0 | ISC |  | [LICENSE](licenses/npm/d3-drag--3.0.0/LICENSE) |
| d3-dsv | 3.0.1 | ISC |  | [LICENSE](licenses/npm/d3-dsv--3.0.1/LICENSE) |
| d3-ease | 3.0.1 | BSD-3-Clause | 예 | [LICENSE](licenses/npm/d3-ease--3.0.1/LICENSE) |
| d3-fetch | 3.0.1 | ISC |  | [LICENSE](licenses/npm/d3-fetch--3.0.1/LICENSE) |
| d3-force | 3.0.0 | ISC |  | [LICENSE](licenses/npm/d3-force--3.0.0/LICENSE) |
| d3-format | 3.1.2 | ISC | 예 | [LICENSE](licenses/npm/d3-format--3.1.2/LICENSE) |
| d3-geo | 3.1.1 | ISC |  | [LICENSE](licenses/npm/d3-geo--3.1.1/LICENSE) |
| d3-hierarchy | 3.1.2 | ISC | 예 | [LICENSE](licenses/npm/d3-hierarchy--3.1.2/LICENSE) |
| d3-interpolate | 3.0.1 | ISC | 예 | [LICENSE](licenses/npm/d3-interpolate--3.0.1/LICENSE) |
| d3-path | 3.1.0 | ISC | 예 | [LICENSE](licenses/npm/d3-path--3.1.0/LICENSE) |
| d3-polygon | 3.0.1 | ISC |  | [LICENSE](licenses/npm/d3-polygon--3.0.1/LICENSE) |
| d3-quadtree | 3.0.1 | ISC |  | [LICENSE](licenses/npm/d3-quadtree--3.0.1/LICENSE) |
| d3-random | 3.0.1 | ISC |  | [LICENSE](licenses/npm/d3-random--3.0.1/LICENSE) |
| d3-sankey | 0.12.3 | BSD-3-Clause | 예 | [LICENSE](licenses/npm/d3-sankey--0.12.3/LICENSE) |
| d3-array | 2.12.1 | BSD-3-Clause | 예 | [LICENSE](licenses/npm/d3-array--2.12.1/LICENSE) |
| d3-path | 1.0.9 | BSD-3-Clause | 예 | [LICENSE](licenses/npm/d3-path--1.0.9/LICENSE) |
| d3-shape | 1.3.7 | BSD-3-Clause | 예 | [LICENSE](licenses/npm/d3-shape--1.3.7/LICENSE) |
| internmap | 1.0.1 | ISC |  | [LICENSE](licenses/npm/internmap--1.0.1/LICENSE) |
| d3-scale | 4.0.2 | ISC | 예 | [LICENSE](licenses/npm/d3-scale--4.0.2/LICENSE) |
| d3-scale-chromatic | 3.1.0 | ISC | 예 | [LICENSE](licenses/npm/d3-scale-chromatic--3.1.0/LICENSE) |
| d3-selection | 3.0.0 | ISC | 예 | [LICENSE](licenses/npm/d3-selection--3.0.0/LICENSE) |
| d3-shape | 3.2.0 | ISC | 예 | [LICENSE](licenses/npm/d3-shape--3.2.0/LICENSE) |
| d3-time | 3.1.0 | ISC | 예 | [LICENSE](licenses/npm/d3-time--3.1.0/LICENSE) |
| d3-time-format | 4.1.0 | ISC | 예 | [LICENSE](licenses/npm/d3-time-format--4.1.0/LICENSE) |
| d3-timer | 3.0.1 | ISC | 예 | [LICENSE](licenses/npm/d3-timer--3.0.1/LICENSE) |
| d3-transition | 3.0.1 | ISC | 예 | [LICENSE](licenses/npm/d3-transition--3.0.1/LICENSE) |
| d3-zoom | 3.0.0 | ISC | 예 | [LICENSE](licenses/npm/d3-zoom--3.0.0/LICENSE) |
| dagre-d3-es | 7.0.14 | MIT | 예 | [LICENSE.md](licenses/npm/dagre-d3-es--7.0.14/LICENSE.md) |
| dayjs | 1.11.23 | MIT | 예 | [LICENSE](licenses/npm/dayjs--1.11.23/LICENSE) |
| delaunator | 5.1.0 | ISC |  | [LICENSE](licenses/npm/delaunator--5.1.0/LICENSE) |
| dompurify | 3.4.16 | (MPL-2.0 OR Apache-2.0) | 예 | [LICENSE](licenses/npm/dompurify--3.4.16/LICENSE), [LICENSE-MPL](licenses/npm/dompurify--3.4.16/LICENSE-MPL), [license_header](licenses/npm/dompurify--3.4.16/src/license_header) |
| elkjs | 0.11.0 | EPL-2.0 | 예 | [LICENSE.md](licenses/npm/elkjs--0.11.0/LICENSE.md) |
| es-toolkit | 1.52.0 | MIT | 예 | [LICENSE](licenses/npm/es-toolkit--1.52.0/LICENSE), [NOTICE](licenses/npm/es-toolkit--1.52.0/NOTICE) |
| esbuild | 0.28.2 | MIT |  | [LICENSE.md](licenses/npm/esbuild--0.28.2/LICENSE.md) |
| hachure-fill | 0.5.2 | MIT |  | [LICENSE](licenses/npm/hachure-fill--0.5.2/LICENSE) |
| iconv-lite | 0.6.3 | MIT |  | [LICENSE](licenses/npm/iconv-lite--0.6.3/LICENSE) |
| import-meta-resolve | 4.2.0 | MIT |  | [license](licenses/npm/import-meta-resolve--4.2.0/license) |
| internmap | 2.0.3 | ISC | 예 | [LICENSE](licenses/npm/internmap--2.0.3/LICENSE) |
| js-yaml | 5.4.2 | MIT | 예 | [LICENSE](licenses/npm/js-yaml--5.4.2/LICENSE) |
| katex | 0.16.47 | MIT | 예 | [LICENSE](licenses/npm/katex--0.16.47/LICENSE) |
| commander | 8.3.0 | MIT |  | [LICENSE](licenses/npm/commander--8.3.0/LICENSE) |
| khroma | 2.1.0 | MIT | 예 | [license](licenses/npm/khroma--2.1.0/license) |
| layout-base | 1.0.2 | MIT | 예 | [LICENSE](licenses/npm/layout-base--1.0.2/LICENSE) |
| lodash-es | 4.18.1 | MIT | 예 | [LICENSE](licenses/npm/lodash-es--4.18.1/LICENSE) |
| marked | 16.4.2 | MIT | 예 | [LICENSE.md](licenses/npm/marked--16.4.2/LICENSE.md) |
| mermaid | 12.0.0 | MIT | 예 | [LICENSE](licenses/npm/mermaid--12.0.0/LICENSE) |
| elkjs | 0.9.3 | EPL-2.0 | 예 | [LICENSE.md](licenses/npm/elkjs--0.9.3/LICENSE.md) |
| package-manager-detector | 1.8.0 | MIT |  | [LICENSE](licenses/npm/package-manager-detector--1.8.0/LICENSE) |
| path-data-parser | 0.1.0 | MIT |  | [LICENSE](licenses/npm/path-data-parser--0.1.0/LICENSE) |
| pngjs | 7.0.0 | MIT |  | [LICENSE](licenses/npm/pngjs--7.0.0/LICENSE) |
| points-on-curve | 0.2.0 | MIT |  | [LICENSE](licenses/npm/points-on-curve--0.2.0/LICENSE) |
| points-on-path | 0.2.1 | MIT |  | [LICENSE](licenses/npm/points-on-path--0.2.1/LICENSE) |
| robust-predicates | 3.0.3 | Unlicense |  | [LICENSE](licenses/npm/robust-predicates--3.0.3/LICENSE) |
| roughjs | 4.6.6 | MIT | 예 | [LICENSE](licenses/npm/roughjs--4.6.6/LICENSE) |
| rw | 1.3.3 | BSD-3-Clause |  | [LICENSE](licenses/npm/rw--1.3.3/LICENSE) |
| safer-buffer | 2.1.2 | MIT |  | [LICENSE](licenses/npm/safer-buffer--2.1.2/LICENSE) |
| style-mod | 4.1.4 | MIT | 예 | [LICENSE](licenses/npm/style-mod--4.1.4/LICENSE) |
| stylis | 4.4.0 | MIT | 예 | [LICENSE](licenses/npm/stylis--4.4.0/LICENSE) |
| tinyexec | 1.3.1 | MIT |  | [LICENSE](licenses/npm/tinyexec--1.3.1/LICENSE) |
| ts-dedent | 2.3.0 | MIT | 예 | [LICENSE](licenses/npm/ts-dedent--2.3.0/LICENSE) |
| uuid | 14.0.2 | MIT | 예 | [LICENSE.md](licenses/npm/uuid--14.0.2/LICENSE.md) |
| w3c-keyname | 2.2.8 | MIT | 예 | [LICENSE](licenses/npm/w3c-keyname--2.2.8/LICENSE) |
<!-- npm inventory:end -->
