import { useEffect, useMemo, useState } from "react";
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
import { fetchDashboardState, fetchStatisticsSummary } from "../../shared/api/http";
import { zoneStatistics as fallbackZoneStatistics } from "../../shared/constants/operationsDashboardData";
import "../Dashboard/dashboard.css";
import "./statistics.css";

const PERIODS = ["일별", "주별", "월별"];
const PERIOD_QUERY_MAP = {
  "일별": "daily",
  "주별": "weekly",
  "월별": "monthly",
};
const STATE_REFRESH_INTERVAL_MS = 5000;

const EMPTY_HOURLY_EVENTS = Array.from({ length: 24 }, (_, hour) => ({
  hour: String(hour),
  events: 0,
}));

const FALLBACK_STATE = {
  siteId: "site-wolchulsan-rest-area",
  deviceId: "LIDAR-01",
  vehiclesPassed: 0,
  wrongWayEvents: 0,
  unidentified: 0,
  gate: "CLOSED",
  vmsLast: "",
  hourlyEvents: EMPTY_HOURLY_EVENTS,
};

const EMPTY_SUMMARY = {
  totalVehicles: null,
  wrongWayEvents: null,
  wrongWayRate: null,
  pedestrianCount: null,
};

const WEEKLY_SERIES = [
  { label: "월", vehicles: 142, wrongWay: 1, pedestrians: 2 },
  { label: "화", vehicles: 156, wrongWay: 0, pedestrians: 1 },
  { label: "수", vehicles: 168, wrongWay: 1, pedestrians: 2 },
  { label: "목", vehicles: 174, wrongWay: 2, pedestrians: 3 },
  { label: "금", vehicles: 191, wrongWay: 1, pedestrians: 2 },
  { label: "토", vehicles: 228, wrongWay: 3, pedestrians: 4 },
  { label: "일", vehicles: 205, wrongWay: 2, pedestrians: 3 },
];

const MONTHLY_SERIES = [
  { label: "1월", vehicles: 1048, wrongWay: 4, pedestrians: 8 },
  { label: "2월", vehicles: 1126, wrongWay: 5, pedestrians: 9 },
  { label: "3월", vehicles: 1184, wrongWay: 4, pedestrians: 10 },
  { label: "4월", vehicles: 1232, wrongWay: 6, pedestrians: 9 },
  { label: "5월", vehicles: 1288, wrongWay: 5, pedestrians: 11 },
  { label: "6월", vehicles: 1324, wrongWay: 6, pedestrians: 12 },
  { label: "7월", vehicles: 1386, wrongWay: 7, pedestrians: 13 },
  { label: "8월", vehicles: 1422, wrongWay: 6, pedestrians: 12 },
  { label: "9월", vehicles: 1368, wrongWay: 5, pedestrians: 10 },
  { label: "10월", vehicles: 1294, wrongWay: 4, pedestrians: 9 },
  { label: "11월", vehicles: 1216, wrongWay: 3, pedestrians: 8 },
  { label: "12월", vehicles: 1158, wrongWay: 4, pedestrians: 7 },
];

const WEEKLY_ZONE_STATISTICS = [
  { zone: "Z170", wrongWay: 1, vehicles: 142 },
  { zone: "Z261", wrongWay: 1, vehicles: 176 },
  { zone: "Z327", wrongWay: 2, vehicles: 198 },
  { zone: "Z455", wrongWay: 3, vehicles: 164 },
  { zone: "Z469", wrongWay: 1, vehicles: 186 },
];

const MONTHLY_ZONE_STATISTICS = [
  { zone: "Z170", wrongWay: 4, vehicles: 1048 },
  { zone: "Z261", wrongWay: 5, vehicles: 1260 },
  { zone: "Z327", wrongWay: 6, vehicles: 1388 },
  { zone: "Z455", wrongWay: 7, vehicles: 1182 },
  { zone: "Z469", wrongWay: 4, vehicles: 1424 },
];

function formatHourLabel(hourText, fallbackHour) {
  if (typeof hourText === "string" && hourText.trim()) {
    const [hourPart = hourText] = hourText.split(":");
    return String(Number(hourPart));
  }

  return String(fallbackHour);
}

function normalizeHourlySeries(hourlyEvents = []) {
  return Array.from({ length: 24 }, (_, hour) => {
    const current = hourlyEvents[hour] || {};
    const vehicles = Number(current.events || current.vehicles || 0);

    return {
      label: formatHourLabel(current.hour, hour),
      vehicles,
      wrongWay: Number(current.wrongWay || 0),
      pedestrians: Number(current.pedestrians || 0),
    };
  });
}

function getZoneStatistics(period) {
  if (period === "주별") return WEEKLY_ZONE_STATISTICS;
  if (period === "월별") return MONTHLY_ZONE_STATISTICS;
  return fallbackZoneStatistics;
}

function getStatisticsSeries(period, dashboardState) {
  if (period === "주별") return WEEKLY_SERIES;
  if (period === "월별") return MONTHLY_SERIES;
  return normalizeHourlySeries(dashboardState.hourlyEvents);
}

