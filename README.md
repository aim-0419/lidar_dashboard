# Lidar Dashboard

라이다 기반 역주행 감지 대시보드 프로젝트입니다.

## 프로젝트 구조

```txt
dashboard/
  dashboard-web/   # React/Vite 프론트엔드
  server/          # Node.js 백엔드
  demo-server/     # Python Flask 데모 감지 서버
```

## 처음 설치

프로젝트 루트에서 실행합니다.

```bash
npm install
npm run setup:demo
```

`npm install`은 npm workspaces 설정을 통해 프론트엔드와 백엔드 Node.js 패키지를 함께 설치합니다. 따라서 `dashboard/dashboard-web`, `dashboard/server`에서 각각 `npm install`을 따로 실행하지 않아도 됩니다.

- `npm run setup:demo`: `dashboard/demo-server/venv` 생성 후 Python 패키지 설치

가상환경(`dashboard/demo-server/venv`)은 각 로컬 PC에서 따로 생성합니다.

`npm run dev:demo`는 별도 activate 없이 `dashboard/demo-server/venv/Scripts/python.exe`를 직접 실행합니다. 즉, 가상환경을 활성화하지 않아도 venv에 설치된 Flask/YOLO 관련 패키지를 사용합니다.

## 환경 설정

실제 접속 host, 포트, 장비별 값은 각 로컬 PC의 `.env`에 작성합니다.

- 루트 `.env`: Docker Compose와 루트 실행 스크립트에서 사용하는 기본값
- `dashboard/dashboard-web/.env`: 프론트엔드를 단독 실행할 때 사용하는 값
- `dashboard/server/.env`: 백엔드를 단독 실행할 때 사용하는 값

공개 저장소에는 실제 `.env`를 올리지 않고, 각 위치의 `.env.example` 파일만 올립니다.

루트 `.env`에는 사람이 읽기 쉬운 원자값만 둡니다. URL은 직접 적지 않고 `docker-compose.yml`에서 host와 port를 조합합니다.

```env
FRONTEND_PORT=
DASHBOARD_PORT=
DETECTOR_PORT=
PUBLIC_HOST=
COMPOSE_BACKEND_HOST=
COMPOSE_DETECTOR_HOST=
SERIAL_PORT=
BAUD_RATE=
VIDEO_SOURCE=
```

Docker Compose 내부 통신에서는 `COMPOSE_BACKEND_HOST`, `COMPOSE_DETECTOR_HOST` 같은 서비스명 값을 사용합니다. 브라우저에서 접속하는 host는 `PUBLIC_HOST`로 관리합니다.

라이다 PC나 내부망 IP를 사용하는 경우에도 Dockerfile을 수정하지 말고 `.env`의 원자값만 변경합니다.

## Docker로 개발 서버 실행

팀 공통 개발 환경은 Docker Desktop과 Docker Compose를 기준으로 실행할 수 있습니다.

프로젝트 루트에서 실행합니다.

```bash
docker compose up --build
```

백그라운드로 실행하려면 `-d` 옵션을 붙입니다.

```bash
docker compose up --build -d
```

실행 후 접속 주소는 루트 `.env`의 `PUBLIC_HOST`, `FRONTEND_PORT`, `DASHBOARD_PORT`, `DETECTOR_PORT` 값을 기준으로 확인합니다.

컨테이너 상태를 확인합니다.

```bash
docker compose ps
```

전체 로그를 확인합니다.

```bash
docker compose logs -f
```

종료 방법은 실행 방식에 따라 다릅니다.

- `docker compose up --build`처럼 터미널에 붙여 실행한 경우: `Ctrl+C`로 중지할 수 있습니다.
- `docker compose up --build -d`처럼 백그라운드로 실행한 경우: `docker compose down`으로 종료합니다.
- 네트워크와 컨테이너까지 정리하려면 실행 방식과 관계없이 `docker compose down`을 사용합니다.

```bash
docker compose down
```

Docker Compose에서는 백엔드, 프론트엔드, 데모 서버가 각각 별도 컨테이너로 실행됩니다. 백엔드는 데모 서버를 직접 실행하지 않고, 이미 떠 있는 데모 서버에 HTTP 요청만 전달합니다.

포트나 내부망 IP를 바꿔야 하면 Dockerfile을 수정하지 말고 루트 `.env`만 수정합니다. `docker-compose.yml`은 `.env` 값을 읽어 포트 매핑과 각 컨테이너 환경변수에 반영합니다.

## 개발 서버 실행

프로젝트 루트에서 실행합니다.

```bash
npm run dev:web
npm run dev:server
npm run dev:demo
```

- `npm run dev:web`: React/Vite 프론트엔드 개발 서버 실행
- `npm run dev:server`: Node.js 백엔드 실행
- `npm run dev:demo`: Python Flask 데모 감지 서버 실행

각 폴더에서 직접 실행할 수도 있습니다.

```bash
cd dashboard/dashboard-web
npm run dev
```

```bash
cd dashboard/server
npm start
```

```bash
cd dashboard/demo-server
source venv/Scripts/activate
python wrongway_detector.py
```

## 빌드

프론트엔드만 빌드 명령이 있습니다.

```bash
cd dashboard/dashboard-web
npm run build
```

또는 프로젝트 루트에서 아래처럼 실행할 수 있습니다.

```bash
npm --prefix dashboard/dashboard-web run build
```

Node.js 백엔드는 별도 빌드 없이 `npm start` 또는 `npm run dev:server`로 실행합니다.

## 기타 명령

- `npm run lint`: 프론트엔드 코드 검사 명령입니다.
- `npm run preview`: 프론트엔드 빌드 결과를 미리 실행해 보는 명령입니다.

일반 개발 중에는 보통 `npm run dev` 또는 루트의 `npm run dev:*` 명령만 사용하면 됩니다.
