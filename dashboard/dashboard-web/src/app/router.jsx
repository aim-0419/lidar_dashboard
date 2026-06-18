import { BrowserRouter, Routes, Route } from "react-router-dom";
import RequireAuth from "../features/auth/RequireAuth";

import LoginPage from "../pages/Login/LoginPage";
import DashboardPage from "../pages/Dashboard/DashboardPage";
import WrongwayLogPage from "../pages/Dashboard/WrongwayLogPage";
import EventLogPage from "../pages/EventLog/EventLogPage";
import DevicesPage from "../pages/Devices/DevicesPage";
import SettingsPage from "../pages/Settings/SettingsPage";

import MainLayout from "../layouts/MainLayout";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          element={
            <RequireAuth>
              <MainLayout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dashboard/wrongway" element={<WrongwayLogPage />} />
          <Route path="/events" element={<EventLogPage />} />
          <Route path="/devices" element={<DevicesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
