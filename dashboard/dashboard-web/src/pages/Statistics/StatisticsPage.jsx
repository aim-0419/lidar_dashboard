import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, CalendarDays, Car, Siren, TrendingUp, Users } from "lucide-react";
import {
  liveSnapshot,
  statisticsSeries,
  zoneStatistics,
} from "../../shared/constants/operationsDashboardData";
import "../Dashboard/dashboard.css";
import "./statistics.css";

const periods = ["일별", "주별", "월별"];

export default function StatisticsPage() {
  const [period, setPeriod] = useState("일별");

  const totalVehicles = statisticsSeries.reduce((sum, item) => sum + item.vehicles, 0);
  const totalWrongWay = statisticsSeries.reduce((sum, item) => sum + item.wrongWay, 0);
  const totalPedestrians = statisticsSeries.reduce((sum, item) => sum + item.pedestrians, 0);
  const wrongWayRate = totalVehicles > 0 ? ((totalWrongWay / totalVehicles) * 100).toFixed(2) : "0.00";

  const cards = [
    { label: "통과 차량", value: totalVehicles.toLocaleString(), icon: Car, tone: "blue" },
    { label: "역주행", value: totalWrongWay, icon: Siren, tone: "red" },
    { label: "역주행률", value: `${wrongWayRate}%`, icon: TrendingUp, tone: "slate" },
    { label: "보행자", value: totalPedestrians, icon: Users, tone: "purple" },
  ];

  return (
    <div className="ops-page stats-page">
      <header className="ops-header">
        <div>
          <p className="ops-kicker">Statistics</p>
          <h1>교통량 및 이벤트 통계</h1>
          <p className="ops-subtitle">
            다중 객체 payload에서 집계 가능한 통과 차량, 역주행, 보행자 데이터를 기간별로 확인
          </p>
        </div>
        <div className="stats-tabs" aria-label="통계 기간 선택">
          {periods.map((item) => (
            <button
              type="button"
              className={period === item ? "active" : ""}
              key={item}
              onClick={() => setPeriod(item)}
            >
              <CalendarDays size={14} />
              {item}
            </button>
          ))}
        </div>
      </header>

      <section className="ops-kpi-grid stats-kpis">
        {cards.map((item) => {
          const Icon = item.icon;
          return (
            <article className={`ops-kpi-card ${item.tone}`} key={item.label}>
              <div className="ops-kpi-icon">
                <Icon size={19} />
              </div>
              <div>
                <span>{period} 기준</span>
                <strong>{item.value}</strong>
                <small>{item.label}</small>
              </div>
            </article>
          );
        })}
      </section>

      <section className="stats-grid">
        <article className="ops-card stats-chart-card">
          <div className="ops-card-head">
            <div>
              <h2>시간대별 통과 차량 추이</h2>
              <p>정주행 데이터 1초 수신 흐름을 집계한 화면 예시</p>
            </div>
            <BarChart3 size={20} />
          </div>
          <ResponsiveContainer width="100%" height={330}>
            <AreaChart data={statisticsSeries}>
              <defs>
                <linearGradient id="vehiclesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.34} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="vehicles"
                name="통과 차량"
                stroke="#2563eb"
                strokeWidth={3}
                fill="url(#vehiclesGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </article>

        <article className="ops-card stats-chart-card">
          <div className="ops-card-head">
            <div>
              <h2>구역별 역주행 발생</h2>
              <p>zone_id 기준 이벤트 분포</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={330}>
            <BarChart data={zoneStatistics}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="zone" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="wrongWay" name="역주행" fill="#dc2626" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </article>
      </section>

      <section className="ops-card stats-summary">
        <div className="ops-card-head">
          <div>
            <h2>현재 수신 스냅샷</h2>
            <p>Redis 캐시 적용 시 가장 최근 payload를 표시할 영역</p>
          </div>
        </div>
        <div className="stats-summary-grid">
          <span>source: {liveSnapshot.source}</span>
          <span>status: {liveSnapshot.status}</span>
          <span>total_objects: {liveSnapshot.totalObjects}</span>
          <span>processing_time_ms: {liveSnapshot.processingTimeMs}</span>
        </div>
      </section>
    </div>
  );
}
