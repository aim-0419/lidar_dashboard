import AppProviders from "./app/providers";
import AppRouter from "./app/router";

// 앱의 최상위 컴포넌트이다.
// 전역 Provider 설정과 라우터 설정을 각각 별도 파일로 분리해 App.jsx를 단순하게 유지한다.
export default function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}

