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
import { fetchDashboardState, fetchStatisticsSummary, fetchTrafficSeries } from "../../shared/api/http";
import { zoneStatistics as fallbackZoneStatistics } from "../../shared/constants/operationsDashboardData";
import "../Dashboard/dashboard.css";
import "./statistics.css";

const PERIODS = ["일별", "주별", "월별", "사용자 지정"];
const PERIOD_QUERY_MAP = {
  "일별": "daily",
  "주별": "weekly",
  "월별": "monthly",
  "사용자 지정": "custom",
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

const EMPTY_SERIES_RESPONSE = {
  period: "daily",
  bucketUnit: "hour",
  series: [],
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

function formatDateInputValue(date) {
  const value = new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeCustomRange(nextRange) {
  if (!nextRange.startDate || !nextRange.endDate) {
    return nextRange;
  }

  if (nextRange.startDate > nextRange.endDate) {
    return {
      startDate: nextRange.startDate,
      endDate: nextRange.startDate,
    };
  }

  return nextRange;
}

function DailyAxisTick({ x, y, payload }) {
  const label = String(payload?.value || "");
  const [, timeText = label] = label.split(" ");

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={9}
        textAnchor="middle"
        fill="#64748b"
        fontSize="11"
        fontWeight="700"
      >
        {timeText}
      </text>
    </g>
  );
}

function PeriodAxisTick({ x, y, payload }) {
  const label = String(payload?.value || "");
  const parts = label.split(" ");
  const firstLine = parts[0] || label;
  const secondLine = parts.slice(1).join(" ");

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={22}
        textAnchor="middle"
        fill="#64748b"
        fontSize="11"
        fontWeight="700"
      >
        <tspan x="0" dy="0">
          {firstLine}
        </tspan>
        {secondLine ? (
          <tspan x="0" dy="13">
            {secondLine}
          </tspan>
        ) : null}
      </text>
    </g>
  );
}

function getCustomTickInterval(bucketUnit, seriesLength) {
  if (!seriesLength || seriesLength <= 0) {
    return 0;
  }

  if (bucketUnit === "hour") {
    if (seriesLength <= 24) return 0;
    if (seriesLength <= 48) return 3;
    if (seriesLength <= 72) return 5;
    return 7;
  }

  if (bucketUnit === "day") {
    if (seriesLength <= 10) return 0;
    if (seriesLength <= 20) return 1;
    if (seriesLength <= 45) return 2;
    return 4;
  }

  if (bucketUnit === "month") {
    if (seriesLength <= 12) return 0;
    if (seriesLength <= 24) return 1;
    return 2;
  }

  return 0;
}

function getCustomWindowSize(bucketUnit) {
  if (bucketUnit === "hour") {
    return 24;
  }

  if (bucketUnit === "day") {
    return 14;
  }

  if (bucketUnit === "month") {
    return 12;
  }

  return 12;
}

function getCustomWindowDescription(bucketUnit, totalCount) {
  if (bucketUnit === "hour") {
    return totalCount > 24
      ? "사용자 지정 기간 중 최근 24시간 구간을 기본으로 표시합니다."
      : "선택한 기간의 시간 단위 데이터를 표시합니다.";
  }

  if (bucketUnit === "day") {
    return totalCount > 14
      ? "사용자 지정 기간 중 최근 14일 구간을 기본으로 표시합니다."
      : "선택한 기간의 일 단위 데이터를 표시합니다.";
  }

  if (bucketUnit === "month") {
    return totalCount > 12
      ? "사용자 지정 기간 중 최근 12개월 구간을 기본으로 표시합니다."
      : "선택한 기간의 월 단위 데이터를 표시합니다.";
  }

  return "선택한 기간의 통과 차량 집계를 표시합니다.";
}

function getChartWindowSize(period, bucketUnit) {
  if (period === "주별" || period === "월별") {
    return 12;
  }

  if (period === "사용자 지정") {
    return getCustomWindowSize(bucketUnit);
  }

  return 0;
}

function formatTooltipDateRange(startAt, endAt, bucketUnit) {
  const start = startAt ? new Date(startAt) : null;
  const end = endAt ? new Date(endAt) : null;

  if (!start || Number.isNaN(start.getTime())) {
    return "";
  }

  const formatDate = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const formatHour = (date) => `${String(date.getHours()).padStart(2, "0")}시`;

  if (bucketUnit === "hour") {
    return `${formatDate(start)} ${formatHour(start)}`;
  }

  if (bucketUnit === "day") {
    return formatDate(start);
  }

  if (bucketUnit === "week") {
    if (!end || Number.isNaN(end.getTime())) {
      return formatDate(start);
    }

    return `${formatDate(start)} ~ ${formatDate(end)}`;
  }

  return `${start.getFullYear()}년 ${start.getMonth() + 1}월`;
}

function StatisticsTooltip({ active, payload, bucketUnit }) {
  if (!active || !Array.isArray(payload) || payload.length === 0) {
    return null;
  }

  const item = payload[0]?.payload;

  if (!item) {
    return null;
  }

  const rangeText =
    formatTooltipDateRange(item.startAt, item.endAt, bucketUnit) || String(item.label || "");

  return (
    <div
      style={{
        border: "1px solid #dbe4f0",
        borderRadius: "12px",
        padding: "10px 12px",
        background: "rgba(255, 255, 255, 0.96)",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.12)",
      }}
    >
      <div style={{ color: "#0f172a", fontSize: "12px", fontWeight: 800 }}>{rangeText}</div>
      <div style={{ marginTop: "6px", color: "#2563eb", fontSize: "13px", fontWeight: 900 }}>
        통과 차량 {Number(item.vehicles || 0).toLocaleString()}대
      </div>
    </div>
  );
}

