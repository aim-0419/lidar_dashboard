# 백엔드 컨벤션

이 문서는 `dashboard/server` 개발 기준을 정의합니다.

## 기본 원칙

- 기존 Express 서버 동작을 우선 보존합니다.
- 새 API는 route, controller, service 책임을 분리합니다.
- Prisma ORM 사용 방향을 기본 전제로 하되, DB 스키마는 데이터 규격 확정 후 구체화합니다.
- Swagger UI에 노출되는 API 문서를 함께 관리합니다.
- 라이다 PC 실제 데이터 규격이 확정되기 전까지 실제 규격처럼 단정한 모델을 만들지 않습니다.

## 권장 레이어

```text
route
-> middleware
-> controller
-> service
-> repository
-> database
```

역할:

- `route`: URL, HTTP method, middleware 연결
- `controller`: request 파싱, response 반환
- `service`: 비즈니스 규칙과 트랜잭션 흐름
- `repository`: Prisma 기반 DB 접근
- `middleware`: 인증, IP 제한, 에러 처리

현재 DB 접근이 없는 도메인은 `repository`를 만들지 않습니다.

## 현재 디렉터리

```text
dashboard/server
- server.js
- scripts
  - check-syntax.js
- src
  - app.js
  - swagger.js
  - config
  - routes
  - domains
    - demo
    - mock-lidar
    - wrongway
  - realtime
  - simulator
  - utils
```

도메인 예시:

```text
domains/wrongway
- wrongway.routes.js
- wrongway.controller.js
- wrongway.service.js
- adapters
  - lidarHttp.adapter.js
- wrongway.dto.js
- wrongway.constants.js
```

## DTO와 adapter 기준

- `dto`: 컨트롤러가 받거나 반환하는 요청/응답 규격을 고정합니다.
- `adapter`: 외부 장비 payload를 대시보드 내부에서 쓰는 형태로 변환합니다.
- 라이다 PC처럼 외부 데이터가 조금씩 바뀔 수 있는 연동은 adapter에 변환 책임을 둡니다.
- `wrongway` 실제 저장 흐름에서 쓰는 라이다 HTTP adapter는 `domains/wrongway/adapters`에 둡니다.
- `external-ingest`는 현장 진단, mock 수신, 통합제어보드 패킷 확인처럼 DB 저장 전 수신 상태를 확인하는 용도로 둡니다.

## Prisma 기준

Prisma 사용 시 권장 위치:

```text
dashboard/server/prisma/schema.prisma
dashboard/server/prisma/seed.js
dashboard/server/src/prisma/client.js
```

규칙:

- DB 테이블과 컬럼은 `snake_case`를 사용합니다.
- Prisma 모델 필드는 `camelCase`를 사용하고 `@map`, `@@map`으로 DB 명과 연결합니다.
- migration은 스키마 변경 목적과 영향 확인 후 진행합니다.
- seed 데이터는 데모/개발용임을 명확히 구분합니다.
- 실제 라이다 규격에 없는 필드는 `rawPayload` 같은 JSON 필드로 유연하게 받습니다.

예:

```prisma
model WrongWayEvent {
  id          BigInt   @id @default(autoincrement())
  eventCode   String   @map("event_code")
  rawPayload  Json?    @map("raw_payload")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("wrong_way_events")
}
```

## API 응답 기준

성공 응답:

```json
{
  "success": true,
  "data": {},
  "message": "OK"
}
```

실패 응답:

```json
{
  "success": false,
  "error": {
    "status": 400,
    "code": "BAD_REQUEST",
    "message": "잘못된 요청입니다.",
    "details": []
  }
}
```

규칙:

- 프론트에서 사용하는 JSON 필드는 `camelCase`를 사용합니다.
- DB 컬럼명을 API 응답에 그대로 노출하지 않습니다.
- 에러 메시지는 사용자가 이해할 수 있는 문장으로 작성합니다.
- 내부 스택 트레이스, 토큰, 비밀번호, 원본 민감정보를 응답에 포함하지 않습니다.

## API URL 기준

- REST 성격의 API는 명사형 복수 경로를 우선합니다.
- mock API는 `/api/mock/*` 또는 tag로 명확히 구분합니다.
- 실제 라이다 수신 API는 mock API와 섞지 않습니다.
- 기존 URL을 변경할 경우 프론트, Swagger, README, Docker 데모 흐름을 함께 확인합니다.

예:

```text
GET /api/events
GET /api/events/:id
PATCH /api/events/:id/status
POST /api/mock/lidar/events
```

## Swagger 기준

- API를 추가하거나 변경하면 Swagger 문서도 함께 수정합니다.
- request body, response schema, error response를 가능한 함께 작성합니다.
- mock API는 tag 또는 summary에 `mock`임을 명시합니다.
- 실제 라이다 규격이 확정되지 않은 API는 설명에 `임시 개발용` 또는 `mock`을 명시합니다.

## 인증/권한

- 1차 개발은 `SUPER_ADMIN` 단일 권한을 전제로 합니다.
- JWT access token, refresh token 구조를 사용합니다.
- 비밀번호는 bcrypt로 해시 처리합니다.
- 원문 비밀번호를 DB, 로그, 응답에 남기지 않습니다.
- 세부 권한은 운영 정책 확정 후 구현합니다.

## IP 제한

외부망 접속 차단은 운영 환경에서는 방화벽, VPN, nginx 등 인프라 레벨 적용이 더 적절할 수 있습니다.

앱 레벨에서 먼저 구현할 경우:

- 허용 IP 목록은 환경 변수 또는 DB에서 관리합니다.
- proxy 환경에서는 `x-forwarded-for` 처리 여부를 확인합니다.
- 허용하지 않은 요청은 `403 Forbidden`으로 응답합니다.
- 개발 환경에서는 로컬 접속이 막히지 않도록 예외 설정을 둡니다.

## 라이다 mock 데이터 기준

- mock 데이터는 실제 조선대 측 라이다 PC 규격으로 가정하지 않습니다.
- 실제 규격 수신 전까지는 adapter 계층을 통해 변환 가능하게 만듭니다.
- 원본 payload가 필요하면 `rawPayload`에 저장합니다.
- 데이터 필드 의미가 불확실하면 주석이나 문서에 `확인 필요`라고 남깁니다.

## 로그 기준

- 에러 로그는 원인 추적에 필요한 범위만 남깁니다.
- 비밀번호, 토큰, API key, 개인정보를 로그에 남기지 않습니다.
- 라이다 원본 payload 전체 로그는 크기와 민감도를 확인한 후 제한적으로 사용합니다.

## 검증

백엔드 변경 후 가능한 검증:

```text
npm run check:server
npm run ci
npm --prefix dashboard/server start
```

`npm run check:server`는 `dashboard/server/scripts/check-syntax.js`를 통해 백엔드 JS 파일을 `node --check`로 검사합니다.

Swagger 확인:

```text
http://localhost:{PORT}/api-docs
```

테스트 스크립트가 없거나 실행하지 못한 경우 결과 보고에 `미검증`이라고 적고 이유를 설명합니다.
