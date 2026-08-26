import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Braces,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Filter,
  Info,
  Search,
  Siren,
  X,
} from "lucide-react";
import {
  getEventDetail,
  getEventHistory,
  getEventZones,
  updateEventStatus,
} from "../../features/events/eventsApi";
import "../Dashboard/dashboard.css";
import "./eventLog.css";

const filters = [
  { label: "전체", value: "all" },
  { label: "역주행", value: "wrong-way" },
  { label: "보행자", value: "pedestrian" },
  { label: "상황 종료", value: "situation-ended" },
];

function statusText(status) {
  if (status === "NEW") return "신규";
  if (status === "CONFIRMED") return "확인";
  if (status === "RESOLVED") return "처리 완료";
  if (status === "FALSE_ALARM") return "오탐";
  return status;
}

function eventTypeText(type) {
  if (type === "wrong-way" || type === "wrong-way-level-1" || type === "wrong-way-level-2") return "역주행";
  if (type === "situation-ended") return "상황 종료";
  if (type === "pedestrian-entered") return "보행자 진입";
  if (type === "pedestrian-exited") return "보행자 이탈";
  return type;
}

function eventTypeClass(type) {
  return type?.startsWith("wrong-way") ? "wrong-way" : type;
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function toDateBoundary(value, endOfDay = false) {
  if (!value) return "";
  const time = endOfDay ? "23:59:59.999" : "00:00:00.000";
  return new Date(`${value}T${time}+09:00`).toISOString();
}

function todayDateInputValue() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000);
  return localDate.toISOString().slice(0, 10);
}

