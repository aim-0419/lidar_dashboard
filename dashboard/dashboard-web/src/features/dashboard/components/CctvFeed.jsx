import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";

// 단일 CCTV 피드. 확대 버튼을 누르면 전체화면 오버레이로 해당 피드만 크게 보여준다.
// 현재 영상은 placeholder이며 실제 스트림 연결은 후속 범위다.
// expandable=false면 개별 확대 버튼을 숨긴다 (이미 전체 화면 안에 있을 때 사용).
export function CctvFeed({ camera, expandable = true }) {
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

  const label = `${camera.label} · ${camera.location}`;
  const statusText = camera.status === "online" ? "연결 대기" : "오프라인";

  const feedContent = (
    <>
      <span>{label}</span>
      <small className={camera.status}>{statusText}</small>
    </>
  );

  return (
    <>
      <div className="ops-cctv-feed">
        {feedContent}
        {expandable && (
          <button
            type="button"
            className="live-expand-btn"
            onClick={() => setExpanded(true)}
            aria-label={`${camera.label} 전체화면으로 보기`}
          >
            <Maximize2 size={15} />
          </button>
        )}
      </div>

      {expandable &&
        expanded &&
        createPortal(
          <div className="live-expand-overlay" role="dialog" aria-modal="true" aria-label={`${camera.label} 전체화면`}>
            <button
              type="button"
              className="live-expand-close"
              onClick={() => setExpanded(false)}
              aria-label="닫기"
            >
              <X size={20} />
            </button>
            <div className="ops-cctv-feed live-expand-cctv">{feedContent}</div>
          </div>,
          document.body,
        )}
    </>
  );
}
