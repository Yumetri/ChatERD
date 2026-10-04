<p align="center"><img src="web/assets/chaterd.png" width="160" height="160" alt="ChatERD 로고"></p>

# ChatERD

AI와 함께 Mermaid ERD를 설계하고 수정하는 스킬과 로컬 뷰어입니다.

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

## 스킬 사용

[`db-draw`](skills/db-draw/SKILL.md)로 ERD를 그리고 수정하고, [`db-discuss`](skills/db-discuss/SKILL.md)로 설계를 토론하세요. 요청에 대상 `.mmd` 파일 경로를 함께 전달합니다.

## 라이선스

ChatERD는 [MIT 라이선스](LICENSE)로 제공합니다. 제3자 구성요소에는 각 원래 라이선스가 적용됩니다.

- [제3자 고지](THIRD_PARTY_NOTICES.md)
- [라이선스 원문](licenses/)
- [ELK 등 제3자 소스 제공 안내](docs/third-party-sources.md)
- [다운로드와 소스 아카이브](https://github.com/Yumetri/ChatERD/releases/tag/v0.1.0)
