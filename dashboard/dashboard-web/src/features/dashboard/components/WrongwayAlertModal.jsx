import { ArrowUpDown, Megaphone, Minus, Monitor, OctagonX, Siren, X } from "lucide-react";

// 역주행 감지 시에만 표시하는 경보 대응 패널이다.
// 통합제어보드/CCTV 연동은 규격 확정 전이라 화면만 구성하고 조작 버튼은 비활성으로 둔다.
// event, onClose, onMinimize만 받는 표시 전용 컴포넌트다.
export function WrongwayAlertModal({ event, onClose, onMinimize }) {
  if (!event) {
    return null;
  }

  const zoneLabel = event.zoneId || "구역 미상";
  const trackLabel = event.trackId ? `Track ${event.trackId}` : "Track -";
  const timeLabel = event.time || "실시간";

  return (
    <div className="ops-alert-overlay" role="dialog" aria-modal="true" aria-label="역주행 경고">
      <section className="rw-alert">
        <header className="rw-alert-head">
          <div className="rw-alert-head-main">
            <Siren size={20} />
            <div>
              <strong>역주행 감지 · 대응 필요</strong>
              <span>{zoneLabel} · {trackLabel} · {timeLabel}</span>
            </div>
          </div>
          <div className="rw-alert-head-actions">
            <span className="rw-alert-badge">
              <span className="rw-dot" />진행 중
            </span>
            <button type="button" className="rw-alert-min" onClick={onMinimize}>
              <Minus size={13} />최소화
            </button>
            <button type="button" className="rw-alert-close" onClick={onClose} aria-label="경고 닫기">
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="rw-alert-strip">
          <span className="rw-alert-strip-label">활성 역주행</span>
          <div className="rw-alert-strip-tabs">
            <div className="rw-alert-strip-tab active">
              <span className="rw-dot" />
              <div>
                <strong>{zoneLabel} · {trackLabel}</strong>
                <span>{timeLabel}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rw-alert-body">
          <div className="rw-alert-col rw-alert-col-left">
            <div className="rw-alert-cctv">
              <span className="rw-alert-cctv-badge">
                <span className="rw-dot" />CCTV · {zoneLabel}
              </span>
              <span className="rw-alert-cctv-note">영상 연동 예정</span>
            </div>

            <div className="rw-alert-map">
              <span className="rw-alert-map-label">회전교차로 위치</span>
              <div className="rw-alert-map-ring" />
              <div className="rw-alert-map-dot" />
            </div>

            <div className="rw-alert-log">
              <div className="rw-alert-log-head">
                <span>통합제어보드 자동 조치 로그</span>
                <span className="rw-alert-tag muted">연동 예정</span>
              </div>
              <div className="rw-alert-log-list">
                <div className="rw-alert-log-row">
                  <span>{event.message || "역주행 감지 수신"}</span>
                  <span>{timeLabel}</span>
                </div>
                <div className="rw-alert-log-row">
                  <span>스피커 자동 경고 방송</span>
                  <span>연동 예정</span>
                </div>
                <div className="rw-alert-log-row">
                  <span>전광판 경고 문구 게시</span>
                  <span>연동 예정</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rw-alert-col rw-alert-col-right">
            <span className="rw-alert-col-label">수동 제어 · 통합제어보드 연동 예정</span>

            <div className="rw-alert-controls">
              <div className="rw-alert-control">
                <div className="rw-alert-control-head">
                  <span><ArrowUpDown size={14} />차단기</span>
                  <span className="rw-alert-tag muted">상태 미상</span>
                </div>
                <div className="rw-alert-control-btns">
                  <button type="button" disabled>열기</button>
                  <button type="button" className="danger" disabled>즉시 닫기</button>
                </div>
              </div>

              <div className="rw-alert-control">
                <div className="rw-alert-control-head">
                  <span><Monitor size={14} />전광판</span>
                  <span className="rw-alert-tag muted">연동 예정</span>
                </div>
                <div className="rw-alert-control-btns">
                  <button type="button" disabled>문구 변경</button>
                </div>
              </div>

              <div className="rw-alert-control">
                <div className="rw-alert-control-head">
                  <span><Megaphone size={14} />스피커</span>
                  <span className="rw-alert-tag muted">연동 예정</span>
                </div>
                <div className="rw-alert-control-btns">
                  <button type="button" disabled>재방송</button>
                  <button type="button" disabled>방송 중지</button>
                </div>
              </div>
            </div>

            <div className="rw-alert-resolve">
              <span className="rw-alert-col-label">상황 처리</span>
              <div className="rw-alert-resolve-btns">
                <button type="button" disabled>오탐 처리</button>
                <button type="button" className="dark" disabled>
                  <OctagonX size={14} />상황 종료 · 리셋
                </button>
              </div>
              <p>
                통합제어보드 연동과 상황 처리 기능은 제어 프로토콜 확정 후 연결됩니다.
                지금은 화면 구성만 표시합니다.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
