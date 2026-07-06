# Lidar Dashboard

라이다 기반 역주행 감지 관제 대시보드 프로젝트입니다.

## 프로젝트 구조

```txt
dashboard/
  dashboard-web/   # React/Vite 프론트엔드
  server/          # Node.js 백엔드 API 서버
  demo-server/     # Python 데모/AI 감지 서버
```

## 환경변수

환경변수는 프로젝트 루트의 `.env` 하나만 사용합니다.

```txt
.env
.env.example
```

서버 전용 `.env`, 프론트 전용 `.env`는 사용하지 않습니다.

`.env.example`은 변수 목록과 형식 참고용입니다. 실제 `.env` 파일은 팀 내부 공유값 또는 본인 로컬 설정에 맞게 작성합니다. `.env`는 Git에 올리지 않습니다.

필수 확인값:

```env
POSTGRES_DB=lidar_dashboard_db
POSTGRES_USER=lidar_dashboard_user
POSTGRES_PASSWORD=본인_로컬_DB_비밀번호
POSTGRES_PORT=5433
DATABASE_URL=postgresql://lidar_dashboard_user:본인_로컬_DB_비밀번호@localhost:5433/lidar_dashboard_db?schema=public
```

주의:

- `POSTGRES_PASSWORD`와 `DATABASE_URL` 안의 비밀번호는 반드시 같아야 합니다.
- 로컬 PC에서 Prisma CLI로 DB에 접속할 때는 `localhost:5433`을 사용합니다.
- Docker 컨테이너 내부에서 백엔드가 DB에 접속할 때는 `lidar-dashboard-db-postgres:5432`를 사용합니다.
- 프론트엔드는 `dashboard/dashboard-web/vite.config.js`의 `envDir: "../.."` 설정으로 루트 `.env`를 읽습니다.

## Docker 실행

팀 공통 개발 실행은 Docker Compose 기준입니다.

프로젝트 루트에서 실행합니다.

```bash
docker compose up --build
```

기본 실행 서비스:

- PostgreSQL DB
- 백엔드 서버
- 프론트엔드 서버

기본 실행에서 제외되는 서비스:

- `demo-server`

데모 서버까지 Docker로 함께 실행해야 할 때만 profile을 사용합니다.

```bash
docker compose --profile demo-docker up --build
```

## 자동 DB 적용

백엔드 컨테이너는 시작 시 아래 순서로 자동 실행됩니다.

```bash
npx prisma migrate deploy
npx prisma db seed
npm start
```

따라서 새로 pull 받은 개발자는 보통 아래 명령만 실행하면 됩니다.

```bash
docker compose up --build
```

DB volume을 완전히 초기화해야 할 때:

```bash
docker compose down -v
docker compose up --build
```

주의:

- `docker compose down -v`는 PostgreSQL 데이터까지 삭제합니다.
- 개발 DB 초기화가 필요할 때만 사용합니다.

## 접속 주소

프론트:

```txt
http://localhost:5173
```

백엔드 DB health:

```txt
http://localhost:5000/api/database/health
```

Swagger:

```txt
http://localhost:5000/api-docs
```

curl 확인:

```bash
curl http://localhost:5000/api/database/health
```

정상 응답 예시:

```json
{
  "ok": true,
  "database": "postgresql",
  "tables": {
    "users": 0,
    "sites": 1,
    "zones": 2,
    "devices": 4,
    "vehicleTracks": 0,
    "trafficEvents": 0,
    "eventLogs": 0
  }
}
```

## 라이다 수신 테스트

라이다 PC 없이도 `/api/wrongway` 수신, `VehicleTrack` 갱신, `TrafficEvent` 저장 흐름을 테스트할 수 있습니다.

Swagger에서 확인:

```txt
http://localhost:5000/api-docs
```

Swagger 주요 테스트 API:

```txt
GET  /api/wrongway/test-payloads
POST /api/wrongway/test/normal
POST /api/wrongway/test/normal-stream/start
POST /api/wrongway/test/normal-stream/stop
GET  /api/wrongway/test/normal-stream/status
POST /api/wrongway/test/wrong-way-level-1
```

로컬 스크립트 실행:

```bash
npm run test:wrongway-samples
```

기본 대상 서버는 루트 `.env`의 `WRONGWAY_TEST_BASE_URL`을 사용합니다.

```env
WRONGWAY_TEST_BASE_URL=http://192.168.0.60:5000
```

위 설정이면 스크립트는 `http://192.168.0.60:5000/api/wrongway`로 테스트 데이터를 전송합니다.

`WRONGWAY_TEST_BASE_URL`이 비어 있으면 `PUBLIC_HOST`와 `DASHBOARD_PORT`를 조합해 사용합니다.

테스트 요청 대상 결정 우선순위:

```txt
1. 명령어 --base-url
2. scripts/wrongway-test.config.json의 baseUrl
3. .env의 WRONGWAY_TEST_BASE_URL
4. .env의 PUBLIC_HOST + DASHBOARD_PORT
5. http://localhost:5000
```

예시:

```bash
npm run test:wrongway-samples -- --base-url http://192.168.0.20:5000
```

위처럼 명령어에서 `--base-url`을 넘기면 `.env`와 config 파일보다 우선 적용됩니다.

세부 테스트 값을 파일로 관리해야 하면 설정 파일을 생성합니다.

```bash
copy scripts\wrongway-test.config.example.json scripts\wrongway-test.config.json
```

`scripts/wrongway-test.config.json` 예시:

