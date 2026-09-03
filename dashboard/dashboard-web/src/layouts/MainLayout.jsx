import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import "./mainLayout.css";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { fetchSignupRequests } from "../shared/api/http";
import {
  BarChart3,
  LayoutDashboard,
  ListChecks,
  MonitorCog,
  Settings,
  ShieldAlert,
  UserPlus,
} from "lucide-react";

// 보호된 대시보드 화면에서 공통으로 사용하는 사이드바 레이아웃입니다.
export default function MainLayout() {
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pendingSignupCount, setPendingSignupCount] = useState(0);
  const isSuperAdmin = user?.role === "super_admin";

  useEffect(() => {
    if (!isSuperAdmin) {
      return;
    }

    let isMounted = true;

    async function loadPendingSignupCount() {
      try {
        const response = await fetchSignupRequests("PENDING");
        if (isMounted) {
          setPendingSignupCount(response.count || 0);
        }
      } catch {
        if (isMounted) {
          setPendingSignupCount(0);
        }
      }
    }

    void loadPendingSignupCount();
    window.addEventListener("signup-request-count-changed", loadPendingSignupCount);

    return () => {
      isMounted = false;
      window.removeEventListener("signup-request-count-changed", loadPendingSignupCount);
    };
  }, [isSuperAdmin]);

  // 현재 세션을 종료하고 로그인 페이지로 이동합니다.
  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="ml-root">
      <div className="ml-shell">
        <aside className="ml-sidebar">
          <div className="ml-brand">
            <div className="ml-brand-icon">
              <ShieldAlert size={22} />
            </div>
            <div>
              <div className="ml-title">{t("title.trafficside")}</div>
              <div className="ml-sub">{t("title.trafficsub")}</div>
            </div>
          </div>

          <nav className="ml-nav">
            <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
              <LayoutDashboard size={17} />
              <span>{t("nav.overview")}</span>
            </NavLink>
            <NavLink to="/statistics" end className={({ isActive }) => (isActive ? "active" : "")}>
              <BarChart3 size={17} />
              <span>통계</span>
            </NavLink>
            <NavLink to="/events" end className={({ isActive }) => (isActive ? "active" : "")}>
              <ListChecks size={17} />
              <span>{t("nav.events")}</span>
            </NavLink>
            <NavLink to="/devices" end className={({ isActive }) => (isActive ? "active" : "")}>
              <MonitorCog size={17} />
              <span>{t("nav.devices")}</span>
            </NavLink>
            <NavLink to="/settings" end className={({ isActive }) => (isActive ? "active" : "")}>
              <Settings size={17} />
              <span>{t("nav.settings")}</span>
            </NavLink>
            {isSuperAdmin ? (
              <NavLink to="/signup-requests" end className={({ isActive }) => (isActive ? "active" : "")}>
                <UserPlus size={17} />
                <span>가입 신청 관리</span>
                {pendingSignupCount > 0 ? <strong className="ml-nav-badge">{pendingSignupCount}</strong> : null}
              </NavLink>
            ) : null}
          </nav>

          <div className="ml-auth-card">
            <div className="ml-auth-label">로그인 사용자</div>
            <div className="ml-auth-name">{user?.name || user?.userId || "관리자"}</div>
            <div className="ml-auth-role">{user?.role || "super_admin"}</div>
            <button type="button" className="ml-logout-btn" onClick={handleLogout}>
              로그아웃
            </button>
          </div>
        </aside>

        <main className="ml-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
