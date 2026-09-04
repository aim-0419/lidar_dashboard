import { BrowserRouter, Routes, Route } from "react-router-dom";
import RequireAuth from "../features/auth/RequireAuth";
import RequireRole from "../features/auth/RequireRole";

import LoginPage from "../pages/Login/LoginPage";
import SignupRequestPage from "../pages/SignupRequest/SignupRequestPage";
import SignupRequestsPage from "../pages/SignupRequests/SignupRequestsPage";
import DashboardPage from "../pages/Dashboard/DashboardPage";
import StatisticsPage from "../pages/Statistics/StatisticsPage";
import WrongwayLogPage from "../pages/Dashboard/WrongwayLogPage";
import EventLogPage from "../pages/EventLog/EventLogPage";
import DevicesPage from "../pages/Devices/DevicesPage";
import SettingsPage from "../pages/Settings/SettingsPage";

import MainLayout from "../layouts/MainLayout";

// 앱에서 사용하는 URL 경로와 화면 컴포넌트의 연결을 정의한다.
// 라우팅을 App.jsx에서 분리해 페이지 추가/수정 위치를 명확하게 한다.
export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 로그인 화면은 인증 없이 접근할 수 있다. */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup-request" element={<SignupRequestPage />} />

        {/* 아래 라우트들은 로그인한 사용자만 접근할 수 있다. */}
        <Route
          element={
            <RequireAuth>
              <MainLayout />
            </RequireAuth>
          }
        >
          {/* MainLayout 안에서 Outlet으로 표시되는 실제 페이지들이다. */}
          <Route path="/" element={<DashboardPage />} />
          <Route path="/statistics" element={<StatisticsPage />} />
          <Route path="/dashboard/wrongway" element={<WrongwayLogPage />} />
          <Route path="/events" element={<EventLogPage />} />
          <Route path="/devices" element={<DevicesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route
            path="/signup-requests"
            element={
              <RequireRole role="super_admin">
                <SignupRequestsPage />
              </RequireRole>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
