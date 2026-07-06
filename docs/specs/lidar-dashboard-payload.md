# 라이다 PC -> 대시보드 payload 규격

이 문서는 라이다 PC가 대시보드 백엔드로 전송하는 HTTP JSON 데이터의 현재 개발 기준입니다.

## 기본 연동 정보

- 방향: 라이다 PC -> 대시보드 백엔드
- 방식: HTTP POST
- Content-Type: `application/json`
- endpoint: `/api/wrongway`
- 정주행 데이터: 차량이 감지 범위에 있는 동안 1초 간격 전송 가능
- 역주행 1차 데이터: 상황 발생 시 1회 전송 기준

## 정주행 payload 예시

```json
{
  "type": "normal-driving",
  "warning_level": 0,
  "timestamp": "2026-01-13T14:43:53.860089+09:00",
  "confidence": 1.0,
  "zone_id": "Z261",
  "track_id": "54750000-0000-0000-0000-000000000000",
  "message": "정주행",
  "speed_ms": 0.5792374909226594,
  "speed_kmh": 2.085254967321574,
  "object_class": 1,
  "description": "Normal",
  "consecutive_count": 0,
  "is_confirmed": false
}
```

## 역주행 1차 payload 예시

```json
{
  "type": "wrong-way-level-1",
  "warning_level": 1,
  "timestamp": "2026-01-13T14:43:54.360258+09:00",
  "confidence": 0.95,
  "zone_id": "Z327",
  "track_id": "81760000-0000-0000-0000-000000000000",
  "message": "역주행 1차 감지",
  "speed_ms": 2.835765050970876,
  "speed_kmh": 10.208754183495154,
  "object_class": 6,
  "description": "Wrong-way driving detected (Heading and Path Confirmed)",
  "consecutive_count": 3,
  "is_confirmed": true
}
```

## 필드 설명

| 필드 | 논리 이름 | 설명 |
| --- | --- | --- |
| `type` | 이벤트 유형 | `normal-driving`, `wrong-way-level-1` 기준으로 처리합니다. |
| `warning_level` | 경고 단계 | 정주행 0, 역주행 1차 1, 역주행 2차 2 기준입니다. |
| `timestamp` | 이벤트 발생 시간 | KST ISO 문자열 형식을 기대합니다. |
| `confidence` | 감지 신뢰도 | 예시상 0~1 범위입니다. 판단 기준으로 쓰지 않고 표시/저장합니다. |
| `zone_id` | 외부 감지 구역 ID | 라이다 PC의 lanelet ID 기반 구역 코드입니다. |
| `track_id` | 객체/트래킹 ID | 동일 차량 중복 처리와 `VehicleTrack` upsert 기준입니다. |
| `message` | 이벤트 요약 메시지 | 화면 표시와 로그 확인에 사용합니다. |
| `speed_ms` | 속도(m/s) | optional 값입니다. |
| `speed_kmh` | 속도(km/h) | optional 값입니다. |
| `object_class` | 객체 종류 코드 | 코드표의 4번 값은 추가 확인이 필요합니다. |
| `description` | 감지 상세 설명 | 감지 사유 또는 상태 설명입니다. |
| `consecutive_count` | 연속 감지 횟수 | 라이다 PC 판단 로직 확인용 값입니다. |
| `is_confirmed` | 확정 여부 | 라이다 PC가 판단한 감지 확정 여부입니다. |

## 현재 처리 기준

- `normal-driving`
  - 1초 간격으로 반복 수신될 수 있습니다.
  - 매번 이벤트로 저장하지 않습니다.
  - 같은 `track_id` 기준으로 `VehicleTrack`을 upsert하여 최신 상태만 갱신합니다.

- `wrong-way-level-1`
  - `TrafficEvent`와 `EventLog`에 저장합니다.
  - 같은 `track_id`와 같은 경고 단계가 이미 저장되어 있으면 중복 저장하지 않습니다.

- `wrong-way-level-2`, `situation-ended`
  - adapter에서 타입 수신은 가능하지만 실제 저장/상태 변경 로직은 후속 개발 범위입니다.

## 현재 제외한 필드

- `uuid`
  - 최신 전달 규격에서 제외된 것으로 보고 사용하지 않습니다.
- `normal_moving_vehicle_count`
  - 라이다 PC가 보내는 값에 의존하지 않고 대시보드 DB 기준으로 계산합니다.

## Swagger 테스트 API

- `GET /api/wrongway/test-payloads`
  - 현재 테스트 payload와 테스트 URL 목록을 조회합니다.
- `POST /api/wrongway/test/normal`
  - 정주행 payload를 1회 생성해 기존 `/api/wrongway` 처리 흐름으로 보냅니다.
- `POST /api/wrongway/test/normal-stream/start`
  - 정주행 payload를 1초 간격으로 반복 처리합니다.
- `POST /api/wrongway/test/normal-stream/stop`
  - 정주행 반복 처리를 중지합니다.
- `GET /api/wrongway/test/normal-stream/status`
  - 정주행 반복 처리 상태를 조회합니다.
- `POST /api/wrongway/test/wrong-way-level-1`
  - 역주행 1차 payload를 1회 생성해 기존 `/api/wrongway` 처리 흐름으로 보냅니다.

## 제공되지 않는 것으로 보는 항목

- CCTV
- 스냅샷
- 영상 URL
- 번호판 인식 결과

위 항목은 라이다 PC 이벤트 JSON이 아니라 추후 별도 CCTV/카메라 연동 영역으로 봅니다.
