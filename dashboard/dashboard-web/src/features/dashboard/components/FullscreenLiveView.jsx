import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { CctvFeed } from "./CctvFeed";
import { RoundaboutMap } from "./RoundaboutMap";

const CONTROLS_IDLE_MS = 2500;

// 전체현황 "전체 화면" 버튼으로 여는 관제용 전체 화면 뷰다.
// 사이드바·헤더 없이 구역별 CCTV(상단)와 라이다 벡터 맵(하단)만 화면을 꽉 채운다.
// 브라우저 Fullscreen API로 브라우저 UI까지 숨기고, Esc 또는 우상단 X로 닫는다.
// 마우스를 움직이지 않으면 X 버튼과 커서를 잠시 뒤 숨긴다.
export function FullscreenLiveView({ zones, getObjects, onClose }) {
  const [controlsVisible, setControlsVisible] = useState(true);

  useEffect(() => {
    const rootElement = document.documentElement;
    // 전체 화면 동안에는 뒤쪽 대시보드가 스크롤되지 않도록 막는다.
    rootElement.style.overflow = "hidden";

    if (rootElement.requestFullscreen) {
      rootElement.requestFullscreen().catch(() => {
        // 브라우저가 전체 화면을 거부해도 오버레이만으로 계속 사용할 수 있게 둔다.
      });
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    // 사용자가 브라우저 UI로 전체 화면을 빠져나가면 오버레이도 함께 닫는다.
    function handleFullscreenChange() {
      if (!document.fullscreenElement) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      rootElement.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [onClose]);

  useEffect(() => {
    let idleTimer;

    function markActive() {
      setControlsVisible(true);
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => setControlsVisible(false), CONTROLS_IDLE_MS);
    }

    markActive();
    window.addEventListener("mousemove", markActive);

    return () => {
      window.clearTimeout(idleTimer);
      window.removeEventListener("mousemove", markActive);
    };
  }, []);

  return createPortal(
    <div
      className={`fs-live ${controlsVisible ? "" : "is-idle"}`}
      role="dialog"
      aria-modal="true"
      aria-label="실시간 현장 화면 전체 보기"
    >
      <button type="button" className="fs-live-close" onClick={onClose} aria-label="전체 화면 닫기">
        <X size={22} />
      </button>

      <div className="fs-live-grid">
        {zones.map((zone) => (
          <section className="fs-live-zone" key={zone.id}>
            <span className="fs-live-zone-label">{zone.name}</span>
            <div className="fs-live-cctv">
              {zone.cameras.map((camera) => (
                <CctvFeed key={camera.id} camera={camera} expandable={false} />
              ))}
            </div>
            <div className="fs-live-map">
              <RoundaboutMap zone={zone} objects={getObjects(zone.id)} expandable={false} />
            </div>
          </section>
        ))}
      </div>
    </div>,
    document.body,
  );
}
