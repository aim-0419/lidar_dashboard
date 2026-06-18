# 프로젝트 구조 컨벤션

이 문서는 프로젝트의 주요 디렉터리 역할과 구조 변경 기준을 정리합니다.

## 현재 주요 디렉터리

```text
.
- dashboard
  - dashboard-web    # React/Vite 프론트엔드
  - server           # Express 백엔드 API 서버
  - demo-server      # 영상/AI 데모 감지 서버
- docs
  - ai               # AI 에이전트 작업 가이드
  - conventions      # 개발자 공통 컨벤션
- tools              # 보조 스크립트
- docker-compose.yml # 데모 서버 실행 구성
```

## 구조 변경 원칙

- 기존 동작을 깨뜨릴 수 있는 대규모 이동은 별도 승인 후 진행합니다.
- 새 기능은 가능한 도메인 단위로 묶습니다.
- 라이다 PC 데이터 규격이 확정되기 전까지 실제 연동 로직은 mock/adapter와 분리합니다.
- 공통 유틸, API 클라이언트, 상수는 기능 폴더 안에 중복 생성하지 않고 `shared` 영역으로 모읍니다.

## 프론트엔드 구조

현재 적용 기준:

```text
dashboard/dashboard-web/src
- App.jsx
- main.jsx
- app
  - providers.jsx
  - router.jsx
- layouts
  - MainLayout.jsx
- pages
- components
- context
  - AuthContext.jsx
  - LanguageContext.jsx
- features
  - auth
    - RequireAuth.jsx
  - dashboard
  - devices
  - events
  - settings
  - wrongway
- shared
  - api
  - components
    - Card.jsx
  - constants
  - hooks
  - utils
```

역할:

- `app`: 앱 전역 Provider와 라우터를 관리합니다.
- `pages`: 라우트에 직접 연결되는 화면입니다.
- `layouts`: 사이드바, 상단바 같은 공통 화면 뼈대입니다.
- `components`: 여러 화면에서 재사용하는 기존 UI입니다.
- `context`: 전역 상태 Provider를 관리합니다.
- `features`: 인증, 대시보드, 이벤트처럼 기능 도메인별 코드를 둡니다.
- `shared`: 도메인과 무관하게 재사용되는 공통 코드입니다.

## 백엔드 구조

현재 적용 기준:

```text
dashboard/server
- server.js
- scripts
  - check-syntax.js
- src
  - app.js
  - swagger.js
  - config
    - index.js
  - routes
    - index.js
  - domains
    - demo
    - mock-lidar
    - wrongway
  - realtime
    - websocket.js
  - simulator
    - lidarSimulator.js
  - utils
    - time.js
```

역할:

- `server.js`: HTTP 서버 생성, WebSocket 초기화, 시뮬레이터 실행, 서버 `listen`을 담당합니다.
- `scripts/check-syntax.js`: 백엔드 JS 파일 전체를 `node --check`로 검사합니다.
- `src/app.js`: Express 설정, Swagger 연결, `/api` 라우트 등록, React 정적 파일 서빙을 담당합니다.
- `src/config/index.js`: `.env`, `config.json` 기반 포트, host, base URL, dist 경로를 계산합니다.
- `src/routes/index.js`: 전체 API 진입점입니다. `/api/health`와 도메인별 라우트를 연결합니다.
- `src/domains/*`: 도메인별 route, controller, service를 묶습니다.
- `src/realtime/websocket.js`: WebSocket 연결과 실시간 전송을 담당합니다.
- `src/simulator/lidarSimulator.js`: 실제 장비가 없을 때 mock 라이다 수치를 갱신합니다.
- `src/utils/time.js`: 시간 포맷 등 공통 유틸 함수를 제공합니다.

향후 DB, 인증, 사용자 관리가 확정되면 `prisma`, `auth`, `users` 같은 도메인을 추가합니다.

## 데모/AI 서버 기준

`dashboard/demo-server`는 실제 라이다 PC가 아닌 영상 기반 데모 감지 서버입니다.

- 영상 기반 데모와 AI 감지 테스트 코드는 이 영역에 둡니다.
- 백엔드 API 서버와 직접 섞지 않습니다.
- 데모 서버 응답을 실제 라이다 PC 규격이라고 가정하지 않습니다.

## 라이다 연동 전제

현재 조선대 측 라이다 PC 데이터 규격은 확정되지 않았습니다.

- 실제 수신부는 adapter 계층으로 분리합니다.
- 프론트 개발은 mock API 또는 기존 demo API를 사용합니다.
- mock payload는 실제 규격이 아닌 개발용 임시 데이터임을 문서에 명시합니다.
- 실제 규격 수신 후 DB/API/adapter 설계를 재검토합니다.
