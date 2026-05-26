# AGENTS.md

이 문서는 AI 에이전트용 라우터다. 작업 전 요청 범위에 맞는 문서만 읽고 따른다.

- 피드백/승인: `docs/ai/feedback-loop.md`
- 설계: `docs/ai/design.md`
- 구현: `docs/ai/implementation.md`
- 백엔드: `docs/ai/backend.md`
- 프론트엔드: `docs/ai/frontend.md`
- Docker: `docs/ai/docker.md`
- 린트/테스트: `docs/ai/lint-test.md`
- 프로젝트 메모: `docs/ai/project-notes.md`

공통 규칙:
- 요청을 먼저 짧게 요약한다.
- 모르면 모른다고 말하고 질문한다.
- 확인하지 않은 사실은 단정하지 않는다.
- 승인 없이 코드, 설정, 의존성, DB, 배포 파일을 바꾸지 않는다.
- 요청 범위 밖 리팩토링과 추가 기능을 하지 않는다.
- 검증하지 않은 결과는 `미검증`이라고 보고한다.
