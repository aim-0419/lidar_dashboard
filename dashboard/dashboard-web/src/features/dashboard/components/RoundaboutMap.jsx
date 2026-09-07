import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, MapPin, X } from "lucide-react";

// 회전교차로 라이다 벡터 맵. 확대 버튼을 누르면 전체화면 오버레이로 맵만 크게 보여준다.
// expandable=false면 개별 확대 버튼을 숨긴다 (이미 전체 화면 안에 있을 때 사용).
export function RoundaboutMap({ zone, objects, expandable = true }) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setExpanded(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expanded]);

  const roundabout = (
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
  );

  const caption = (
    <div className="ops-map-caption">
      <MapPin size={14} />
      {zone.name} Vector Map · {zone.laneletZoneIds.join("/")}
    </div>
  );

  return (
    <>
      <div className="ops-map-view">
        {roundabout}
        {caption}
        {expandable && (
          <button
            type="button"
            className="live-expand-btn"
            onClick={() => setExpanded(true)}
            aria-label={`${zone.name} 벡터 맵 전체화면으로 보기`}
          >
            <Maximize2 size={15} />
          </button>
        )}
      </div>

      {expandable &&
        expanded &&
        createPortal(
          <div
            className="live-expand-overlay"
            role="dialog"
            aria-modal="true"
            aria-label={`${zone.name} 벡터 맵 전체화면`}
          >
            <button
              type="button"
              className="live-expand-close"
              onClick={() => setExpanded(false)}
              aria-label="닫기"
            >
              <X size={20} />
            </button>
            <div className="ops-map-view live-expand-map">
              {roundabout}
              {caption}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
