import { RefreshCw, UserCog, UserPlus } from "lucide-react";
import { formatDateTime, getRoleLabel } from "../settingsConstants";

function SettingsNotice({ errorMessage, successMessage }) {
  if (errorMessage) {
    return <div className="settings-banner error">{errorMessage}</div>;
  }

  if (successMessage) {
    return <div className="settings-banner success">{successMessage}</div>;
  }

  return null;
}

// 설정 화면의 본문. 매니저는 본인 계정 카드, 최고관리자는 사용자 관리 + 목록을 본다.
// 상태·로직은 부모(SettingsPage)가 들고, 여기서는 표시와 콜백 호출만 한다.
export function UsersSection({
  isSuperAdmin,
  errorMessage,
  successMessage,
  isDetailLoading,
  selectedUser,
  onOpenManage,
  onOpenCreate,
  onRefresh,
  users,
  isListLoading,
  searchKeyword,
  onSearchKeywordChange,
  onSearchSubmit,
  statusFilter,
  onStatusFilterChange,
  pagination,
  page,
  onPageChange,
}) {
  if (!isSuperAdmin) {
    return (
      <div className="settings-stack">
        <section className="ops-card">
          <div className="ops-card-head">
            <div>
              <h2>내 계정</h2>
              <p>이름, 로그인 ID, 비밀번호를 직접 관리할 수 있습니다.</p>
            </div>
          </div>
          <SettingsNotice errorMessage={errorMessage} successMessage={successMessage} />
        </section>

        <section className="ops-card">
          <div className="ops-card-head">
            <div>
              <h2>내 정보 수정</h2>
              <p>내 계정 정보와 비밀번호를 수정할 수 있습니다.</p>
            </div>
          </div>

          {isDetailLoading ? (
            <div className="settings-empty">내 계정 정보를 불러오는 중입니다.</div>
          ) : !selectedUser ? (
            <div className="settings-empty">내 계정 정보를 확인할 수 없습니다.</div>
          ) : (
            <div className="settings-placeholder-body">
              <UserCog size={18} />
              <span>
                현재 로그인한 계정은 {selectedUser.name} ({selectedUser.userId}) 입니다.
              </span>
              <button
                type="button"
                className="settings-primary-button"
                onClick={() => onOpenManage(selectedUser.id)}
              >
                내 정보 수정
              </button>
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="settings-stack">
      <section className="ops-card">
        <div className="ops-card-head">
          <div>
            <h2>사용자 관리</h2>
          </div>
          <div className="settings-head-actions">
            <button type="button" className="settings-primary-button" onClick={onOpenCreate}>
              <UserPlus size={15} />
              사용자 생성
            </button>
            <button type="button" className="settings-action-button" onClick={onRefresh}>
              <RefreshCw size={15} />
              새로고침
            </button>
          </div>
        </div>
        <SettingsNotice errorMessage={errorMessage} successMessage={successMessage} />
      </section>

      <section className="ops-card">
        <div className="ops-card-head">
          <div>
            <h2>사용자 목록</h2>
            <p>계정을 선택하면 상세 관리 모달이 바로 열립니다.</p>
          </div>
        </div>

        <form className="settings-user-filters" onSubmit={onSearchSubmit}>
          <input
            value={searchKeyword}
            onChange={(event) => onSearchKeywordChange(event.target.value)}
            placeholder="사용자 ID 또는 이름 검색"
          />
          <select value={statusFilter} onChange={onStatusFilterChange}>
            <option value="ALL">전체 상태</option>
            <option value="ACTIVE">활성 계정</option>
            <option value="INACTIVE">비활성 계정</option>
          </select>
          <button type="submit" className="settings-secondary-button">
            검색
          </button>
        </form>

        {isListLoading ? (
          <div className="settings-empty">사용자 목록을 불러오는 중입니다.</div>
        ) : users.length === 0 ? (
          <div className="settings-empty">등록된 사용자가 없습니다.</div>
        ) : (
          <div className="settings-user-list">
            {users.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenManage(item.id)}
                className="settings-user-item"
              >
                <div className="settings-user-item__top">
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.userId}</span>
                  </div>
                  <em>{getRoleLabel(item.role)}</em>
                </div>
                <div className="settings-user-item__meta">
                  <span
                    className={`settings-status-badge ${item.isActive ? "active" : "inactive"}`}
                  >
                    {item.isActive ? "활성" : "비활성"}
                  </span>
                  <span>
                    {item.lastLoginAt
                      ? formatDateTime(item.lastLoginAt, "로그인 이력 없음")
                      : "로그인 이력 없음"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {pagination.totalPages > 1 ? (
          <div className="settings-pagination" aria-label="사용자 목록 페이지 이동">
            <button
              type="button"
              className="settings-action-button"
              onClick={() => onPageChange(page - 1)}
              disabled={isListLoading || page <= 1}
            >
              이전
            </button>
            <span>
              {page} / {pagination.totalPages}
            </span>
            <button
              type="button"
              className="settings-action-button"
              onClick={() => onPageChange(page + 1)}
              disabled={isListLoading || page >= pagination.totalPages}
            >
              다음
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
