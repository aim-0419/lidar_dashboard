# 프론트엔드 컨벤션

이 문서는 `dashboard/dashboard-web` 개발 기준을 정의합니다.

## 기본 원칙

- 기존 React/Vite 구조와 스타일을 우선 존중합니다.
- 페이지 단위 변경과 공통 컴포넌트 변경을 구분합니다.
- 요청받지 않은 화면, 라우트, 디자인 변경은 하지 않습니다.
- 라이다 실제 데이터가 없을 때는 mock 데이터임을 코드와 문서에서 명확히 구분합니다.
- 화면 문구, 버튼, 카드, 테이블 텍스트가 모바일과 데스크톱에서 겹치지 않게 확인합니다.

## 파일과 폴더

현재 적용 구조:

```text
src
- app
- pages
- layouts
- components
- context
- features
- shared
```

사용 기준:

- `app`: 앱 전역 Provider와 라우터를 관리합니다.
- `pages`: 라우트에 연결되는 화면 컴포넌트입니다.
- `layouts`: 페이지 공통 레이아웃입니다.
- `components`: 여러 곳에서 재사용하는 기존 UI입니다.
- `context`: 전역 상태 제공자입니다.
- `features`: 특정 기능에 묶인 코드입니다.
- `shared`: API 클라이언트, 공통 상수, 훅, 유틸, 공통 UI입니다.

## 네이밍

- React 컴포넌트 파일은 `PascalCase.jsx`를 사용합니다.
- 훅은 `useSomething.js` 또는 `useSomething.jsx` 형태를 사용합니다.
- 일반 유틸 파일은 `camelCase.js`를 사용합니다.
- CSS 파일은 기존 페이지/컴포넌트 이름과 맞춥니다.
- API 응답 필드는 프론트에서 `camelCase`로 사용합니다.

예:

```text
DashboardPage.jsx
EventLogPage.jsx
useAuth.js
formatDate.js
dashboard.css
```

## 컴포넌트 작성 기준

- 컴포넌트 하나가 API 호출, 데이터 가공, UI 표시를 모두 과하게 담당하지 않게 분리합니다.
- 페이지 컴포넌트는 화면 조립과 상태 연결을 담당합니다.
- 재사용 가능한 UI는 `components` 또는 `shared/components`로 분리합니다.
- 버튼, 상태 배지, 모달, 카드 같은 반복 UI는 중복 구현하지 않습니다.
- 아이콘이 필요한 버튼은 가능한 `lucide-react`를 사용합니다.

## API 호출 기준

- API URL을 컴포넌트 안에 여러 번 하드코딩하지 않습니다.
- 공통 API 호출 함수 또는 feature 단위 API 파일로 분리합니다.
- 실제 API와 mock API는 파일명 또는 함수명에서 구분합니다.
- API 실패 시 사용자가 이해할 수 있는 에러 상태를 표시합니다.

예:

```text
features/events/eventsApi.js
features/auth/authApi.js
shared/api/httpClient.js
```

## 상태 처리 기준

모든 주요 화면은 아래 상태를 고려합니다.

- 로딩 상태
- 에러 상태
- 데이터 없음 상태
- 권한 없음 상태
- 정상 데이터 상태

데이터가 없을 때 빈 화면으로 두지 말고, 짧은 안내 문구를 표시합니다.

## 인증/권한

- 로그인 여부가 필요한 페이지는 `features/auth/RequireAuth.jsx` 같은 보호 라우트를 사용합니다.
- 권한별 화면과 API 접근 범위는 [authorization.md](authorization.md)를 기준으로 합니다.
- `MANAGER`에게는 관제 조회와 본인 정보 수정 화면만 제공합니다.
- 사용자 관리와 제어·테스트 기능은 `SUPER_ADMIN`에게만 노출합니다.

## 스타일 기준

- 현재 대시보드는 관제 운영 도구이므로 정보가 잘 보이는 밝은 톤을 우선합니다.
- 장식보다 상태, 이벤트 위치, 로그 정보의 가독성을 우선합니다.
- 카드 안에 카드를 중첩하지 않습니다.
- 페이지 전체를 과한 랜딩 페이지처럼 만들지 않습니다.
- 색상은 상태 의미가 분명해야 합니다.
  - 위험: red 계열
  - 경고: amber/orange 계열
  - 정상: green 계열
  - 정보: blue 계열

## 라우팅 기준

현재 라우트는 `src/app/router.jsx`에서 관리합니다.

- 새 페이지를 추가할 때는 라우트 경로와 메뉴 노출 여부를 함께 확인합니다.
- 기존 URL을 바꾸는 경우 프론트와 백엔드 문서, 사용자 안내에 영향이 있는지 확인합니다.
- 임시 테스트 라우트는 남기지 않습니다.

## 국제화

현재 `src/il8n` 구조가 존재합니다.

- 새 화면 문구를 추가할 때 기존 다국어 구조를 유지합니다.
- 한글만 임시로 넣는 경우 TODO를 남기기보다 작업 범위를 명확히 보고합니다.
- 파일명 `il8n`이 의도된 이름인지 오타인지 확실하지 않으므로 이름 변경은 별도 승인 후 진행합니다.

## 검증

프론트 변경 후 가능한 검증:

```text
npm --prefix dashboard/dashboard-web run build
npm run ci
```

`npm --prefix dashboard/dashboard-web run lint`는 별도 품질 검사용으로 사용할 수 있습니다. 현재 CI 필수 기준은 프론트 빌드와 백엔드 문법 검사입니다.

검증하지 못한 경우 결과 보고에 `미검증`이라고 적고 이유를 설명합니다.
