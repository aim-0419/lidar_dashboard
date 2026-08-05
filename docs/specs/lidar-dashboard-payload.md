# 라이다 PC -> 대시보드 payload 규격

> 최종 업데이트: 2026-08-05

이 문서는 라이다 PC가 대시보드 백엔드로 전송하는 HTTP JSON의 최신 외부 연동 기준입니다.

## 기본 연동 정보

- 방향: 라이다 PC -> 대시보드 백엔드
- 방식: HTTP POST
- Content-Type: application/json
- endpoint: /api/wrongway
- payload 단위: 한 시점의 상위 스냅샷과 objects 다중 객체 배열
- 객체가 1개여도 objects 배열 안에 넣어 전송

## 최신 payload 예시

    {
      "timestamp": "2026-01-13T14:35:59.192087+09:00",
      "source": "lidar-pc-01",
      "status": "wrong-way-level-2",
      "total_objects": 6,
      "moving_vehicle_count": 4,
      "normal_moving_vehicle_count": 3,
      "wrong_way_count": 1,
      "processing_time_ms": 8.518,
      "objects": [
        {
          "type": "normal-driving",
          "warning_level": 0,
          "confidence": 1.0,
          "zone_id": "Z469",
          "track_id": "8b630000-0000-0000-0000-000000000000",
          "message": "정주행",
          "speed_ms": 7.0586720443534725,
          "speed_kmh": 25.4112193596725,
          "object_class": 1,
          "description": "Normal"
        },
        {
          "type": "wrong-way-level-2",
          "warning_level": 2,
          "confidence": 0.95,
          "zone_id": "Z455",
          "track_id": "f7263000-0000-0000-0000-000000000000",
          "message": "역주행 2차 감지",
          "speed_ms": 3.7008093237040853,
          "speed_kmh": 13.322913565334707,
          "object_class": 1,
          "description": "Wrong-way driving detected"
        },
        {
          "type": "pedestrian-entered",
          "warning_level": 0,
          "confidence": 0.92,
          "zone_id": "Z261",
          "track_id": "ped-20300000-0000-0000-0000-000000000000",
          "message": "회전교차로 내 보행자 진입",
          "speed_ms": 1.124,
          "speed_kmh": 4.0464,
          "object_class": 7,
          "description": "Pedestrian entered roundabout area"
        }
      ]
    }

## 상위 필드

| 필드 | 논리 이름 | 설명 |
| --- | --- | --- |
| timestamp | 스냅샷 생성 시간 | KST ISO 8601 문자열 |
| source | 전송 장비 | 라이다 PC 식별자 |
| status | 전체 상태 | 해당 스냅샷의 대표 상태 |
| total_objects | 전체 객체 수 | 감지된 모든 객체 수 |
| moving_vehicle_count | 이동 차량 수 | 이동 중인 차량 수 |
| normal_moving_vehicle_count | 정상 이동 차량 수 | 정주행 중인 차량 수 |
| wrong_way_count | 역주행 객체 수 | 스냅샷 내 역주행 객체 수 |
| processing_time_ms | 처리 시간 | 라이다 PC의 스냅샷 처리 시간(ms) |
| objects | 감지 객체 목록 | 차량·보행자를 포함한 객체 배열 |

## 객체 필드

| 필드 | 논리 이름 | 설명 |
| --- | --- | --- |
| type | 객체 상태 유형 | 정주행, 역주행, 상황 종료, 보행자 진입·이탈 구분 |
| warning_level | 경고 단계 | 정상 0, 1차 1, 2차 2 |
| confidence | 감지 신뢰도 | 0~1 범위의 표시·저장용 값 |
| zone_id | 외부 감지 구역 ID | lanelet ID 기반 구역 코드 |
| track_id | 객체 추적 ID | 같은 감지 구간의 객체 상태 갱신 기준 |
| message | 요약 메시지 | 화면과 로그에 표시할 요약 |
| speed_ms | 속도(m/s) | 객체 속도 |
| speed_kmh | 속도(km/h) | 화면 표시용 속도 |
| object_class | 객체 분류 코드 | 차량·버스·보행자 등 외부 코드 |
| description | 상세 설명 | 라이다 PC가 판단한 상태 설명 |

## type 기준

| type | warning_level | 의미 |
| --- | ---: | --- |
| normal-driving | 0 | 정상 주행 |
| wrong-way-level-1 | 1 | 회전교차로 내 역주행 1차 감지 |
| wrong-way-level-2 | 2 | 역주행 객체의 비정상 이탈·2차 경고 |
| situation-ended | 0 | 역주행 상황 종료·정상 복귀 |
| pedestrian-entered | 0 | 회전교차로 내 보행자 진입 |
| pedestrian-exited | 0 | 회전교차로 내 보행자 이탈 |

## 전송·처리 기준

- 같은 시점의 정주행·역주행·보행자 객체를 objects 하나에 함께 담습니다.
- 객체별 track_id를 기준으로 최신 상태를 구분합니다.
- 감지 범위를 벗어나면 객체 ID가 소멸하므로, 재진입 객체가 동일 차량임을 track_id만으로 보장할 수 없습니다.
- 전송 주기와 누락 판단 시간은 현장 연동 전 최종 확인합니다.
- consecutive_count와 is_confirmed는 라이다 PC 내부 판단용 값으로 최신 대시보드 수신 필드에서 제외합니다.
- uuid는 최신 규격에서 제외된 것으로 보고 사용하지 않습니다.

## 저장·실시간 처리 방향

- Redis: 최신 스냅샷, 현재 objects, 최근 이벤트, 수신 상태 캐시
- PostgreSQL: 역주행, 보행자 진입·이탈, 상황 종료 이력과 장기 통계
- 매초 들어오는 정주행 스냅샷 전체를 PostgreSQL에 무조건 영구 저장하지 않습니다.
- 이벤트성 payload는 원본 확인을 위해 raw_payload에 보관할 수 있습니다.

## 현재 코드 구현 상태

- 실제 수신 API: POST /api/wrongway
- 수신 도메인: dashboard/server/src/domains/wrongway
- 변환 adapter: dashboard/server/src/domains/wrongway/adapters/lidarHttp.adapter.js
- 응답 DTO: dashboard/server/src/domains/wrongway/wrongway.dto.js
- 처리 service: dashboard/server/src/domains/wrongway/wrongway.service.js

> 중요: 현재 adapter·service·DTO는 단일 객체 payload 중심으로 구현되어 있습니다. 위 다중 객체 규격을 바로 처리한다고 가정하지 말고, objects 반복 변환·객체별 저장 결과·일부 실패 응답·Redis·WebSocket 연결을 후속 개발해야 합니다.

## 제공되지 않는 항목

- CCTV
- 스냅샷
- 영상 URL
- 번호판 인식 결과

위 항목은 라이다 PC 이벤트 JSON이 아니라 추후 별도 CCTV·카메라 연동 영역으로 봅니다.
