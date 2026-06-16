# 프로젝트 구조 컨벤션

이 문서는 라이다 역주행 대시보드 프로젝트의 디렉터리 구조와 레이어 분리 기준을 정의합니다.

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
- 라이다 PC 데이터 규격이 확정되기 전까지 실제 연동 로직은 mock 로직과 분리합니다.
- 공통 유틸, API 클라이언트, 상수는 기능 폴더 안에 중복 생성하지 않고 shared 영역으로 모읍니다.

## 프론트엔드 권장 구조

현재 구조를 존중하되, 신규 기능부터 아래 방향으로 정리합니다.

```text
dashboard/dashboard-web/src
- App.jsx
- main.jsx
- layouts
- pages
- components
- context
- features
  - auth
  - dashboard
  - events
  - devices
  - settings
- shared
  - api
  - components
  - constants
  - hooks
  - utils
```

기준:

- `pages`: 라우트에 직접 연결되는 화면입니다.
- `layouts`: 사이드바, 상단바 등 화면 뼈대입니다.
- `components`: 여러 화면에서 재사용 가능한 UI입니다.
- `features`: 특정 업무 도메인에 묶인 컴포넌트, 훅, API 호출입니다.
- `shared`: 도메인과 무관하게 재사용되는 코드입니다.

## 백엔드 권장 구조

현재 `server.js`에 모여 있는 로직은 신규 개발부터 점진적으로 분리합니다.

```text
dashboard/server
- server.js
- src
  - app.js
  - routes
  - middlewares
  - domains
    - auth
    - users
    - dashboard
    - events
    - devices
    - mock-lidar
  - prisma
  - swagger
  - utils
- prisma
  - schema.prisma
  - seed.js
```

기준:

- `routes`: URL과 middleware 연결만 담당합니다.
- `controller`: 요청/응답 처리만 담당합니다.
- `service`: 비즈니스 규칙을 담당합니다.
- `repository`: Prisma 등 DB 접근을 담당합니다.
- `middlewares`: 인증, 에러 처리, IP 제한 등 공통 요청 처리를 담당합니다.
- `swagger`: API 문서 정의를 담당합니다.

## 데모/AI 서버 기준

`dashboard/demo-server`는 실제 라이다 PC가 아닌 데모 감지 서버입니다.

- 영상 기반 데모나 AI 감지 테스트 코드는 이 영역에 둡니다.
- 백엔드 API 서버와 직접 섞지 않습니다.
- 데모 서버 응답이 실제 라이다 PC 규격이라고 단정하지 않습니다.

## 라이다 연동 전제

현재 조대측 라이다 PC 데이터 규격은 확정되지 않았습니다.

따라서 다음 원칙을 지킵니다.

- 실제 수신부는 adapter 계층으로 분리합니다.
- 프론트 개발은 mock API 또는 기존 demo API를 사용합니다.
- mock payload는 실제 규격이 아니라 개발용 임시 데이터임을 문서에 명시합니다.
- 실제 규격 수신 후 DB/API/adapter 설계를 재검토합니다.
