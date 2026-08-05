import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Filter, Search, Siren } from "lucide-react";
import { eventHistory } from "../../shared/constants/operationsDashboardData";
import "../Dashboard/dashboard.css";
import "./eventLog.css";

const filters = [
  { label: "전체", value: "all" },
  { label: "역주행", value: "wrong-way" },
  { label: "보행자", value: "pedestrian" },
  { label: "종료", value: "ended" },
];

function matchesFilter(event, filter) {
  if (filter === "all") return true;
  if (filter === "wrong-way") return event.type.startsWith("wrong-way");
  if (filter === "pedestrian") return event.type.startsWith("pedestrian");
  if (filter === "ended") return event.type === "situation-ended";
  return true;
}

function statusText(status) {
  if (status === "NEW") return "신규";
  if (status === "MONITORING") return "확인 중";
  if (status === "CLOSED") return "종료";
  if (status === "DONE") return "처리 완료";
  return status;
}

export default function EventLogPage() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(eventHistory[0]?.id);

  const filteredEvents = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return eventHistory.filter((event) => {
      const textMatched = !keyword
        || event.id.toLowerCase().includes(keyword)
        || event.zoneId.toLowerCase().includes(keyword)
        || event.message.toLowerCase().includes(keyword)
        || event.trackId.toLowerCase().includes(keyword);

      return textMatched && matchesFilter(event, activeFilter);
    });
  }, [activeFilter, query]);

  const selected = eventHistory.find((event) => event.id === selectedId) || filteredEvents[0];

  return (
    <div className="ops-page event-page">
      <header className="ops-header">
        <div>
          <p className="ops-kicker">Event History</p>
          <h1>이벤트 이력</h1>
          <p className="ops-subtitle">역주행, 보행자, 상황 종료 이벤트를 시간순으로 검토</p>
        </div>
        <button className="event-export-button" type="button">
          <Download size={15} />
          CSV 내보내기
        </button>
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
              onClick={() => setActiveFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
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
              {filteredEvents.map((event) => (
                <tr
                  key={event.id}
                  className={selected?.id === event.id ? "selected" : ""}
                  onClick={() => setSelectedId(event.id)}
                >
                  <td>{event.occurredAt}</td>
                  <td>
                    <span className={`event-type-badge ${event.type}`}>{event.message}</span>
                  </td>
                  <td>{event.zoneId}</td>
                  <td>{event.trackId}</td>
                  <td>{event.speedKmh.toFixed(1)} km/h</td>
                  <td>{statusText(event.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>

        <aside className="ops-card event-detail">
          {selected ? (
            <>
              <div className="ops-card-head">
                <div>
                  <h2>상세 정보</h2>
                  <p>{selected.id}</p>
                </div>
                {selected.type.startsWith("wrong-way") ? <Siren size={20} /> : <CheckCircle2 size={20} />}
              </div>
              <div className={`event-thumbnail ${selected.type}`}>
                <AlertTriangle size={28} />
                <span>현장 영상 연결 예정</span>
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
                  <dd>{selected.zoneId}</dd>
                </div>
                <div>
                  <dt>객체 ID</dt>
                  <dd>{selected.trackId}</dd>
                </div>
              </dl>
              <div className="event-detail-actions">
                <button type="button">오탐 처리</button>
                <button type="button" className="primary">처리 완료</button>
              </div>
            </>
          ) : (
            <p className="event-empty">조회된 이벤트가 없습니다.</p>
          )}
        </aside>
      </section>
    </div>
  );
}