export default function StatisticsPage() {
  const [period, setPeriod] = useState("일별");
  const [dashboardState, setDashboardState] = useState(FALLBACK_STATE);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardState({ silent = false } = {}) {
      if (!silent) {
        setIsLoading(true);
      }

      try {
        const response = await fetchDashboardState();
        if (!isMounted) return;

        setDashboardState({
          ...FALLBACK_STATE,
          ...response,
          hourlyEvents: Array.isArray(response?.hourlyEvents)
            ? response.hourlyEvents
            : FALLBACK_STATE.hourlyEvents,
        });
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) return;
        setErrorMessage(error.message || "통계 상태를 불러오지 못했습니다.");
      } finally {
        if (isMounted && !silent) {
          setIsLoading(false);
        }
      }
    }

    loadDashboardState();
    const timer = setInterval(() => {
      loadDashboardState({ silent: true });
    }, STATE_REFRESH_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  const statisticsSeries = useMemo(
    () => getStatisticsSeries(period, dashboardState),
    [period, dashboardState],
  );
  const zoneStatistics = useMemo(() => getZoneStatistics(period), [period]);

  useEffect(() => {
    let isMounted = true;

    async function loadSummary() {
      try {
        const response = await fetchStatisticsSummary(PERIOD_QUERY_MAP[period]);
        if (!isMounted) return;

        setSummary({
          ...EMPTY_SUMMARY,
          ...response?.summary,
        });
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) return;
        setErrorMessage(error.message || "통계 요약을 불러오지 못했습니다.");
      }
    }

    loadSummary();

    return () => {
      isMounted = false;
    };
  }, [period]);

  const fallbackTotalVehicles =
    period === "일별"
      ? Number(dashboardState.vehiclesPassed || 0)
      : statisticsSeries.reduce((sum, item) => sum + Number(item.vehicles || 0), 0);

  const fallbackTotalWrongWay =
    period === "일별"
      ? Number(dashboardState.wrongWayEvents || 0)
      : statisticsSeries.reduce((sum, item) => sum + Number(item.wrongWay || 0), 0);

  const fallbackTotalPedestrians = statisticsSeries.reduce(
    (sum, item) => sum + Number(item.pedestrians || 0),
    0,
  );

  const totalVehicles = Number(summary.totalVehicles ?? fallbackTotalVehicles ?? 0);
  const totalWrongWay = Number(summary.wrongWayEvents ?? fallbackTotalWrongWay ?? 0);
  const totalPedestrians = Number(summary.pedestrianCount ?? fallbackTotalPedestrians ?? 0);

  const fallbackWrongWayRate =
    fallbackTotalVehicles > 0 ? ((fallbackTotalWrongWay / fallbackTotalVehicles) * 100).toFixed(2) : "0.00";
  const wrongWayRate =
    summary.wrongWayRate !== null && summary.wrongWayRate !== undefined
      ? Number(summary.wrongWayRate).toFixed(2)
      : fallbackWrongWayRate;

  const cards = [
    {
      label: "통과 차량",
      value: totalVehicles.toLocaleString(),
      icon: Car,
      tone: "blue",
      description: period === "일별" ? "실시간 누적 통과 차량 수" : `${period} 누적 집계 값`,
    },
    {
      label: "역주행 이벤트",
      value: totalWrongWay.toLocaleString(),
      icon: Siren,
      tone: "red",
      description: period === "일별" ? "실시간 누적 역주행 이벤트 수" : `${period} 누적 집계 값`,
    },
    {
      label: "역주행 비율",
      value: `${wrongWayRate}%`,
      icon: TrendingUp,
      tone: "slate",
      description: "통과 차량 대비 역주행 비율",
    },
    {
      label: "보행자 감지",
      value: totalPedestrians.toLocaleString(),
      icon: Users,
      tone: "purple",
      description: `${period} 기준 집계 값`,
    },
  ];

  return (
    <div className="ops-page stats-page">
      <header className="ops-header">
        <div>
          <p className="ops-kicker">Statistics</p>
          <h1>교통량 및 이벤트 통계</h1>
          <p className="ops-subtitle">
            시간대별 통과 차량 추이와 구역별 역주행 발생 현황을 기간 기준으로 확인합니다.
          </p>
          {errorMessage ? <p className="ops-subtitle">상태 동기화 실패: {errorMessage}</p> : null}
        </div>
        <div className="stats-tabs" aria-label="통계 기간 선택">
          {PERIODS.map((item) => (
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
                <strong>{isLoading ? "불러오는 중..." : item.value}</strong>
                <small>{item.label} · {item.description}</small>
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
              <p>
                {period === "일별"
                  ? "0시부터 23시까지 24시간 전체 구간을 표시합니다."
                  : period === "월별"
                    ? "1월부터 12월까지 월 단위 통과 차량 집계를 표시합니다."
                    : `${period} 기준 테스트 데이터로 차트를 표시합니다.`}
              </p>
            </div>
            <BarChart3 size={20} />
          </div>
          <ResponsiveContainer width="100%" height={330}>
            <AreaChart data={statisticsSeries} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="vehiclesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.34} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#64748b", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                interval={0}
                padding={{ left: 8, right: 12 }}
              />
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
              <p>{period === "일별" ? "구역별 테스트 집계 값" : `${period} 기준 테스트 집계 값`}</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={330}>
            <BarChart data={zoneStatistics}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="zone"
                tick={{ fill: "#64748b", fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
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
            <h2>현재 연동 상태</h2>
            <p>실시간 KPI 연결에 사용하는 현재 서버 상태 값입니다.</p>
          </div>
        </div>
        <div className="stats-summary-grid">
          <span>siteId: {dashboardState.siteId}</span>
          <span>deviceId: {dashboardState.deviceId}</span>
          <span>gate: {dashboardState.gate}</span>
          <span>vmsLast: {dashboardState.vmsLast || "(empty)"}</span>
        </div>
      </section>
    </div>
  );
}