export default function StatisticsPage() {
  const [period, setPeriod] = useState("일별");
  const [dashboardState, setDashboardState] = useState(FALLBACK_STATE);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [seriesResponse, setSeriesResponse] = useState(EMPTY_SERIES_RESPONSE);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [chartWindowStart, setChartWindowStart] = useState(0);
  const [chartDragState, setChartDragState] = useState(null);
  const [customRange, setCustomRange] = useState(() => {
    const today = new Date();
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(today.getDate() - 2);

    return {
      startDate: formatDateInputValue(threeDaysAgo),
      endDate: formatDateInputValue(today),
    };
  });

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

  useEffect(() => {
    let isMounted = true;

    async function loadStatistics() {
      try {
        if (isMounted) {
          setSummary(EMPTY_SUMMARY);
          setSeriesResponse({
            ...EMPTY_SERIES_RESPONSE,
            period: PERIOD_QUERY_MAP[period] || "daily",
          });
        }

        const options = {
          siteId: dashboardState.siteId,
        };

        if (PERIOD_QUERY_MAP[period] === "custom") {
          options.startDate = customRange.startDate;
          options.endDate = customRange.endDate;
        }

        const [summaryResponse, trafficSeriesResponse] = await Promise.all([
          fetchStatisticsSummary(PERIOD_QUERY_MAP[period], options),
          fetchTrafficSeries(PERIOD_QUERY_MAP[period], options),
        ]);

        if (!isMounted) return;

        setSummary({
          ...EMPTY_SUMMARY,
          ...summaryResponse?.summary,
        });
        setSeriesResponse({
          ...EMPTY_SERIES_RESPONSE,
          ...trafficSeriesResponse,
        });
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) return;
        setErrorMessage(error.message || "통계 데이터를 불러오지 못했습니다.");
      }
    }

    loadStatistics();

    return () => {
      isMounted = false;
    };
  }, [period, dashboardState.siteId, customRange.startDate, customRange.endDate]);

  const statisticsSeries = useMemo(() => {
    if (Array.isArray(seriesResponse.series) && seriesResponse.series.length > 0) {
      return seriesResponse.series.map((item) => ({
        label: item.label,
        vehicles: Number(item.value || 0),
        wrongWay: 0,
        pedestrians: 0,
      }));
    }

    if (period === "주별") return WEEKLY_SERIES;
    if (period === "월별") return MONTHLY_SERIES;
    if (period === "사용자 지정") {
      return [];
    }
    return normalizeHourlySeries(dashboardState.hourlyEvents);
  }, [period, seriesResponse.series, dashboardState]);

  const zoneStatistics = useMemo(() => getZoneStatistics(period), [period]);
  const isPannablePeriod = period === "주별" || period === "월별" || period === "사용자 지정";
  const chartWindowSize = useMemo(() => {
    return getChartWindowSize(period, seriesResponse.bucketUnit);
  }, [period, seriesResponse.bucketUnit]);

  const maxChartWindowStart = useMemo(() => {
    if (!isPannablePeriod || !chartWindowSize) {
      return 0;
    }

    return Math.max(statisticsSeries.length - chartWindowSize, 0);
  }, [isPannablePeriod, chartWindowSize, statisticsSeries.length]);

  useEffect(() => {
    if (!isPannablePeriod) {
      setChartWindowStart(0);
      setChartDragState(null);
      return;
    }

    setChartWindowStart(maxChartWindowStart);
    setChartDragState(null);
  }, [
    isPannablePeriod,
    maxChartWindowStart,
    customRange.startDate,
    customRange.endDate,
    seriesResponse.bucketUnit,
  ]);

  const visibleStatisticsSeries = useMemo(() => {
    if (!isPannablePeriod) {
      return statisticsSeries;
    }

    if (!chartWindowSize || statisticsSeries.length <= chartWindowSize) {
      return statisticsSeries;
    }

    const safeWindowStart = Math.min(Math.max(chartWindowStart, 0), maxChartWindowStart);

    return statisticsSeries.slice(safeWindowStart, safeWindowStart + chartWindowSize);
  }, [isPannablePeriod, statisticsSeries, chartWindowSize, chartWindowStart, maxChartWindowStart]);

  const canPanSeries = useMemo(() => {
    return isPannablePeriod && chartWindowSize > 0 && statisticsSeries.length > chartWindowSize;
  }, [isPannablePeriod, chartWindowSize, statisticsSeries.length]);

  const customTickInterval = useMemo(() => {
    if (period !== "사용자 지정") {
      return 0;
    }

    return getCustomTickInterval(seriesResponse.bucketUnit, visibleStatisticsSeries.length);
  }, [period, seriesResponse.bucketUnit, visibleStatisticsSeries.length]);
  const chartBucketUnit = seriesResponse.bucketUnit || (period === "일별" ? "hour" : undefined);

  function handleCustomChartPointerDown(event) {
    if (!canPanSeries) {
      return;
    }

    setChartDragState({
      pointerId: event.pointerId,
      startX: event.clientX,
      startWindowStart: chartWindowStart,
    });

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleCustomChartPointerMove(event) {
    if (!chartDragState || chartDragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - chartDragState.startX;
    const shift = Math.trunc(deltaX / 36);

    if (shift === 0) {
      return;
    }

    const nextWindowStart = Math.min(
      Math.max(chartDragState.startWindowStart - shift, 0),
      maxChartWindowStart,
    );

    setChartWindowStart(nextWindowStart);
  }

  function clearCustomChartDrag(event) {
    if (!chartDragState || chartDragState.pointerId !== event.pointerId) {
      return;
    }

    setChartDragState(null);

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

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
        <div className="stats-controls">
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
          {period === "사용자 지정" ? (
            <div className="stats-custom-range">
              <label className="stats-custom-field">
                <span>시작</span>
                <input
                  type="date"
                  value={customRange.startDate}
                  onChange={(event) =>
                    setCustomRange((prev) =>
                      normalizeCustomRange({
                        ...prev,
                        startDate: event.target.value,
                      }),
                    )
                  }
                />
              </label>
              <span className="stats-custom-separator">~</span>
              <label className="stats-custom-field">
                <span>종료</span>
                <input
                  type="date"
                  value={customRange.endDate}
                  onChange={(event) =>
                    setCustomRange((prev) => {
                      const nextEndDate = event.target.value;

                      if (prev.startDate && nextEndDate && nextEndDate < prev.startDate) {
                        return {
                          startDate: nextEndDate,
                          endDate: nextEndDate,
                        };
                      }

                      return {
                        ...prev,
                        endDate: nextEndDate,
                      };
                    })
                  }
                />
              </label>
            </div>
          ) : null}
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
                    ? `최근 36개월 데이터를 불러오고, 기본으로 최근 12개월 구간을 표시합니다.${canPanSeries ? " 차트를 좌우로 드래그하면 이전/이후 구간을 이동할 수 있습니다." : ""}`
                    : period === "주별"
                      ? `최근 52주 데이터를 불러오고, 기본으로 최근 12주 구간을 표시합니다.${canPanSeries ? " 차트를 좌우로 드래그하면 이전/이후 구간을 이동할 수 있습니다." : ""}`
                      : `${customRange.startDate}부터 ${customRange.endDate}까지의 사용자 지정 기간 집계를 표시합니다. ${getCustomWindowDescription(
                          seriesResponse.bucketUnit,
                          statisticsSeries.length,
                        )}${canPanSeries ? " 차트를 좌우로 드래그하면 이전/이후 구간을 이동할 수 있습니다." : ""}`}
              </p>
            </div>
            <BarChart3 size={20} />
          </div>
          <div
            className={`stats-chart-interactive${canPanSeries ? " is-draggable" : ""}`}
            onPointerDown={handleCustomChartPointerDown}
            onPointerMove={handleCustomChartPointerMove}
            onPointerUp={clearCustomChartDrag}
            onPointerCancel={clearCustomChartDrag}
          >
            <ResponsiveContainer width="100%" height={330}>
              <AreaChart
                data={visibleStatisticsSeries}
                margin={{
                  top: 8,
                  right: 20,
                  left: 0,
                  bottom: 18,
                }}
              >
                <defs>
                  <linearGradient id="vehiclesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.34} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={
                    period === "일별" || period === "주별" || period === "월별" || period === "사용자 지정"
                      ? period === "일별"
                        ? <DailyAxisTick />
                        : <PeriodAxisTick />
                      : { fill: "#64748b", fontSize: 12 }
                  }
                  axisLine={false}
                  tickLine={false}
                  tickMargin={period === "일별" ? 12 : 10}
                  interval={period === "사용자 지정" ? customTickInterval : 0}
                  height={72}
                  padding={{ left: 8, right: 12 }}
                />
                <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  content={<StatisticsTooltip bucketUnit={chartBucketUnit} />}
                  cursor={{ stroke: "#93c5fd", strokeDasharray: "4 4" }}
                />
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
          </div>
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














