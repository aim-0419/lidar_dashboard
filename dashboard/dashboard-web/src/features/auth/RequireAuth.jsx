import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

// 인증이 필요한 화면을 감싸는 보호 라우트 컴포넌트이다.
// 로그인하지 않은 사용자는 로그인 페이지로 이동시킨다.
export default function RequireAuth({ children }) {
  const { isLoggedIn } = useAuth();

  // replace 옵션은 뒤로 가기 시 보호 페이지로 다시 돌아가는 흐름을 줄인다.
  if (!isLoggedIn) return <Navigate to="/login" replace />;

  // 로그인 상태라면 감싸고 있는 실제 페이지를 그대로 보여준다.
  return children;
}
