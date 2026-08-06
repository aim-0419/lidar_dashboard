import { CircleDot, MapPin } from "lucide-react";

// 구역명, CCTV 목록, Lanelet 코드와 객체를 한 화면 단위로 묶어 표시한다.
export function ZoneLiveView({ zone, objects, isOverview, onSelectZone }) {
  return (
    <article className="ops-card ops-zone-live-view">
      <div className="ops-card-head">
        <div>
          <h2>{zone.name} 실시간 현장 화면</h2>
          <p>{zone.name} CCTV와 라이다 객체 위치</p>
        </div>
        <div className="ops-zone-live-actions">
          <span className="ops-live-chip">
            <CircleDot size={13} />
            LIVE
          </span>
          {isOverview && (
            <button type="button" onClick={() => onSelectZone(zone.id)}>
              구역 상세
            </button>
          )}
        </div>
      </div>

      <div className="ops-visual-grid">
        <div className={`ops-cctv-grid ${zone.cameras.length === 1 ? "single" : ""}`}>
          {zone.cameras.map((camera) => (
            <div className="ops-cctv-feed" key={camera.id}>
              <span>{camera.label} · {camera.location}</span>
              <small className={camera.status}>
                {camera.status === "online" ? "연결 대기" : "오프라인"}
              </small>
            </div>
          ))}
        </div>

        <div className="ops-map-view">
          <div className="ops-roundabout">
            {objects.map((item, index) => (
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
            {zone.name} Vector Map · {zone.laneletZoneIds.join("/")}
          </div>
        </div>
      </div>
    </article>
  );
}
