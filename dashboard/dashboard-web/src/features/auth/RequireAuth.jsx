import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const loadingWrapStyle = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  background: "#0b0f14",
  color: "#ffffff",
  fontSize: "14px",
};

export default function RequireAuth({ children }) {
  const { isLoggedIn, isInitializing } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return <div style={loadingWrapStyle}>인증 상태를 확인하는 중입니다.</div>;
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
