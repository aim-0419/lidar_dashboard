// 좌측 사이드바, 메인콘텐츠 영역
import { NavLink, Outlet } from "react-router-dom";
import "./mainLayout.css";
import { useLanguage } from "../context/LanguageContext";
import {
  BarChart3,
  LayoutDashboard,
  ListChecks,
  MonitorCog,
  Settings,
  ShieldAlert,
} from "lucide-react";



export default function MainLayout() {
  const { t } = useLanguage();

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
          </nav>
        </aside>

        <main className="ml-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
