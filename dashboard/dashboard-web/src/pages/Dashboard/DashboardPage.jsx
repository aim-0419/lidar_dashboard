import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  Car,
  CheckCircle2,
  Clock3,
  Maximize2,
  Radio,
  Wifi,
} from "lucide-react";
import { apiUrl, WS_BASE } from "../../shared/api/config";
import { fetchWebSocketTicket } from "../../shared/api/http";
import { ZoneLiveView } from "../../features/dashboard/components/ZoneLiveView";
import { FullscreenLiveView } from "../../features/dashboard/components/FullscreenLiveView";
import { WrongwayAlertModal } from "../../features/dashboard/components/WrongwayAlertModal";
import { SampleDataBadge } from "../../features/dashboard/components/SampleDataBadge";
import { formatClockTime } from "../../features/dashboard/formatClockTime";
import { useDashboardOverview } from "../../features/dashboard/useDashboardOverview";
import { useRecentDashboardEvents } from "../../features/dashboard/useRecentDashboardEvents";
import { eventTypeClass, eventTypeText } from "../../features/events/eventLabels";
import { monitoringZones } from "../../shared/constants/operationsDashboardData";
import "./dashboard.css";

function objectClassName(objectClass) {
  if (objectClass === 7) return "보행자";
  if (objectClass === 3) return "버스";
  if (objectClass === 2) return "트럭";
  return "차량";
}

// 서버 현황의 객체를 화면 구역(monitoringZones.id)과 연결하고 표시용 문구를 붙인다.
function toDisplayObject(item, monitoringZoneId) {
  return {
    ...item,
    monitoringZoneId,
    type: eventTypeClass(item.type),
    zoneId: item.externalZoneId,
    message: eventTypeText(item.type),
  };
}

