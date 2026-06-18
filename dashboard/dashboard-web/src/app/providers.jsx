import { AuthProvider } from "../context/AuthContext";
import { LanguageProvider } from "../context/LanguageContext";

// 앱 전체에서 사용하는 전역 Provider를 한 곳에서 감싼다.
// Provider가 늘어나도 App.jsx를 수정하지 않고 이 파일에서 관리한다.
export default function AppProviders({ children }) {
  return (
    // 언어 설정은 화면 문구 번역에 사용한다.
    <LanguageProvider>
      {/* 인증 상태는 보호 라우트와 로그인/로그아웃 처리에 사용한다. */}
      <AuthProvider>{children}</AuthProvider>
    </LanguageProvider>
  );
}
