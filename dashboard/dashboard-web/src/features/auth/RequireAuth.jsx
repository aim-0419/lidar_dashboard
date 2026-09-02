import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/useAuth";

const loadingWrapStyle = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  background: "#0b0f14",
  color: "#ffffff",
  fontSize: "14px",
};

// 인증이 필요한 화면을 보호하는 라우트입니다.
export default function RequireAuth({ children }) {
  const { isLoggedIn, isInitializing } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return <div style={loadingWrapStyle}>인증 상태를 확인하는 중입니다.</div>;
  }

  if (!isLoggedIn) {
    // 로그인 후 원래 가려던 화면으로 다시 이동할 수 있도록 경로를 보존합니다.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // 인증이 확인되면 요청한 실제 페이지를 그대로 보여줍니다.
  return children;
}