function formatKpi(value) {
  return typeof value === "number" ? value.toLocaleString() : "-";
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [serverAlive, setServerAlive] = useState(false);
  const [activeEvent, setActiveEvent] = useState(null);
  const [panelMinimized, setPanelMinimized] = useState(false);
  const { overview, status: overviewStatus, applyOverview } = useDashboardOverview();
  const [selectedZoneId, setSelectedZoneId] = useState("all");
  const [liveFullscreen, setLiveFullscreen] = useState(false);

  // 전체 화면 뷰 진입/해제. 브라우저 전체 화면은 사용자 클릭 제스처에서 바로 요청해야 안정적이다.
  function openLiveFullscreen() {
    document.documentElement.requestFullscreen?.().catch(() => {});
    setLiveFullscreen(true);
  }

  function closeLiveFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
    setLiveFullscreen(false);
  }

  // 서버 헬스체크는 실제 백엔드 연결 상태를 화면 상단에 계속 반영한다.
  useEffect(() => {
    let timer;
    const ping = async () => {
      try {
        const res = await fetch(apiUrl("/api/health"), { cache: "no-store" });
        setServerAlive(res.ok);
      } catch {
        setServerAlive(false);
      }
    };

    ping();
    timer = setInterval(ping, 3000);
    return () => clearInterval(timer);
  }, []);

  // 기존 WebSocket 이벤트는 유지해서 백엔드 실시간 이벤트 연결 시 화면에 바로 반영되게 둔다.
  // 대시보드 진입 시 websocket 티켓을 먼저 발급받고, 그 티켓으로 실시간 연결을 시작한다. 
  useEffect(() => {
    let ws = null;
    let isMounted = true;

    // http로 받은 1회용 티켓을 query string에 담아 websocket 연결을 생성한다. 
    async function connectWebSocket() {
      try {
        const ticketResponse = await fetchWebSocketTicket();

        if (!isMounted || !ticketResponse?.ticket) {
          return;
        }

        const wsUrl = new URL(WS_BASE);
        wsUrl.searchParams.set("ticket", ticketResponse.ticket);

        ws = new WebSocket(wsUrl.toString());

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            // 라이다 snapshot 저장 후 서버가 보내는 메인 대시보드 현황(KPI, 현재 감지 객체, 수신 상태)
            if (message.type === "dashboard-overview" && message.payload) {
              applyOverview(message.payload);
            }
            if (message.type === "dashboard-event") {
              const payload = message.payload || {};
              const eventType = String(payload.type || "wrong-way");

              // 역주행 감지 이벤트일 때만 경보 모달을 띄운다.
              if (eventType.startsWith("wrong-way")) {
                setActiveEvent({
                  id: payload.id || "LIVE-EVENT",
                  zoneId: payload.zone_id || "",
                  trackId: payload.track_id || "",
                  message: payload.message || payload.subMessage || "역주행이 감지되었습니다.",
                  time: payload.timestamp || "실시간",
                  confidence: payload.confidence,
                  source: payload.source,
                });
                setPanelMinimized(false);
              }
            }
          } catch {
            // 화면 수신용 WS이므로 잘못된 메시지는 무시하고 다음 이벤트를 기다린다.
          }
        };
      } catch {
        // WebSocket ticket 발급에 실패해도 대시보드 기본 화면은 계속 사용할 수 있게 둡니다.
      }
    }

    connectWebSocket();

    return () => {
      isMounted = false;
      if (ws) {
        ws.close();
      }
    };
  }, [applyOverview]);

  const selectedZone = monitoringZones.find((zone) => zone.id === selectedZoneId) || null;
  const visibleZones = selectedZone ? [selectedZone] : monitoringZones;

  // 서버 현황은 zoneCode 기준이므로 화면 구역(monitoringZones)과 zoneCode로 연결한다.
  function getZoneOverview(zoneId) {
    const zone = monitoringZones.find((item) => item.id === zoneId);
    return overview?.zones?.find((item) => item.zoneCode === zone?.zoneCode) || null;
  }

  function getZoneObjects(zoneId) {
    return (getZoneOverview(zoneId)?.activeObjects || []).map((item) => toDisplayObject(item, zoneId));
  }

  function getZoneLidar(zoneId) {
    return getZoneOverview(zoneId)?.lidar || null;
  }

  const visibleObjects = visibleZones.flatMap((zone) => getZoneObjects(zone.id));
  // 수신이 끊긴 구역은 객체 목록이 비어도 "차량 없음"으로 오해하지 않도록 따로 경고한다.
  const lidarLostZones = visibleZones.filter((zone) => getZoneLidar(zone.id)?.receiving === false);
  // 실시간 이벤트는 DB 이력 API 기준이며, 역주행 경보가 새로 들어오면 즉시 다시 조회한다.
  const { events: recentEvents, status: recentEventsStatus } = useRecentDashboardEvents(activeEvent?.id);
  const visibleEvents = selectedZone
    ? recentEvents.filter((event) => event.zone?.code === selectedZone.zoneCode)
    : recentEvents;
  // 전체 탭은 전체 합계를, 구역 탭은 해당 구역 값을 사용한다. 현황 조회 전에는 "-"로 표시한다.
  const kpiSource = selectedZone ? getZoneOverview(selectedZone.id)?.kpis : overview?.totals;
  const kpis = [
      {
        label: "오늘 통과 차량",
        value: formatKpi(kpiSource?.todayVehicleCount),
        tone: "blue",
      },
      {
        label: "현재 감지 객체",
        value: formatKpi(kpiSource?.activeObjectCount),
        tone: "green",
      },
      {
        label: "오늘 역주행 이벤트",
        value: formatKpi(kpiSource?.todayWrongWayCount),
        tone: "red",
      },
      {
        label: "오늘 보행자 감지",
        value: formatKpi(kpiSource?.todayPedestrianCount),
        tone: "purple",
      },
    ];

  return (
    <div className="ops-page">
      {activeEvent && !panelMinimized && (
        <WrongwayAlertModal
          event={activeEvent}
          onClose={() => setActiveEvent(null)}
          onMinimize={() => setPanelMinimized(true)}
        />
      )}

      {activeEvent && panelMinimized && (
        <button className="ops-alert-pill" type="button" onClick={() => setPanelMinimized(false)}>
          <Bell size={16} />
          역주행 대응 중 · 클릭해서 열기
        </button>
      )}

      <header className="ops-header">
        <div>
          <p className="ops-kicker">
            월출산휴게소 {selectedZone ? selectedZone.name : "회전교차로 전체"}
          </p>
          <h1>라이다 역주행 방지 관제 대시보드</h1>
          <p className="ops-subtitle">
            다중 객체 payload 기준으로 현재 도로 상황, 역주행 경고, 장비 연결 상태를 통합 확인
          </p>
        </div>
        <div className="ops-header-actions">
          <span className={`ops-status ${serverAlive ? "online" : "offline"}`}>
            <Wifi size={15} />
            {serverAlive ? "SERVER ONLINE" : "SERVER OFFLINE"}
          </span>
          <button type="button" onClick={openLiveFullscreen}>
            <Maximize2 size={15} />
            전체 화면
          </button>
        </div>
      </header>

      {liveFullscreen && (
        <FullscreenLiveView
          zones={monitoringZones}
          getObjects={getZoneObjects}
          getLidar={getZoneLidar}
          onClose={closeLiveFullscreen}
        />
      )}

      <nav className="ops-zone-tabs" aria-label="관제 구역 선택">
        <button
          type="button"
          className={selectedZoneId === "all" ? "active" : ""}
          onClick={() => setSelectedZoneId("all")}
        >
          전체 현황
        </button>
        {monitoringZones.map((zone) => (
          <button
            type="button"
            className={selectedZoneId === zone.id ? "active" : ""}
            key={zone.id}
            onClick={() => setSelectedZoneId(zone.id)}
          >
            {zone.name}
          </button>
        ))}
      </nav>

      <section className="ops-kpi-grid dashboard-kpis">
        {kpis.map((item) => (
          <article className={`ops-kpi-card ${item.tone}`} key={item.label}>
            <div>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          </article>
        ))}
      </section>

      <section className="ops-dashboard-grid">
        <div className="ops-main-column">
          <div className={`ops-zone-live-grid ${selectedZone ? "single" : ""}`}>
            {visibleZones.map((zone) => (
              <ZoneLiveView
                key={zone.id}
                zone={zone}
                objects={getZoneObjects(zone.id)}
                lidar={getZoneLidar(zone.id)}
                isOverview={!selectedZone}
                onSelectZone={setSelectedZoneId}
              />
            ))}
          </div>

          <article className="ops-card">
            <div className="ops-card-head">
              <div>
                <h2>현재 감지 객체</h2>
                <p>라이다가 최근 5초 안에 보고한 객체별 최신 상태</p>
              </div>
              <button type="button" onClick={() => navigate("/statistics")}>
                통계 보기
              </button>
            </div>
            <div className="ops-object-list">
              {lidarLostZones.map((zone) => {
                const lastReceivedAt = getZoneLidar(zone.id)?.lastReceivedAt;
                return (
                  <p className="ops-lidar-lost-state" key={zone.id}>
                    <AlertTriangle size={15} />
                    <strong>{zone.name} 라이다 수신 끊김</strong>
                    <span>
                      {lastReceivedAt ? `마지막 수신 ${formatClockTime(lastReceivedAt)}` : "수신 기록 없음"}
                    </span>
                  </p>
                );
              })}
              {overviewStatus === "loading" && (
                <p className="ops-empty-state">현황을 불러오는 중입니다.</p>
              )}
              {overviewStatus === "error" && !overview && (
                <p className="ops-empty-state">현황을 불러오지 못했습니다.</p>
              )}
              {overview && visibleObjects.length === 0 && lidarLostZones.length < visibleZones.length && (
                <p className="ops-empty-state">현재 감지된 객체가 없습니다.</p>
              )}
              {visibleObjects.map((item) => (
                <div className="ops-object-row" key={`${item.monitoringZoneId}-${item.trackId}`}>
                  <div className={`ops-object-type ${item.type}`}>
                    {item.warningLevel > 0 ? <AlertTriangle size={16} /> : <Car size={16} />}
                  </div>
                  <div className="ops-object-main">
                    <strong>{item.message}</strong>
                    <span>{item.trackId}</span>
                  </div>
                  <div className="ops-object-meta">
                    <span>{item.zoneId}</span>
                    <span>{objectClassName(item.objectClass)}</span>
                    <span>{typeof item.speedKmh === "number" ? `${item.speedKmh.toFixed(1)} km/h` : "-"}</span>
                    <span>{typeof item.confidence === "number" ? `${Math.round(item.confidence * 100)}%` : "-"}</span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>

        <aside className="ops-side-column">
          <article className="ops-card">
            <div className="ops-card-head">
              <div>
                <h2>실시간 이벤트</h2>
                <p>최근 수신 순서</p>
              </div>
              <Clock3 size={19} />
            </div>
            <div className="ops-event-feed">
              {recentEventsStatus === "error" && (
                <p className="ops-empty-state">이벤트 이력을 불러오지 못했습니다.</p>
              )}
              {recentEventsStatus === "ready" && visibleEvents.length === 0 && (
                <p className="ops-empty-state">수신된 이벤트가 없습니다.</p>
              )}
              {visibleEvents.map((event) => (
                <button
                  type="button"
                  className={`ops-event-item ${eventTypeClass(event.eventType)}`}
                  key={event.id}
                  onClick={() => navigate("/events")}
                >
                  <span>{formatClockTime(event.occurredAt || event.receivedAt)}</span>
                  <strong>{eventTypeText(event.eventType)}</strong>
                  <small>
                    {event.zone?.name || event.externalZoneId || "구역 미확인"}
                    {event.message ? ` · ${event.message}` : ""}
                  </small>
                </button>
              ))}
            </div>
          </article>

          <article className="ops-card">
            <div className="ops-card-head">
              <div>
                <h2>연동 상태 <SampleDataBadge /></h2>
                <p>현장 테스트 기준</p>
              </div>
              <Radio size={19} />
            </div>
            <div className="ops-link-status">
              {visibleZones.map((zone) => {
                const warningCount = zone.devices.filter((device) => device.status !== "online").length;
                return (
                  <button type="button" key={zone.id} onClick={() => setSelectedZoneId(zone.id)}>
                    {warningCount === 0
                      ? <CheckCircle2 size={16} />
                      : <AlertTriangle size={16} />}
                    <strong>{zone.name}</strong>
                    <small>
                      장비 {zone.devices.length}대 · {warningCount === 0 ? "전체 정상" : `확인 필요 ${warningCount}대`}
                    </small>
                  </button>
                );
              })}
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}
