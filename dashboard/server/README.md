# YOLO 역주행 감지 시스템 (Roundabout Wrong-Way Detector)

이 모듈은 YOLOv8을 사용하여 로터리에서 시계 방향(역주행)으로 주행하는 차량을 실시간으로 감지하고, 대시보드에 MJPEG 스트림 및 이벤트를 전송합니다.

## 1. 사전 요구 사항 (Requirements)

Python 3.8 이상이 설치되어 있어야 하며, 프로젝트 루트의 `dashboard/server/venv` 가상환경을 사용합니다.

### 주요 패키지 설치
이미 설치되어 있지 않다면 아래 명령어를 통해 필요한 라이브러리를 설치합니다.

```bash
# 가상환경 활성화 (Windows)
cd dashboard/server
python -m venv venv
.\venv\Scripts\activate

# 필수 패키지 설치
pip install ultralytics opencv-python flask flask-cors lapx pyserial
```

- `ultralytics`: YOLOv8 모델 엔진 및 트래킹
- `opencv-python`: 영상 처리 및 그리기
- `flask`, `flask-cors`: MJPEG 스트리밍 서버 구축
- `lapx`: BoT-SORT 트래커 구동을 위한 의존성

## 2. 실행 방법 (How to Run)

가상환경이 활성화된 상태에서 감지 스크립트를 실행합니다.

```bash
# 가상환경의 python으로 직접 실행
.\venv\Scripts\python.exe wrongway_detector.py
```

실행 시 다음과 같은 정보가 출력됩니다:
- `[detector] 역주행 감지 서버 시작 (port 8765)`
- `[detector] MJPEG 스트림: http://localhost:8765/video_feed`

## 3. 설정 (Configuration)

`dashboard/server/config.json` 파일을 통해 작동 방식을 변경할 수 있습니다.

```json
{
  "detectorPort": 8765,                         // 감지 서버 포트
  "videoSource": "path/to/video.mp4",           // 영상 파일 경로 또는 카메라 인덱스(0, 1)
  "rotaryCenter": { "x": 370, "y": 450 }         // 로터리 중심 좌표 (방향 판별 기준점)
}
```

## 4. 확인 방법

1. **대시보드 확인**: `http://localhost:5173` 접속 시 "실시간 카메라" 영역 상단에 **"● YOLO 감지 중"** 배지가 표시되며, 감지 결과(바운딩 박스)가 포함된 영상이 출력됩니다.
2. **직접 피드 확인**: 브라우저에서 `http://localhost:8765/video_feed`에 접속하여 개별 스트리밍을 확인할 수 있습니다.
