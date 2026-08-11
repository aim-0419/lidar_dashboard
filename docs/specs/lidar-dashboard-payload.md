# 라이다 PC -> 대시보드 payload 규격

> 최종 업데이트: 2026-08-11

## 연동 정보

- 방식: `POST /api/wrongway`, `application/json`
- 단위: 한 시점의 스냅샷과 `objects` 다중 객체 배열
- 객체가 1개여도 배열로 전송
- 역주행 단계는 구분하지 않고 `wrong-way` 하나로 처리

## 예시

```json
{
  "timestamp": "2026-08-11T10:30:00.000+09:00",
  "source": "lidar-pc-01",
  "status": "wrong-way",
  "total_objects": 2,
  "moving_vehicle_count": 2,
  "normal_moving_vehicle_count": 1,
  "wrong_way_count": 1,
  "processing_time_ms": 8.518,
  "objects": [
    {
      "type": "normal-driving",
      "warning_level": 0,
      "confidence": 1.0,
      "zone_id": "Z469",
      "track_id": "track-normal-001",
      "message": "정주행",
      "speed_ms": 3.2,
      "speed_kmh": 11.52,
      "object_class": 1,
      "description": "Normal"
    },
    {
      "type": "wrong-way",
      "warning_level": 1,
      "confidence": 0.95,
      "zone_id": "Z455",
      "track_id": "track-wrongway-001",
      "message": "역주행 발생",
      "speed_ms": 2.8,
      "speed_kmh": 10.08,
      "object_class": 1,
      "description": "Wrong-way driving detected"
    }
  ]
}
```

## 객체 type

| type | 의미 | DB 처리 |
| --- | --- | --- |
| `normal-driving` | 정상 주행 | `vehicle_tracks` 최신 상태 갱신 |
| `wrong-way` | 역주행 발생 | 사건과 이벤트 이력 생성 |
| `situation-ended` | 상황 종료 | 진행 중인 사건 종료 처리 |
| `pedestrian-entered` | 보행자 진입 | 이벤트 이력 저장 |
| `pedestrian-exited` | 보행자 이탈 | 이벤트 이력 저장 |

## 저장 기준

- `vehicle_tracks`: 라이다 PC와 `track_id` 조합으로 upsert하여 1초 데이터의 최신 상태만 유지
- `traffic_events`: 상태가 바뀐 이벤트만 저장
- `safety_incidents`: 구역별 역주행 상황의 시작부터 해제까지 관리
- `daily_traffic_stats`: 처음 관측한 차량과 이벤트 수를 일별 집계
- `control_commands`: 프로토콜 확정 후 제어 요청과 응답 이력을 연결하기 위한 확장 테이블
- 반복 snapshot 전체 원본은 저장하지 않고 최초 객체 또는 이벤트 원본만 저장
- snapshot에서 3초 이상 보이지 않은 객체는 `is_active=false`로 전환

## 내부망 시나리오 검증

`npm run test:lidar-scenario -- --base-url http://서버IP:5000` 명령으로 다음 흐름을 실제 HTTP 요청으로 전송합니다.

1. 정주행 차량 A 진입
2. 정주행 차량 B·C 순차 진입
3. 정주행 차량 3대와 역주행 A 동시 감지
4. 일부 정주행 차량 이탈, 역주행 A 지속
5. 두 번째 역주행 B 추가 발생
6. 역주행 차량 2대 동시 지속
7. 역주행 A 종료, B는 지속
8. 마지막 역주행 B 종료
9. 정주행 차량만 남은 상태
10. 빈 snapshot 3회 후 누락 객체 비활성화

`consecutive_count`, `is_confirmed`, `uuid`, CCTV, 스냅샷, 영상 URL은 현재 수신 규격에서 제외합니다.
