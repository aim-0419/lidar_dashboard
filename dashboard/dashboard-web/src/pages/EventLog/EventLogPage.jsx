import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Filter, Search, Siren } from "lucide-react";
import { getEventHistory } from "../../features/events/eventsApi";
import "../Dashboard/dashboard.css";
import "./eventLog.css";

const filters = [
  { label: "전체", value: "all" },
  { label: "역주행", value: "wrong-way" },
  { label: "보행자", value: "pedestrian" },
  { label: "종료", value: "situation-ended" },
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

export default function EventLogPage() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [status, setStatus] = useState("");
  const [externalZoneId, setExternalZoneId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

    async function loadEvents() {
      setLoading(true);
      setError("");
      try {
        const data = await getEventHistory({
          page,
          limit: 20,
          eventType: activeFilter === "all" ? "" : activeFilter,
          status,
          externalZoneId: externalZoneId.trim(),
          search: debouncedQuery,
          from: toDateBoundary(fromDate),
          to: toDateBoundary(toDate, true),
        }, { signal: controller.signal });

        setItems(data.items);
        setPagination(data.pagination);
        setSelectedId((current) => (
          data.items.some((event) => event.id === current) ? current : data.items[0]?.id || null
        ));
      } catch (requestError) {
        if (requestError.name !== "AbortError") {
          setError(requestError.message || "이벤트 이력을 불러오지 못했습니다.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadEvents();
    return () => controller.abort();
  }, [activeFilter, debouncedQuery, externalZoneId, fromDate, page, status, toDate]);

  const selected = useMemo(
    () => items.find((event) => event.id === selectedId) || items[0],
    [items, selectedId],
  );

  function changeFilter(value) {
    setActiveFilter(value);
    setPage(1);
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
            placeholder="이벤트 ID, 구역, track_id 검색"
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
          <span>외부 구역 ID</span>
          <input value={externalZoneId} onChange={(event) => { setExternalZoneId(event.target.value); setPage(1); }} placeholder="예: Z455" />
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
                <th>발생 시간</th>
                <th>유형</th>
                <th>구역</th>
                <th>track_id</th>
                <th>속도</th>
                <th>상태</th>
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
                  <h2>상세 정보</h2>
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
                  <dd>{selected.trackId}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="event-empty">조회된 이벤트가 없습니다.</p>
          )}
        </aside>
      </section>
    </div>
  );
}
