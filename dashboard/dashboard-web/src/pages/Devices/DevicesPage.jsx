import { AlertCircle, CheckCircle2, Cpu, Server, Wifi, WifiOff } from "lucide-react";
import { deviceGroups } from "../../shared/constants/operationsDashboardData";
import "../Dashboard/dashboard.css";
import "./devices.css";

function statusLabel(status) {
  if (status === "online") return "정상";
  if (status === "warning") return "주의";
  return "오프라인";
}

export default function DevicesPage() {
  const devices = deviceGroups.flatMap((group) => group.devices);
  const onlineCount = devices.filter((device) => device.status === "online").length;
  const warningCount = devices.filter((device) => device.status === "warning").length;
  const offlineCount = devices.filter((device) => device.status === "offline").length;

  const summary = [
    { label: "정상", value: onlineCount, icon: CheckCircle2, tone: "green" },
    { label: "주의", value: warningCount, icon: AlertCircle, tone: "slate" },
    { label: "오프라인", value: offlineCount, icon: WifiOff, tone: "red" },
    { label: "전체 장비", value: devices.length, icon: Cpu, tone: "blue" },
  ];

  return (
    <div className="ops-page devices-page">
      <header className="ops-header">
        <div>
          <p className="ops-kicker">Devices</p>
          <h1>현장 장비 상태</h1>
          <p className="ops-subtitle">라이다 PC, 통합제어보드, 전광판 등 현장 연동 장비 상태 확인</p>
        </div>
      </header>

      <section className="ops-kpi-grid device-kpis">
        {summary.map((item) => {
          const Icon = item.icon;
          return (
            <article className={`ops-kpi-card ${item.tone}`} key={item.label}>
              <div className="ops-kpi-icon">
                <Icon size={19} />
              </div>
              <div>
                <span>장비 상태</span>
                <strong>{item.value}</strong>
                <small>{item.label}</small>
              </div>
            </article>
          );
        })}
      </section>

      <section className="device-group-list">
        {deviceGroups.map((group) => (
          <article className="ops-card device-zone-card" key={group.zone}>
            <div className="ops-card-head">
              <div>
                <h2>{group.zone}</h2>
                <p>구역별 장비 연결 상태</p>
              </div>
            </div>
            <div className="device-card-grid">
              {group.devices.map((device) => (
                <div className={`device-card ${device.status}`} key={device.name}>
                  <div className="device-icon">
                    <Server size={20} />
                  </div>
                  <div className="device-main">
                    <strong>{device.name}</strong>
                    <span>{device.type}</span>
                  </div>
                  <div className="device-meta">
                    <span>{device.ip}</span>
                    <span>{device.lastSeen}</span>
                  </div>
                  <div className="device-status">
                    {device.status === "online" ? <Wifi size={14} /> : <WifiOff size={14} />}
                    {statusLabel(device.status)} · {device.health}
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
