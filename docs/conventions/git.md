# Git 컨벤션

이 문서는 라이다 역주행 대시보드 프로젝트의 Git 작업 기준을 정의합니다.

## 기본 원칙

- 하나의 브랜치는 하나의 목적을 가집니다.
- 관련 없는 수정은 같은 커밋에 섞지 않습니다.
- 자동 포맷, 대규모 리팩토링, 기능 변경은 가능하면 분리합니다.
- 민감정보가 포함된 `.env`, token, password, key 파일은 커밋하지 않습니다.
- 생성물, 빌드 결과물, `node_modules`는 커밋하지 않습니다.

## 브랜치 네이밍

형식:

```text
type/short-description
```

예:

```text
feature/auth-login
feature/user-management
feature/dashboard-ui
feature/mock-lidar-events
fix/swagger-docs
docs/conventions
refactor/server-domains
```

권장 type:

- `feature`: 기능 추가
- `fix`: 버그 수정
- `docs`: 문서 변경
- `refactor`: 동작 변경 없는 구조 개선
- `chore`: 설정, 빌드, 도구 변경
- `test`: 테스트 추가/수정

## 커밋 메시지

형식:

```text
type: 변경 요약
```

예:

```text
feat: 로그인 API 추가
feat: 사용자 목록 화면 추가
fix: 이벤트 상태 변경 응답 오류 수정
docs: 프론트엔드 컨벤션 추가
refactor: 이벤트 라우터 분리
chore: docker 환경 변수 예시 정리
```

규칙:

- 요약은 한 줄로 작성합니다.
- 무엇을 바꿨는지 명확히 적습니다.
- 여러 기능이 섞이면 커밋을 나눕니다.
- 테스트하지 않았다면 PR 설명에 `미검증`이라고 적습니다.

## PR 기준

PR에는 아래 내용을 포함합니다.

```text
## 변경 내용
- 

## 검증
- 실행한 명령:
- 결과:

## 영향 범위
- 

## 참고/주의
- 
```

검증 예:

```text
npm --prefix dashboard/dashboard-web run lint
npm --prefix dashboard/dashboard-web run build
npm --prefix dashboard/server start
docker compose up --build
```

실행하지 못한 검증은 이유를 적습니다.

## 리뷰 기준

리뷰 시 우선 확인할 것:

- 기존 기능을 깨뜨리는 변경인지
- API 응답 구조가 프론트와 맞는지
- Swagger 문서가 변경과 일치하는지
- Prisma schema와 migration 영향이 명확한지
- mock 데이터가 실제 데이터처럼 오해될 여지가 없는지
- 민감정보가 코드나 로그에 남지 않았는지

## 충돌 처리

- 충돌 파일을 무리하게 덮어쓰지 않습니다.
- 본인이 만든 변경과 다른 사람 변경을 구분합니다.
- 원인 파악 없이 `git reset --hard`를 사용하지 않습니다.
- lock 파일 변경은 의존성 변경 여부와 함께 확인합니다.

## 금지 사항

- `.env` 실제 파일 커밋 금지
- 비밀번호, API key, token 커밋 금지
- 임시 디버그 로그 커밋 금지
- 요청받지 않은 대규모 리팩토링 금지
- 실제 라이다 규격이 아닌 mock 데이터를 실제 규격처럼 문서화 금지
