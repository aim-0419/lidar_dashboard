# Backend Conventions

이 문서는 라이다 역주행 대시보드 백엔드 개발 시 DB, Prisma, JavaScript 코드, API 문서에서 이름을 일관되게 쓰기 위한 규칙입니다.

## 1. 기본 원칙

- DB 테이블명과 컬럼명은 `snake_case`를 사용한다.
- JavaScript 코드, Prisma 모델 필드, API Request/Response JSON은 `camelCase`를 사용한다.
- 각 테이블의 PK 컬럼명은 항상 `id`로 통일한다.
- 각 테이블의 PK 타입은 PostgreSQL `BIGSERIAL` 기준으로 설계한다.
- FK 컬럼명은 참조 대상의 의미를 기준으로 `{name}_id` 형태를 사용한다.
- API URI의 path parameter는 `:id`를 기본으로 사용한다.

## 2. DB Naming

| 대상 | 규칙 | 예시 |
|---|---|---|
| 테이블명 | 복수형 `snake_case` | `users`, `wrongway_events`, `event_actions` |
| PK | 항상 `id` | `id BIGSERIAL` |
| FK | `{name}_id` | `event_id`, `actor_user_id`, `device_id` |
| 일반 컬럼 | `snake_case` | `event_timestamp`, `raw_payload`, `created_at` |
| 생성일 | `created_at` | `TIMESTAMPTZ` |
| 수정일 | `updated_at` | `TIMESTAMPTZ` |

## 3. Code/API Naming

DB 컬럼은 `snake_case`로 저장하지만, 백엔드 코드와 API JSON에서는 `camelCase`를 사용한다.

| DB 컬럼 | Prisma/JS/API |
|---|---|
| `id` | `id` |
| `event_id` | `eventId` |
| `actor_user_id` | `actorUserId` |
| `device_id` | `deviceId` |
| `event_timestamp` | `eventTimestamp` |
| `received_at` | `receivedAt` |
| `raw_payload` | `rawPayload` |
| `source_ip` | `sourceIp` |
| `created_at` | `createdAt` |
| `updated_at` | `updatedAt` |

## 4. event_id 규칙

이 프로젝트에서 `event_id`는 라이다 PC가 보내는 역주행 이벤트 고유 ID를 의미한다.

- `wrongway_events.id`: 백엔드 DB 내부 PK
- `wrongway_events.event_id`: 라이다 PC가 보낸 이벤트 고유 ID
- `event_actions.event_id`: `wrongway_events.id`를 참조하는 FK
- `system_logs.event_id`: `wrongway_events.id`를 참조하는 FK

주의: 같은 DB 이름 `event_id`라도 테이블에 따라 의미가 달라질 수 있으므로, 코드에서는 아래처럼 명확히 구분한다.

| 위치 | DB 컬럼 | 코드/API 이름 | 의미 |
|---|---|---|---|
| `wrongway_events` | `id` | `id` | 내부 PK |
| `wrongway_events` | `event_id` | `eventId` | 라이다 PC 이벤트 ID |
| `event_actions` | `event_id` | `eventId` | 내부 이벤트 PK 참조 |
| `system_logs` | `event_id` | `eventId` | 내부 이벤트 PK 참조 |

헷갈림을 줄이기 위해 API 문서에서는 해당 필드 설명에 "라이다 이벤트 ID" 또는 "DB 이벤트 ID"를 명시한다.

## 5. Prisma Mapping

Prisma 모델 필드는 `camelCase`로 작성하고, 실제 DB 컬럼명은 `@map()`으로 연결한다.

```prisma
model WrongwayEvent {
  id             BigInt   @id @default(autoincrement())
  eventId        String   @map("event_id")
  deviceId       BigInt?  @map("device_id")
  eventTimestamp DateTime @map("event_timestamp")
  receivedAt     DateTime @map("received_at")
  trackId        String?  @map("track_id")
  zoneId         String?  @map("zone_id")
  rawPayload     Json?    @map("raw_payload")
  sourceIp       String?  @map("source_ip")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  @@map("wrongway_events")
}
```

## 6. API Response Naming

API 응답은 React 프론트엔드에서 바로 쓰기 쉽도록 `camelCase`를 사용한다.

```json
{
  "success": true,
  "data": {
    "id": 1,
    "eventId": "evt-001",
    "deviceId": 1,
    "trackId": "track-12",
    "zoneId": "EXIT-B",
    "rawPayload": {}
  },
  "message": "OK"
}
```

## 7. Error Response

실패 응답은 아래 형태로 통일한다.

```json
{
  "success": false,
  "error": {
    "status": 404,
    "code": "WRONGWAY_EVENT_NOT_FOUND",
    "message": "역주행 이벤트를 찾을 수 없습니다",
    "details": []
  }
}
```

| 필드 | 의미 |
|---|---|
| `success` | 요청 성공 여부 |
| `error.status` | HTTP 상태코드 숫자 |
| `error.code` | 도메인 포함 에러 코드 |
| `error.message` | 사람이 읽을 수 있는 메시지 |
| `error.details` | 필드별 상세 오류. 없으면 `[]` |