export default function EventLogPage() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [status, setStatus] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [zones, setZones] = useState([]);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [zonesError, setZonesError] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState(todayDateInputValue);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("occurredAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusDraft, setStatusDraft] = useState("NEW");
  const [statusMemo, setStatusMemo] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [eventDetail, setEventDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [rawPayloadOpen, setRawPayloadOpen] = useState(false);
  const [rawPayloadCopied, setRawPayloadCopied] = useState(false);

  // 입력할 때마다 요청하지 않도록 검색어가 멈춘 뒤 API 필터에 반영한다.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadZones() {
      try {
        setZones(await getEventZones({ signal: controller.signal }));
      } catch {
        // 화면 전환이나 개발 모드 재실행으로 취소된 요청은 실제 조회 오류로 표시하지 않는다.
        if (!controller.signal.aborted) {
          setZonesError(true);
        }
      } finally {
        if (!controller.signal.aborted) setZonesLoading(false);
      }
    }

    loadZones();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadEvents() {
      setLoading(true);
      setError("");
      try {
        const data = await getEventHistory({
          page,
          limit: 20,
          eventType: activeFilter === "all" ? "" : activeFilter,
          status,
          zoneId,
          search: debouncedQuery,
          from: toDateBoundary(fromDate),
          to: toDateBoundary(toDate, true),
          sortBy,
          sortOrder,
        }, { signal: controller.signal });

        setItems(data.items);
        setPagination(data.pagination);
        setSelectedId((current) => (
          data.items.some((event) => event.id === current) ? current : data.items[0]?.id || null
        ));
      } catch (requestError) {
        // 새 필터 요청이 이전 요청을 취소한 경우에는 canceled 메시지를 표에 노출하지 않는다.
        if (!controller.signal.aborted) {
          setError(requestError.message || "이벤트 이력을 불러오지 못했습니다.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadEvents();
    return () => controller.abort();
  }, [activeFilter, debouncedQuery, fromDate, page, sortBy, sortOrder, status, toDate, zoneId]);

  const selected = useMemo(
    () => items.find((event) => event.id === selectedId) || items[0],
    [items, selectedId],
  );

  useEffect(() => {
    if (!selected?.id) {
      setEventDetail(null);
      setDetailError("");
      return undefined;
    }

    const controller = new AbortController();

    async function loadEventDetail() {
      setDetailLoading(true);
      setDetailError("");
      setEventDetail(null);
      setRawPayloadOpen(false);
      setRawPayloadCopied(false);

      try {
        const detail = await getEventDetail(selected.id, { signal: controller.signal });
        if (!controller.signal.aborted) setEventDetail(detail);
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setDetailError(requestError.message || "이벤트 상세 정보를 불러오지 못했습니다.");
        }
      } finally {
        if (!controller.signal.aborted) setDetailLoading(false);
      }
    }

    loadEventDetail();
    return () => controller.abort();
  }, [selected?.id]);

  useEffect(() => {
    if (!rawPayloadOpen) return undefined;

    function closeRawPayload(event) {
      if (event.key === "Escape") setRawPayloadOpen(false);
    }

    window.addEventListener("keydown", closeRawPayload);
    return () => window.removeEventListener("keydown", closeRawPayload);
  }, [rawPayloadOpen]);

  useEffect(() => {
    setStatusDraft(selected?.status || "NEW");
    setStatusMemo("");
    setStatusMessage("");
  }, [selected?.id, selected?.status]);

  function changeFilter(value) {
    setActiveFilter(value);
    setPage(1);
  }

  // 같은 열은 방향을 반전하고, 새로운 열은 오름차순부터 조회한다.
  function changeSort(field) {
    if (sortBy === field) {
      setSortOrder((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setPage(1);
  }

  function sortIcon(field) {
    if (sortBy !== field) return <ArrowUpDown size={13} aria-hidden="true" />;
    return sortOrder === "asc"
      ? <ArrowUp size={13} aria-hidden="true" />
      : <ArrowDown size={13} aria-hidden="true" />;
  }

  function sortableHeader(label, field) {
    const active = sortBy === field;
    const direction = active ? (sortOrder === "asc" ? "오름차순" : "내림차순") : "정렬 없음";

    return (
      <th aria-sort={active ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}>
        <button
          type="button"
          className={`event-sort-button${active ? " active" : ""}`}
          onClick={() => changeSort(field)}
          title={`${label} ${direction}`}
        >
          <span>{label}</span>
          {sortIcon(field)}
        </button>
      </th>
    );
  }

  async function saveEventStatus() {
    if (!selected || statusSaving) return;

    setStatusSaving(true);
    setStatusMessage("");
    try {
      const result = await updateEventStatus(selected.id, {
        status: statusDraft,
        memo: statusMemo,
      });
      setItems((current) => current.map((item) => (
        item.id === selected.id ? result.event : item
      )));
      setEventDetail((current) => (
        current?.id === selected.id ? { ...current, status: result.event.status } : current
      ));
      setStatusMessage(result.changed ? "상태를 변경했습니다." : "이미 같은 상태입니다.");
    } catch (requestError) {
      setStatusMessage(requestError.message || "상태를 변경하지 못했습니다.");
    } finally {
      setStatusSaving(false);
    }
  }

  async function copyRawPayload() {
    if (!eventDetail?.rawPayload) return;

    try {
      await navigator.clipboard.writeText(JSON.stringify(eventDetail.rawPayload, null, 2));
      setRawPayloadCopied(true);
    } catch {
      setRawPayloadCopied(false);
    }
  }

  return (
    <div className="ops-page event-page">
      <header className="ops-header">
        <div>
          <p className="ops-kicker">Event History</p>
          <h1>이벤트 이력</h1>
          <p className="ops-subtitle">역주행, 보행자, 상황 종료 이벤트를 시간순으로 검토</p>
        </div>
        <div className="event-total">총 {pagination.total.toLocaleString()}건</div>
      </header>

      <section className="event-toolbar ops-card">
        <div className="event-search">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="이벤트 ID, 구역명/코드, track_id, 메시지 검색"
          />
        </div>
        <div className="event-filter-group" aria-label="이벤트 필터">
          <Filter size={15} />
          {filters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={activeFilter === filter.value ? "active" : ""}
              onClick={() => changeFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </section>

      <section className="event-advanced-filters" aria-label="상세 필터">
        <label>
          <span>상태</span>
          <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
            <option value="">전체</option>
            <option value="NEW">신규</option>
            <option value="CONFIRMED">확인</option>
            <option value="RESOLVED">처리 완료</option>
            <option value="FALSE_ALARM">오탐</option>
          </select>
        </label>
        <label>
          <span>구역</span>
          <select
            value={zoneId}
            disabled={zonesLoading}
            onChange={(event) => { setZoneId(event.target.value); setPage(1); }}
          >
            <option value="">
              {zonesLoading ? "구역 불러오는 중" : zonesError ? "구역 조회 실패" : "전체 구역"}
            </option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.site?.name ? `${zone.site.name} - ` : ""}{zone.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>시작일</span>
          <input type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPage(1); }} />
        </label>
        <label>
          <span>종료일</span>
          <input type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setPage(1); }} />
        </label>
      </section>

      <section className="event-layout">
        <article className="ops-card event-table-card">
          <table className="event-table">
            <thead>
              <tr>
                {sortableHeader("발생 시간", "occurredAt")}
                {sortableHeader("유형", "eventType")}
                {sortableHeader("구역", "zone")}
                {sortableHeader("track_id", "trackId")}
                {sortableHeader("속도", "speedKmh")}
                {sortableHeader("상태", "status")}
              </tr>
            </thead>
            <tbody>
              {items.map((event) => (
                <tr
                  key={event.id}
                  className={selected?.id === event.id ? "selected" : ""}
                  onClick={() => setSelectedId(event.id)}
                >
                  <td>{formatDateTime(event.occurredAt || event.receivedAt)}</td>
                  <td>
                    <span className={`event-type-badge ${eventTypeClass(event.eventType)}`}>{eventTypeText(event.eventType)}</span>
                  </td>
                  <td>{event.zone?.name || event.externalZoneId || "-"}</td>
                  <td>{event.trackId || "-"}</td>
                  <td>{event.speedKmh == null ? "-" : `${event.speedKmh.toFixed(1)} km/h`}</td>
                  <td>{statusText(event.status)}</td>
                </tr>
              ))}
              {!loading && !error && items.length === 0 && (
                <tr><td colSpan="6" className="event-table-message">조회된 이벤트가 없습니다.</td></tr>
              )}
              {loading && (
                <tr><td colSpan="6" className="event-table-message">이벤트 이력을 불러오는 중입니다.</td></tr>
              )}
              {error && (
                <tr><td colSpan="6" className="event-table-message error">{error}</td></tr>
              )}
            </tbody>
          </table>
          <div className="event-pagination">
            <button type="button" disabled={!pagination.hasPrevious || loading} onClick={() => setPage((value) => value - 1)} aria-label="이전 페이지">
              <ChevronLeft size={16} />
            </button>
            <span>{pagination.totalPages === 0 ? 0 : pagination.page} / {pagination.totalPages}</span>
            <button type="button" disabled={!pagination.hasNext || loading} onClick={() => setPage((value) => value + 1)} aria-label="다음 페이지">
              <ChevronRight size={16} />
            </button>
          </div>
        </article>

        <aside className="ops-card event-detail">
          {selected ? (
            <>
              <div className="ops-card-head">
                <div>
                  <h2>이벤트 상세</h2>
                  <p>{selected.id}</p>
                </div>
                {selected.eventType?.startsWith("wrong-way") ? <Siren size={20} /> : <CheckCircle2 size={20} />}
              </div>
              <div className={`event-thumbnail ${eventTypeClass(selected.eventType)}`}>
                <AlertTriangle size={28} />
                <span>현장 영상 미제공</span>
              </div>
              <dl className="event-detail-list">
                <div>
                  <dt>발생 시간</dt>
                  <dd>{formatDateTime(selected.occurredAt || selected.receivedAt)}</dd>
                </div>
                <div>
                  <dt>메시지</dt>
                  <dd>{selected.message}</dd>
                </div>
                <div>
                  <dt>설명</dt>
                  <dd>{selected.description}</dd>
                </div>
                <div>
                  <dt>구역</dt>
                  <dd>{selected.zone?.name || "-"} ({selected.externalZoneId || "-"})</dd>
                </div>
                <div>
                  <dt>객체 ID</dt>
                  <dd>{selected.trackId || "-"}</dd>
                </div>
                <div>
                  <dt>속도 / 신뢰도</dt>
                  <dd>
                    {selected.speedKmh == null ? "-" : `${selected.speedKmh.toFixed(1)} km/h`}
                    {selected.confidence == null ? "" : ` · ${(selected.confidence * 100).toFixed(1)}%`}
                  </dd>
                </div>
              </dl>
              {detailLoading && <p className="event-detail-notice">추가 정보를 불러오는 중입니다.</p>}
              {detailError && <p className="event-detail-notice error">{detailError}</p>}
              {eventDetail && (
                <>
                  <details className="event-diagnostic-details">
                    <summary>
                      <Info size={15} aria-hidden="true" />
                      추가 진단 정보
                    </summary>
                    <dl className="event-detail-list compact">
                      <div>
                        <dt>서버 수신 시간</dt>
                        <dd>{formatDateTime(eventDetail.receivedAt)}</dd>
                      </div>
                      <div>
                        <dt>현장 / 라이다 PC</dt>
                        <dd>
                          {eventDetail.zone?.site?.name || "-"} · {eventDetail.device?.name || eventDetail.device?.code || "-"}
                        </dd>
                      </div>
                      <div>
                        <dt>외부 구역 / 객체 종류</dt>
                        <dd>{eventDetail.externalZoneId || "-"} · {eventDetail.objectClass ?? "-"}</dd>
                      </div>
                      <div>
                        <dt>경고 단계 / 이벤트 ID</dt>
                        <dd>{eventDetail.warningLevel ?? "-"} · {eventDetail.id}</dd>
                      </div>
                    </dl>
                  </details>
                  <button
                    type="button"
                    className="event-raw-button"
                    onClick={() => setRawPayloadOpen(true)}
                    disabled={!eventDetail.rawPayload}
                  >
                    <Braces size={15} aria-hidden="true" />
                    원본 데이터 보기
                  </button>
                </>
              )}
              <div className="event-status-editor">
                <label>
                  <span>관리 상태</span>
                  <select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value)}>
                    <option value="NEW">신규</option>
                    <option value="CONFIRMED">확인</option>
                    <option value="RESOLVED">처리 완료</option>
                    <option value="FALSE_ALARM">오탐</option>
                  </select>
                </label>
                <label>
                  <span>변경 사유</span>
                  <textarea
                    value={statusMemo}
                    onChange={(event) => setStatusMemo(event.target.value)}
                    placeholder="확인 내용 또는 변경 사유"
                    rows="3"
                  />
                </label>
                <button type="button" onClick={saveEventStatus} disabled={statusSaving}>
                  {statusSaving ? "저장 중" : "상태 저장"}
                </button>
                {statusMessage && <p className="event-status-message">{statusMessage}</p>}
              </div>
            </>
          ) : (
            <p className="event-empty">조회된 이벤트가 없습니다.</p>
          )}
        </aside>
      </section>
      {rawPayloadOpen && eventDetail?.rawPayload && (
        <div className="event-raw-backdrop" role="presentation" onMouseDown={() => setRawPayloadOpen(false)}>
          <section
            className="event-raw-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-raw-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p>연동 진단 정보</p>
                <h2 id="event-raw-title">라이다 원본 데이터</h2>
              </div>
              <button type="button" onClick={() => setRawPayloadOpen(false)} aria-label="원본 데이터 닫기">
                <X size={18} />
              </button>
            </header>
            <div className="event-raw-meta">
              <span>{eventDetail.id}</span>
              <button type="button" onClick={copyRawPayload}>
                <Copy size={15} aria-hidden="true" />
                {rawPayloadCopied ? "복사됨" : "JSON 복사"}
              </button>
            </div>
            <pre>{JSON.stringify(eventDetail.rawPayload, null, 2)}</pre>
          </section>
        </div>
      )}
    </div>
  );
}
