// 최고관리자에게만 보이는 계정 통계 KPI. 값은 부모(SettingsPage)에서 계산해 전달한다.
export function UserKpiCards({ show, totalCount, activeCount, inactiveCount }) {
  if (!show) {
    return null;
  }

  return (
    <section className="ops-kpi-grid settings-kpis">
      <article className="ops-kpi-card blue">
        <div>
          <span>전체 관리자 계정 수</span>
          <strong>{totalCount}</strong>
        </div>
      </article>

      <article className="ops-kpi-card green">
        <div>
          <span>활성 계정</span>
          <strong>{activeCount}</strong>
        </div>
      </article>

      <article className="ops-kpi-card slate">
        <div>
          <span>비활성 계정</span>
          <strong>{inactiveCount}</strong>
        </div>
      </article>
    </section>
  );
}
