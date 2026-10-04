<p align="center"><img src="web/assets/chaterd.png" width="160" height="160" alt="ChatERD 로고"></p>

# ChatERD

Mermaid ERD 파일을 편집하고 다이어그램으로 확인하는 로컬 도구입니다. **Codex 없이도 사용할 수 있습니다.**

## 시작하기

[Node.js](https://nodejs.org/) 22.12 이상을 설치한 뒤 실행하세요.

```sh
git clone https://github.com/Yumetri/ChatERD.git
cd ChatERD
npm run setup
node runtime/cli.mjs preview examples/sample.mmd
```

내 파일을 열려면 마지막 명령의 경로를 바꾸세요.

```sh
node runtime/cli.mjs preview erds/my-schema.mmd
```

개인 ERD 파일은 `erds/`에 넣으면 Git에서 제외됩니다.

## 주요 기능

- 코드 편집과 자동 저장, 외부 파일 변경 시 자동 새로고침
- 테이블과 관계선 이동, 자동 배치, 실행 취소·다시 실행
- 테이블·제약 정보와 그룹별 보기
- 다크·라이트 테마, PNG·SVG 다운로드

[추가 설계 정보 작성법](references/schema-metadata.md)

## AI와 함께 쓰기

다른 AI 도구로 `.mmd` 파일을 수정해도 뷰어에 반영됩니다. 내장 `draw`·`discuss` 명령과 [`db-draw`](skills/db-draw/SKILL.md)·[`db-discuss`](skills/db-discuss/SKILL.md) 스킬은 Codex용 선택 기능입니다.

## 라이선스

ChatERD는 [MIT 라이선스](LICENSE)로 제공합니다. 제3자 구성요소에는 각 원래 라이선스가 적용됩니다.

- [제3자 고지](THIRD_PARTY_NOTICES.md)
- [라이선스 원문](licenses/)
- [ELK 등 제3자 소스 제공 안내](docs/third-party-sources.md)
- [다운로드와 소스 아카이브](https://github.com/Yumetri/ChatERD/releases/tag/v0.1.0)
