import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/useAuth";

// 인증된 사용자가 필요한 역할을 보유한 경우에만 하위 화면을 표시한다.
export default function RequireRole({ role, fallbackPath = "/settings", children }) {
  const { user, isInitializing } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return null;
  }

  if (user?.role !== role) {
    return <Navigate to={fallbackPath} replace state={{ from: location }} />;
  }

  return children;
}
