import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Bell,
  Camera,
  Car,
  CheckCircle2,
  CircleDot,
  Clock3,
  Gauge,
  MapPin,
  Radio,
  Siren,
  Users,
  Wifi,
  X,
} from "lucide-react";
import { apiUrl, WS_BASE } from "../../shared/api/config";
import {
  detectedObjects,
  liveSnapshot,
  realtimeEvents,
} from "../../shared/constants/operationsDashboardData";
import "./dashboard.css";

function statusLabel(type) {
  if (type === "wrong-way-level-2") return "2차 경고";
  if (type === "wrong-way-level-1") return "1차 경고";
  if (type === "pedestrian-entered") return "보행자";
  if (type === "situation-ended") return "종료";
  return "정주행";
}

function objectClassName(objectClass) {
  if (objectClass === 7) return "보행자";
  if (objectClass === 3) return "버스";
  if (objectClass === 2) return "트럭";
  return "차량";
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [serverAlive, setServerAlive] = useState(false);
  const [eventModalEnabled, setEventModalEnabled] = useState(true);
  const [activeEvent, setActiveEvent] = useState(realtimeEvents[0]);
  const [panelMinimized, setPanelMinimized] = useState(false);
  const [latestSnapshot, setLatestSnapshot] = useState(liveSnapshot);
  const modalEnabledRef = useRef(eventModalEnabled);

  useEffect(() => {
    modalEnabledRef.current = eventModalEnabled;
  }, [eventModalEnabled]);

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
  useEffect(() => {
    const ws = new WebSocket(WS_BASE);

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "state" && message.payload) {
          setLatestSnapshot((prev) => ({ ...prev, ...message.payload }));
        }
        if (message.type === "dashboard-event" && modalEnabledRef.current) {
          setActiveEvent({
            id: message.payload?.id || "LIVE-EVENT",
            type: message.payload?.type || "wrong-way-level-1",
            title: message.payload?.title || "실시간 이벤트",
            message: message.payload?.subMessage || message.payload?.message || "실시간 이벤트 수신",
            time: message.payload?.timestamp || "실시간",
            status: "NEW",
          });
        }
      } catch {
        // 화면 수신용 WS이므로 잘못된 메시지는 무시하고 다음 이벤트를 기다린다.
      }
    };

    return () => ws.close();
  }, []);

  const kpis = useMemo(
    () => [
      {
        label: "오늘 통과 차량",
        value: latestSnapshot.normalMovingVehicleCount.toLocaleString(),
        sub: "정주행 누적 기준",
        icon: Car,
        tone: "blue",
      },
      {
        label: "현재 감지 객체",
        value: latestSnapshot.totalObjects,
        sub: `차량 ${latestSnapshot.movingVehicleCount}대`,
        icon: Activity,
        tone: "green",
      },
      {
        label: "역주행 이벤트",
        value: latestSnapshot.wrongWayCount,
        sub: statusLabel(latestSnapshot.status),
        icon: Siren,
        tone: "red",
      },
      {
        label: "보행자 감지",
        value: latestSnapshot.pedestrianCount,
        sub: "회전교차로 내부",
        icon: Users,
        tone: "purple",
      },
      {
        label: "처리 시간",
        value: `${latestSnapshot.processingTimeMs}ms`,
        sub: latestSnapshot.source,
        icon: Gauge,
        tone: "slate",
      },
    ],
    [latestSnapshot],
  );

  const criticalObjects = detectedObjects.filter((item) => item.warningLevel > 0);

  return (
    <div className="ops-page">
      {activeEvent && eventModalEnabled && !panelMinimized && (
        <div className="ops-alert-overlay">
          <section className="ops-alert-panel" aria-label="역주행 경고 상세">
            <div className="ops-alert-head">
              <div>
                <span className="ops-alert-eyebrow">{statusLabel(activeEvent.type)}</span>
                <h2>{activeEvent.title}</h2>
              </div>
              <button type="button" onClick={() => setActiveEvent(null)} aria-label="알림 닫기">
                <X size={18} />
              </button>
            </div>
            <div className="ops-alert-body">
              <div className="ops-video-placeholder danger">
                <Camera size={22} />
                <span>CCTV / 라이다 화면 연결 예정</span>
              </div>
              <p>{activeEvent.message}</p>
              <div className="ops-alert-meta">
                <span>{activeEvent.id}</span>
                <span>{activeEvent.time}</span>
              </div>
            </div>
            <div className="ops-alert-actions">
              <button type="button" onClick={() => setPanelMinimized(true)}>
                최소화
              </button>
              <button type="button" className="primary" onClick={() => navigate("/events")}>
                이벤트 확인
              </button>
            </div>
          </section>
        </div>
      )}

      {panelMinimized && (
        <button className="ops-alert-pill" type="button" onClick={() => setPanelMinimized(false)}>
          <Bell size={16} />
          경고 패널 열기
        </button>
      )}

      <header className="ops-header">
        <div>
          <p className="ops-kicker">월출산휴게소 회전교차로</p>
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
          <button type="button" onClick={() => setEventModalEnabled((value) => !value)}>
            <Bell size={15} />
            알림 {eventModalEnabled ? "ON" : "OFF"}
          </button>
        </div>
      </header>

      <section className="ops-kpi-grid">
        {kpis.map((item) => {
          const Icon = item.icon;
          return (
            <article className={`ops-kpi-card ${item.tone}`} key={item.label}>
              <div className="ops-kpi-icon">
                <Icon size={19} />
              </div>
              <div>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.sub}</small>
              </div>
            </article>
          );
        })}
      </section>

      <section className="ops-dashboard-grid">
        <div className="ops-main-column">
          <article className="ops-card">
            <div className="ops-card-head">
              <div>
                <h2>실시간 현장 화면</h2>
                <p>회전교차로 CCTV와 라이다 객체 위치를 함께 보는 영역</p>
              </div>
              <span className="ops-live-chip">
                <CircleDot size={13} />
                LIVE
              </span>
            </div>
            <div className="ops-visual-grid">
              <div className="ops-cctv-grid">
                <div className="ops-cctv-feed">
                  <span>CAM 01 · 진입로</span>
                </div>
                <div className="ops-cctv-feed">
                  <span>CAM 02 · 차단기</span>
                </div>
              </div>
              <div className="ops-map-view">
                <div className="ops-roundabout">
                  {detectedObjects.map((item, index) => (
                    <span
                      key={item.trackId}
                      className={`ops-map-object ${item.type}`}
                      style={{
                        "--angle": `${index * 63 + 18}deg`,
                        "--distance": `${38 + (index % 2) * 15}%`,
                      }}
                      title={`${item.zoneId} ${item.message}`}
                    />
                  ))}
                </div>
                <div className="ops-map-caption">
                  <MapPin size={14} />
                  Vector Map · Z170/Z261/Z327/Z455/Z469
                </div>
              </div>
            </div>
          </article>

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
              {detectedObjects.map((item) => (
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
          <article className="ops-card danger-card">
            <div className="ops-card-head">
              <div>
                <h2>경고 우선순위</h2>
                <p>현재 조치가 필요한 객체</p>
              </div>
              <Siren size={20} />
            </div>
            {criticalObjects.map((item) => (
              <div className="ops-priority-item" key={item.trackId}>
                <strong>{statusLabel(item.type)}</strong>
                <span>{item.zoneId} · {item.speedKmh.toFixed(1)} km/h</span>
                <button type="button" onClick={() => setActiveEvent(realtimeEvents[0])}>
                  상세 보기
                </button>
              </div>
            ))}
          </article>

          <article className="ops-card">
            <div className="ops-card-head">
              <div>
                <h2>실시간 이벤트</h2>
                <p>최근 수신 순서</p>
              </div>
              <Clock3 size={19} />
            </div>
            <div className="ops-event-feed">
              {realtimeEvents.map((event) => (
                <button
                  type="button"
                  className={`ops-event-item ${event.type}`}
                  key={event.id}
                  onClick={() => setActiveEvent(event)}
                >
                  <span>{event.time}</span>
                  <strong>{event.title}</strong>
                  <small>{event.message}</small>
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
              <span>
                <CheckCircle2 size={16} />
                라이다 PC HTTP 수신 준비
              </span>
              <span>
                <CheckCircle2 size={16} />
                통합제어보드 TCP 연결 확인
              </span>
              <span>
                <CheckCircle2 size={16} />
                PostgreSQL 이벤트 적재
              </span>
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}
