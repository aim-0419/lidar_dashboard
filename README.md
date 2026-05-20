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
npm run install:web
npm run install:server
npm run setup:demo
```

각 명령은 아래 원래 명령을 감싼 것입니다.

- `npm run install:web`: `cd dashboard/dashboard-web && npm install`
- `npm run install:server`: `cd dashboard/server && npm install`
- `npm run setup:demo`: `dashboard/demo-server/venv` 생성 후 Python 패키지 설치

가상환경(`dashboard/demo-server/venv`)은 각 로컬 PC에서 따로 생성합니다.

## 환경 설정

실제 접속 URL은 각 로컬 PC의 `.env`에 작성합니다.

- 루트 `.env`: 루트 실행 스크립트나 공통 기본값
- `dashboard/dashboard-web/.env`: 프론트엔드에서 사용하는 URL
- `dashboard/server/.env`: Node.js 백엔드에서 사용하는 URL

공개 저장소에는 실제 `.env`를 올리지 않고, 각 위치의 `.env.example` 파일만 올립니다.

기본 로컬 개발값은 `localhost`입니다.

```env
DASHBOARD_HOST=localhost
DASHBOARD_PORT=5000
DETECTOR_HOST=localhost
DETECTOR_PORT=8888
```

프론트엔드는 Vite 규칙에 따라 `VITE_` prefix를 사용합니다.

```env
VITE_API_HOST=localhost
VITE_API_PORT=5000
VITE_DETECTOR_HOST=localhost
VITE_DETECTOR_PORT=8888
```

모든 서버를 같은 PC에서 실행하면 `localhost` 그대로 사용하면 됩니다. 라이다 PC에서 백엔드/Flask를 실행하고 다른 PC에서 브라우저로 접속하는 경우에는 `localhost` 대신 라이다 PC의 내부망 IP를 사용합니다.

```env
VITE_API_HOST=192.168.0.24
VITE_DETECTOR_HOST=192.168.0.24
DASHBOARD_HOST=192.168.0.24
DETECTOR_HOST=192.168.0.24
```

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
