# AGENTS.md

이 문서는 AI 에이전트용 라우터입니다. 작업 전 요청 범위에 맞는 문서만 읽고 따릅니다.

## 공통 작업 원칙

- 요청을 먼저 짧게 요약합니다.
- 모르면 모른다고 말하고 질문합니다.
- 확인하지 않은 사실은 단정하지 않습니다.
- 승인 없이 코드, 설정, 의존성, DB, 배포 파일을 바꾸지 않습니다.
- 요청 범위 밖 리팩토링과 추가 기능을 하지 않습니다.
- 검증하지 않은 결과는 `미검증`이라고 보고합니다.

## AI 작업 문서

- 현재 프로젝트 컨텍스트: `docs/ai/project-context.md`
- 피드백/승인: `docs/ai/feedback-loop.md`
- 설계: `docs/ai/design.md`
- 구현: `docs/ai/implementation.md`
- 백엔드: `docs/ai/backend.md`
- 프론트엔드: `docs/ai/frontend.md`
- Docker: `docs/ai/docker.md`
- 린트/테스트: `docs/ai/lint-test.md`
- 테스트 피드백 루프: `docs/ai/testing-feedback-loop.md`
- 프로젝트 메모: `docs/ai/project-notes.md`
- AI 활용 가이드: `docs/ai/harness-engineering.md`

## 개발 컨벤션 문서

- 프로젝트 구조: `docs/conventions/project-structure.md`
- 프론트엔드 컨벤션: `docs/conventions/frontend.md`
- 백엔드 컨벤션: `docs/conventions/backend.md`
- Git 컨벤션: `docs/conventions/git.md`
- 환경 설정 컨벤션: `docs/conventions/environment.md`

## 연동 규격 문서

- 라이다 PC-대시보드 payload 규격: `docs/specs/lidar-dashboard-payload.md`
- 대시보드-통합제어보드 프로토콜 정의 TODO: `docs/specs/dashboard-control-board-protocol.md`

## 현재 프로젝트 전제

- 프론트엔드: `dashboard/dashboard-web`
- 백엔드: `dashboard/server`
- 데모/AI 감지 서버: `dashboard/demo-server`
- Docker 실행 기준: `docker-compose.yml`
- 라이다 PC 데이터 규격은 아직 확정되지 않았으므로 실제 연동부는 mock/adapter 구조로 분리합니다.
