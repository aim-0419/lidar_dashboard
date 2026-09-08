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
import {
  detectedObjects,
  liveSnapshot,
  monitoringZones,
  realtimeEvents,
} from "../../shared/constants/operationsDashboardData";
import "./dashboard.css";

function objectClassName(objectClass) {
  if (objectClass === 7) return "보행자";
  if (objectClass === 3) return "버스";
  if (objectClass === 2) return "트럭";
  return "차량";
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [serverAlive, setServerAlive] = useState(false);
  const [activeEvent, setActiveEvent] = useState(null);
  const [panelMinimized, setPanelMinimized] = useState(false);
  const [latestSnapshot, setLatestSnapshot] = useState(liveSnapshot);
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
            if (message.type === "state" && message.payload) {
              setLatestSnapshot((prev) => ({ ...prev, ...message.payload }));
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
  }, []);

  const selectedZone = monitoringZones.find((zone) => zone.id === selectedZoneId) || null;
  const visibleZones = selectedZone ? [selectedZone] : monitoringZones;
  const visibleObjects = selectedZone
    ? detectedObjects.filter((item) => item.monitoringZoneId === selectedZone.id)
    : detectedObjects;
  const visibleEvents = selectedZone
    ? realtimeEvents.filter((event) => event.monitoringZoneId === selectedZone.id)
    : realtimeEvents;
  const activeSnapshot = selectedZone?.snapshot || latestSnapshot;

  // 전체 탭은 실시간 합산값을, 구역 탭은 해당 구역의 mock 스냅샷을 사용한다.
  const kpis = [
      {
        label: "오늘 통과 차량",
        value: activeSnapshot.normalMovingVehicleCount.toLocaleString(),
        tone: "blue",
      },
      {
        label: "현재 감지 객체",
        value: activeSnapshot.totalObjects,
        tone: "green",
      },
      {
        label: "역주행 이벤트",
        value: activeSnapshot.wrongWayCount,
        tone: "red",
      },
      {
        label: "보행자 감지",
        value: activeSnapshot.pedestrianCount,
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
          getObjects={(zoneId) =>
            detectedObjects.filter((item) => item.monitoringZoneId === zoneId)
          }
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
                objects={detectedObjects.filter((item) => item.monitoringZoneId === zone.id)}
                isOverview={!selectedZone}
                onSelectZone={setSelectedZoneId}
              />
            ))}
          </div>

          <article className="ops-card">
            <div className="ops-card-head">
              <div>
                <h2>현재 감지 객체</h2>
                <p>objects 배열에 포함된 객체별 최신 상태</p>
              </div>
              <button type="button" onClick={() => navigate("/statistics")}>
                통계 보기
              </button>
            </div>
            <div className="ops-object-list">
              {visibleObjects.length === 0 && (
                <p className="ops-empty-state">현재 감지된 객체가 없습니다.</p>
              )}
              {visibleObjects.map((item) => (
                <div className="ops-object-row" key={item.trackId}>
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
                    <span>{item.speedKmh.toFixed(1)} km/h</span>
                    <span>{Math.round(item.confidence * 100)}%</span>
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
              {visibleEvents.map((event) => (
                <button
                  type="button"
                  className={`ops-event-item ${event.type}`}
                  key={event.id}
                  onClick={() => navigate("/events")}
                >
                  <span>{event.time}</span>
                  <strong>{event.title}</strong>
                  <small>
                    {monitoringZones.find((zone) => zone.id === event.monitoringZoneId)?.name}
                    {" · "}{event.message}
                  </small>
                </button>
              ))}
            </div>
          </article>

          <article className="ops-card">
            <div className="ops-card-head">
              <div>
                <h2>연동 상태</h2>
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