```json
{
  "baseUrl": "",
  "scenario": "all",
  "beforeNormalCount": 10,
  "afterNormalCount": 10,
  "intervalMs": 1000,
  "afterWrongwayDelayMs": 10000,
  "normalTrackId": "script-normal-track-001",
  "wrongwayTrackId": "script-wrongway-track-001",
  "normalZoneId": "Z261",
  "wrongwayZoneId": "Z327",
  "duplicateWrongway": true
}
```

기본 시나리오:

```txt
정주행 10회, 1초 간격
역주행 1차 1회
10초 대기
정주행 10회, 1초 간격
```

명령어 옵션으로 임시 덮어쓰기:

```bash
npm run test:wrongway-samples -- --base-url http://서버IP:5000 --before-normal-count 30 --after-normal-count 30
```

다른 노트북 또는 내부망 서버로 한 번만 전송:

```bash
npm run test:wrongway-samples -- http://서버IP:5000
```

정주행만 전송:

```bash
npm run test:wrongway-samples -- --scenario normal --normal-count 60
```

역주행 1차만 전송:

```bash
npm run test:wrongway-samples -- --scenario wrongway --wrongway-track-id laptop-wrongway-001
```

사용 가능한 옵션:

```txt
--base-url URL
--scenario all|normal|wrongway
--normal-count N
--before-normal-count N
--after-normal-count N
--interval-ms N
--after-wrongway-delay-ms N
--normal-track-id ID
--wrongway-track-id ID
--normal-zone-id ID
--wrongway-zone-id ID
--no-duplicate-wrongway
```

주의:

- `scripts/wrongway-test.config.json`은 로컬 테스트용 파일이라 Git에 올리지 않습니다.
- 공유용 기본 형식은 `scripts/wrongway-test.config.example.json`만 수정합니다.

스크립트 동작:

- 정주행 데이터 10회 전송
- 각 정주행 데이터는 1초 간격으로 전송
- 같은 `track_id` 기준으로 `VehicleTrack` upsert 확인
- 역주행 1차 데이터 1회 전송
- 기본값에서는 같은 역주행 1차 데이터 재전송으로 중복 방지 확인
- 역주행 이후 10초 대기 후 정주행 데이터 10회 재전송

DBeaver에서 확인할 테이블:

```sql
SELECT * FROM vehicle_tracks;
SELECT * FROM traffic_events;
SELECT * FROM event_logs;
```

## 컨테이너 관리

백그라운드 실행:

```bash
docker compose up --build -d
```

상태 확인:

```bash
docker compose ps
```

로그 확인:

```bash
docker compose logs -f
```

종료:

```bash
docker compose down
```

DB 데이터까지 삭제:

```bash
docker compose down -v
```

## 로컬 실행

Docker가 아니라 로컬에서 직접 실행할 수도 있습니다.

의존성 설치:

```bash
npm install
npm --prefix dashboard/server install
npm --prefix dashboard/dashboard-web install
```

DB 컨테이너만 실행:

```bash
docker compose up -d lidar-dashboard-db-postgres
```

Prisma 적용:

```bash
npm run db:deploy
npm run db:seed
npm run db:status
```

백엔드 실행:

```bash
npm --prefix dashboard/server start
```

프론트 실행:

```bash
npm --prefix dashboard/dashboard-web run dev
```

## 검증

전체 검증:

```bash
npm run ci
```

현재 `ci`는 프론트 빌드와 서버 문법 검사를 실행합니다.

```bash
npm run build:web
npm run check:server
```

## 자주 나는 오류

### DB 인증 실패

```txt
P1000: Authentication failed
```

확인할 것:

- `POSTGRES_PASSWORD`와 `DATABASE_URL` 안의 비밀번호가 같은지
- `DATABASE_URL`이 `localhost:5433/lidar_dashboard_db`를 보고 있는지
- DB 계정/비밀번호를 바꾼 뒤 기존 volume을 초기화했는지

개발 DB 초기화:

```bash
docker compose down -v
docker compose up --build
```

### 5000번 포트 사용 중

```txt
EADDRINUSE: address already in use 0.0.0.0:5000
```

의미:

- 백엔드 서버가 이미 실행 중이거나
- 다른 프로세스가 5000번 포트를 사용 중입니다.

확인:

```bash
netstat -ano | findstr :5000
```

종료:

```bash
taskkill //PID PID번호 //F
```

### npm ci 실패

```txt
package.json and package-lock.json are not in sync
```

의미:

- `package.json`에 의존성이 추가됐지만 `package-lock.json`이 갱신되지 않은 상태입니다.

백엔드 의존성 문제:

```bash
npm --prefix dashboard/server install
```

프론트 의존성 문제:

```bash
npm --prefix dashboard/dashboard-web install
```

### Prisma Client 누락

```txt
Cannot find module '.prisma/client/default'
```

의미:

- Docker 이미지 안에서 Prisma Client가 생성되지 않은 상태입니다.

현재 백엔드 Dockerfile에서는 빌드 중 아래 명령을 실행하도록 되어 있습니다.

```bash
npx prisma generate
```

## package.json 역할

루트 `package.json`:

- 전체 프로젝트 실행/검증 명령 관리
- 예: `npm run ci`, `npm run db:deploy`

`dashboard/server/package.json`:

- 백엔드 의존성 관리
- 예: Express, Prisma, PostgreSQL, Swagger

`dashboard/dashboard-web/package.json`:

- 프론트엔드 의존성 관리
- 예: React, Vite

Docker 빌드는 각 서비스 폴더의 `package.json`, `package-lock.json`을 기준으로 실행됩니다.
