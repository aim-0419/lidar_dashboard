import { NavLink, Outlet, useNavigate } from "react-router-dom";
import "./mainLayout.css";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";

export default function MainLayout() {
  const { t } = useLanguage();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="ml-root">
      <div className="ml-shell">
        <aside className="ml-sidebar">
          <div className="ml-brand">
            <div className="ml-title">{t("title.trafficside")}</div>
            <div className="ml-sub">{t("title.trafficsub")}</div>
          </div>

          <nav className="ml-nav">
            <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "") }>
              {t("nav.overview")}
            </NavLink>
            <NavLink to="/events" end className={({ isActive }) => (isActive ? "active" : "") }>
              {t("nav.events")}
            </NavLink>
            <NavLink to="/devices" end className={({ isActive }) => (isActive ? "active" : "") }>
              {t("nav.devices")}
            </NavLink>
            <NavLink to="/settings" end className={({ isActive }) => (isActive ? "active" : "") }>
              {t("nav.settings")}
            </NavLink>
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
