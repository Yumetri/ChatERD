# Third-party source availability / 제3자 소스 제공

ChatERD에는 Eclipse Public License 2.0으로 제공되는 elkjs 및 Eclipse Layout Kernel(ELK), 그리고 EPL-1.0의 EMF GWT 코드가 포함됩니다. 이 구성 요소의 수정 가능한 소스는 각각의 EPL 조건으로 제공됩니다. ChatERD의 MIT 라이선스가 이 소스의 라이선스를 대체하지 않습니다.

## 소스 받기

[v0.1.0 릴리스의 `third-party-sources-v0.1.0.tar.gz`](https://github.com/Yumetri/ChatERD/releases/download/v0.1.0/third-party-sources-v0.1.0.tar.gz)를 다운로드하세요. 이 파일은 아래 ELK/elkjs 전체 소스 아카이브, Java 의존성의 Maven Central 소스 JAR·POM, 내장 JavaScript 패키지 원본 tgz, ELK #955 최종 diff와 원래 patch series, 체크섬 및 이 안내를 함께 제공합니다. npm 패키지에 들어 있는 생성 JavaScript만으로 소스 제공을 대신하지 않습니다.

원본은 아래 고정 리비전과 `embedded-java-manifest.json`의 Maven Central URL에서도 받을 수 있습니다. [소스 체크섬](third-party-source-checksums.json)은 릴리스 아카이브 안의 개별 파일을 검증합니다.

| 배포 구성 요소 | elkjs 소스 | Java ELK 소스 |
|---|---|---|
| 직접 의존성 elkjs 0.11.0 | [`37e798513db6e88b2e205b8239ed4e387d5f24d0`](https://github.com/kieler/elkjs/tree/37e798513db6e88b2e205b8239ed4e387d5f24d0) | ELK 0.11.0 [`54123e884b1ae743b453260f713b20c9bf5787f2`](https://github.com/eclipse-elk/elk/tree/54123e884b1ae743b453260f713b20c9bf5787f2) |
| Mermaid의 elkjs 0.9.3 | [`a8304cf79fde75bc2ab1a89d28320f53f8637436`](https://github.com/kieler/elkjs/tree/a8304cf79fde75bc2ab1a89d28320f53f8637436) | ELK 0.9.1 [`62d5909f96fad541bc101ad52dabaece6b7eab7e`](https://github.com/eclipse-elk/elk/tree/62d5909f96fad541bc101ad52dabaece6b7eab7e) + upstream [PR #955](https://github.com/eclipse-elk/elk/pull/955) |

ELK 0.9.3이라는 Java 릴리스로 대응시키지 않습니다. [elkjs 0.9.3 릴리스 안내](https://github.com/kieler/elkjs/releases/tag/0.9.3)에 ELK 0.9.1과 추가 패치가 명시되어 있습니다. #955 최종 merge commit은 `7ca51784e42a24201f29bc13e458728b6fc61cdc`입니다. 제공한 [최종 diff](elk-955.diff)는 ELK 0.9.1 원본에서 `git apply --check`로 확인했습니다.

## Java 빌드 입력과 라이선스

| 구성 요소 | 버전 | 라이선스 |
|---|---|---|
| Guava / Guava GWT | 31.1-jre | Apache-2.0 |
| GWT user | 2.10.0 (elkjs 0.9.3), 2.11.0 (elkjs 0.11.0) | Apache-2.0 및 포함 파일의 원래 고지 |
| EMF GWT common / ecore | 2.12.4 | EPL-1.0; ecore의 Xerces 유래 파일은 Apache-1.1 |
| Xtext Xbase / Xtend lib | 2.28.0, 2.36.0 | EPL-2.0 |

EMF ecore의 XML 정규식 코드에는 Apache Software License 1.1 원문과 Apache Software Foundation 저작권·감사 고지가 포함되어 있습니다. [원래 헤더](../licenses/embedded/emf-ecore--2.12.4/SOURCE_NOTICES.txt)를 함께 보존합니다.

이 목록은 upstream `build.gradle`의 소스 입력을 보수적으로 포함합니다. 모든 입력 클래스가 최종 JavaScript에 들어간다는 뜻은 아닙니다. 각 소스 JAR의 원래 저작권·라이선스 헤더는 아카이브에 유지하며, [`licenses/embedded/`](../licenses/embedded/)에도 수집합니다. 출처·버전·파일 SHA-256은 [Java manifest](embedded-java-manifest.json)에 기록합니다. npm 의존성은 [별도 manifest](dependency-manifest.json)에 기록합니다.

전체 ELK 저장소의 NOTICE에는 libavoid 등의 선택적 구성 요소도 나옵니다. elkjs의 `elkSources`에는 `org.eclipse.elk.alg.libavoid`와 Graphviz 외부 실행기가 포함되지 않습니다. 소스 제공을 위해 보존한 전체 upstream 아카이브는 최종 브라우저 번들보다 범위가 넓으며, 그 안의 별도 라이선스는 그대로 유지됩니다.

## ELK 내장 JavaScript

web-worker의 Apache-2.0 shim, Browserify/browser-pack와 UMD의 MIT 로더, Babel helper의 MIT 원문도 함께 제공합니다. [추가 manifest](embedded-js-manifest.json)에 버전·원문 체크섬을 기록합니다. 0.11.0의 버전은 upstream lock에서 확인했습니다. 0.9.3 shim의 정확한 npm 패치 버전은 기록되어 있지 않아 실제 배포 shim을 고지 파일에 보존하며, Babel 6 자료는 빌드 입력을 보수적으로 제공하는 것입니다.

## 수정 여부와 빌드

ChatERD는 설치된 ELK/elkjs 및 Java 라이브러리 소스를 직접 패치하지 않습니다. 위 #955는 upstream elkjs 릴리스가 포함한 패치입니다. ChatERD 배포용 JavaScript에는 esbuild의 번들링·압축을 적용하며 원래 법적 주석은 `.LEGAL.txt` 파일로 보존합니다. 원래 EPL·Apache 및 기타 고지를 함께 배포합니다.

elkjs wrapper의 `src/js`, `src/java`, `src/java-additional`, `build.gradle`, Gradle wrapper 및 `package.json`이 해당 소스 아카이브에 포함되어 있습니다. 각 버전의 elkjs와 위에 대응하는 elk 소스를 `elkjs/`와 `elk/` 형제 디렉터리로 풉니다. 0.9.3에는 ELK 0.9.1에 최종 diff를 적용합니다. upstream build는 Java 8–17을 요구하며 0.11.0은 Java 17을 사용하는 것이 적합합니다. 해당 버전의 README와 `build.gradle`을 따라 `npm install` 및 `npm run build`를 실행합니다. GWT·Gradle·Maven 빌드 도구와 메타데이터 생성기도 필요합니다.

이 릴리스에서 Java/GWT 전체 재컴파일의 바이트 동일성은 검증하지 않았습니다. 제공 자료는 수정 가능한 소스, 버전 대응, 빌드 설정 및 원래 고지를 제공하기 위한 것입니다. ChatERD 자체는 Java 없이 Node.js에서 `npm ci`, `npm run build`로 빌드합니다.

## 라이선스 원문

- [EPL-2.0 원문](../licenses/embedded/elkjs-0.11.0/LICENSE.md), [공식 EPL-2.0](https://www.eclipse.org/legal/epl/epl-v20.html)
- [EPL-1.0 원문](../licenses/embedded/EPL-1.0.html), [공식 EPL-1.0](https://www.eclipse.org/legal/epl-v10.html)
- [Apache-2.0 원문](../licenses/embedded/Apache-2.0.txt)
- [전체 제3자 고지](../THIRD_PARTY_NOTICES.md)
