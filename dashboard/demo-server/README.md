# YOLO 역주행 감지 시스템 (Roundabout Wrong-Way Detector)

이 모듈은 YOLOv8을 사용하여 로터리에서 시계 방향(역주행)으로 주행하는 차량을 실시간으로 감지하고, 대시보드에 MJPEG 스트림 및 이벤트를 전송합니다.

현재 프로젝트에서는 실제 운영 백엔드와 분리된 **데모 감지 서버**로 사용합니다.

## 1. 위치

```txt
dashboard/
  dashboard-web/   # 프론트엔드
  server/          # Node.js 백엔드
  demo-server/     # Python Flask 데모 감지 서버
```

감지 서버 관련 파일은 `dashboard/demo-server`에 있습니다.

- `wrongway_detector.py`: Flask 기반 YOLO 감지 서버
- `yolov8n.pt`: YOLO 모델 파일
- `demoEvents.json`: 데모 이벤트 데이터
- `requirements.txt`: Python 패키지 목록

## 2. 사전 요구 사항 (Requirements)

Python 3.8 이상이 설치되어 있어야 하며, `dashboard/demo-server/venv` 가상환경을 사용합니다.

필요한 라이브러리는 `requirements.txt`로 설치합니다.

주요 패키지:

- `ultralytics`: YOLOv8 모델 엔진 및 트래킹
- `opencv-python`: 영상 처리 및 그리기
- `flask`, `flask-cors`: MJPEG 스트리밍 서버 구축
- `lapx`: BoT-SORT 트래커 구동을 위한 의존성
- `pyserial`: 시리얼 포트 통신

## 3. 설치 방법

### Bash shell / Git Bash

```bash
cd dashboard/demo-server
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
```

### PowerShell

```powershell
cd dashboard/demo-server
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

PowerShell에서 스크립트 실행 정책 오류가 발생하면 현재 터미널에만 아래 명령을 적용한 뒤 다시 활성화합니다.

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\venv\Scripts\Activate.ps1
```

## 4. 실행 방법 (How to Run)

가상환경이 활성화된 상태에서 감지 스크립트를 실행합니다.

### Bash shell / Git Bash

```bash
cd dashboard/demo-server
source venv/Scripts/activate
python wrongway_detector.py
```

또는 프로젝트 루트에서 실행합니다.

```bash
npm run dev:demo
```

### PowerShell

```powershell
cd dashboard/demo-server
.\venv\Scripts\Activate.ps1
python wrongway_detector.py
```

또는 프로젝트 루트에서 실행합니다.

```powershell
npm run dev:demo
```

실행 시 다음과 같은 정보가 출력됩니다.

- `[detector] 역주행 감지 서버 시작 (port 8888)`
- `[detector] MJPEG 스트림: http://localhost:8888/video_feed`

## 5. 설정 (Configuration)

감지 서버는 우선 `dashboard/demo-server/config.json`을 확인하고, 파일이 없으면 `dashboard/server/config.json`을 사용합니다.

현재 프로젝트에서는 `dashboard/server/config.json`을 사용합니다.

공개 저장소에는 실제 `config.json` 값을 올리지 말고, 아래처럼 예시 값만 문서화합니다.

```json
{
  "pythonCmd": "python",
  "serverPort": 5000,
  "dashboardIP": "YOUR_DASHBOARD_HOST",
  "serialPort": "YOUR_SERIAL_PORT",
  "baudRate": 9600,
  "detectorPort": 8888,
  "videoSource": "path/to/video.mp4",
  "rotaryCenter": {
    "x": 0,
    "y": 0
  }
}
```

주요 설정:

- `detectorPort`: 감지 서버 포트, 현재 최종 사용 포트는 `8888`
- `serverPort`: Node.js 백엔드 포트
- `videoSource`: 영상 파일 경로 또는 카메라 인덱스
- `rotaryCenter`: 로터리 중심 좌표, 방향 판별 기준점
- `pythonCmd`: Node.js 백엔드가 감지 서버를 자동 실행할 때 사용할 Python 명령어

Node.js 백엔드에서 데모 서버를 자동 실행하려면 `pythonCmd`를 데모 서버 가상환경 Python으로 지정하는 것을 권장합니다.

```json
{
  "pythonCmd": "path/to/python.exe",
  "detectorPort": 8888
}
```

## 6. 확인 방법

1. 대시보드 확인: `http://localhost:5173` 접속 시 "실시간 카메라" 영역에서 감지 결과 영상이 출력됩니다.
2. 직접 피드 확인: 브라우저에서 `http://localhost:8888/video_feed`에 접속하여 개별 스트리밍을 확인할 수 있습니다.
3. 라이다 시각화 확인: 브라우저에서 `http://localhost:8888/lidar_feed`에 접속하여 데모 라이다 스트리밍을 확인할 수 있습니다.
4. 헬스체크 확인: 브라우저에서 `http://localhost:8888/health`에 접속하여 감지 서버 상태를 확인할 수 있습니다.
