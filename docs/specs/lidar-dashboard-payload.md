# 라이다 PC -> 대시보드 payload 규격

이 문서는 라이다 PC가 대시보드로 전송하는 HTTP JSON 데이터의 현재 기준입니다.

## 기본 연동 정보

- 방향: 라이다 PC -> 대시보드
- 방식: HTTP POST
- Content-Type: `application/json`
- endpoint: `/api/wrongway`

## 현재 예상 payload

```json
{
  "type": "wrong-way",
  "timestamp": "2026-06-19T15:50:11.908091+09:00",
  "confidence": 0.95,
  "zone_id": "Z327",
  "track_id": "grid_16648_16670",
  "message": "Vehicle detected (replay)",
  "speed_ms": 2.9173103921382224,
  "speed_kmh": 10.5023174116976,
  "object_class": 6,
  "uuid": "82760000",
  "description": "Wrong-way driving detected (Heading and Path Confirmed)"
}
```

## 필드 설명

| 필드 | 논리 이름 | 설명 |
| --- | --- | --- |
| `type` | 이벤트 유형 | 현재는 `wrong-way`가 전달될 것으로 예상합니다. |
| `timestamp` | 이벤트 발생 시간 | KST ISO 문자열 형식을 기대합니다. |
| `confidence` | 감지 신뢰도 | 예시상 0~1 범위로 보이며 산정 기준은 추가 확인 중입니다. |
| `zone_id` | 감지 구역 ID | lanelet ID를 `Z01`, `Z327` 형태로 변환한 값입니다. |
| `track_id` | 객체/트래킹 ID | `stable_object_id` 기반 값으로 이해하고 있습니다. |
| `message` | 이벤트 요약 메시지 | 현재는 `"Vehicle detected (replay)"` 고정값일 수 있습니다. |
| `speed_ms` | 속도(m/s) | 추가 제공 가능성이 있는 필드입니다. |
| `speed_kmh` | 속도(km/h) | 추가 제공 가능성이 있는 필드입니다. |
| `object_class` | 객체 종류 코드 | 코드표에서 4번 값은 추가 확인 중입니다. |
| `uuid` | 객체 UUID | 라이다 PC 내부 객체 UUID입니다. |
| `description` | 감지 상세 설명 | 감지 사유 또는 상태 설명입니다. |

## 현재 제외한 필드

- `normal_moving_vehicle_count`
  - 역주행 이벤트에만 포함되면 정상 통과 차량 수를 안정적으로 집계하기 어렵습니다.
  - 정주행 이벤트를 별도 `type`으로 받을 수 있는지 확인 요청 중입니다.

## 추가 확인 중인 사항

- `object_class` 코드표의 4번 값
- `confidence` 산정 기준
- 정주행 이벤트 제공 가능 여부
- 1차 감지, 2차 감지, 상황 종료를 구분할 수 있는 `type` 또는 `description` 제공 가능 여부
- `consecutive_count`, `is_confirmed`의 의미

## 제공되지 않는 것으로 보는 항목

- CCTV
- 스냅샷
- 영상 URL
- 번호판 인식 결과

위 항목은 라이다 PC 이벤트 JSON이 아니라 추후 별도 CCTV/카메라 연동 영역으로 봅니다.
