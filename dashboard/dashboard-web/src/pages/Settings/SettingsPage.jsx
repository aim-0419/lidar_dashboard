import { useEffect, useMemo, useState } from "react";
import {
  CircleHelp,
  KeyRound,
  RefreshCw,
  Shield,
  UserCog,
  UserPlus,
  UserX,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  createUserRequest,
  deactivateUserRequest,
  fetchUserDetail,
  fetchUsers,
  updateUserPasswordRequest,
  updateUserRequest,
} from "../../shared/api/http";
import "../Dashboard/dashboard.css";
import "./settings.css";

const initialCreateForm = {
  userId: "",
  name: "",
  password: "",
  role: "SUPER_ADMIN",
  isActive: true,
};

const initialEditForm = {
  userId: "",
  name: "",
  role: "SUPER_ADMIN",
  isActive: true,
};

const initialPasswordForm = {
  password: "",
};

const ROLE_LABELS = {
  SUPER_ADMIN: "최고 관리자",
};

function formatDateTime(value, fallback = "-") {
  if (!value) {
    return fallback;
  }

  const nextDate = new Date(value);
  if (Number.isNaN(nextDate.getTime())) {
    return fallback;
  }

  return nextDate.toLocaleString();
}

function getRoleLabel(role) {
  if (!role) {
    return "선택 없음";
  }

  const normalizedRole = String(role).toUpperCase();
  return ROLE_LABELS[normalizedRole] || normalizedRole;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isActivateConfirmOpen, setIsActivateConfirmOpen] = useState(false);
  const [isDeactivateConfirmOpen, setIsDeactivateConfirmOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [editForm, setEditForm] = useState(initialEditForm);
  const [passwordForm, setPasswordForm] = useState(initialPasswordForm);
  const [isListLoading, setIsListLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [createErrorMessage, setCreateErrorMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const isSuperAdmin = user?.role === "super_admin";

  const activeUserCount = users.filter((item) => item.isActive).length;
  const inactiveUserCount = users.filter((item) => !item.isActive).length;

  useEffect(() => {
    if (!isSuperAdmin) {
      return;
    }

    void loadUsers();
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!selectedUserId || !isSuperAdmin) {
      return;
    }

    void loadUserDetail(selectedUserId);
  }, [isSuperAdmin, selectedUserId]);

  async function loadUsers(nextSelectedUserId) {
    setIsListLoading(true);
    setErrorMessage("");

    try {
      const response = await fetchUsers();
      const nextUsers = response.users || [];
      setUsers(nextUsers);

      const preferredId = nextSelectedUserId || selectedUserId;
      const selectedExists = nextUsers.some((item) => item.id === preferredId);
      const fallbackId = nextUsers[0]?.id || "";
      setSelectedUserId(selectedExists ? preferredId : fallbackId);
    } catch (error) {
      setErrorMessage(error.message || "사용자 목록을 불러오지 못했습니다.");
    } finally {
      setIsListLoading(false);
    }
  }

  async function loadUserDetail(id) {
    if (!id) {
      setSelectedUser(null);
      setEditForm(initialEditForm);
      return;
    }

    setIsDetailLoading(true);
    setErrorMessage("");

    try {
      const response = await fetchUserDetail(id);
      const nextUser = response.user;
      setSelectedUser(nextUser);
      setEditForm({
        userId: nextUser.userId || "",
        name: nextUser.name || "",
        role: String(nextUser.role || "super_admin").toUpperCase(),
        isActive: Boolean(nextUser.isActive),
      });
      setPasswordForm(initialPasswordForm);
    } catch (error) {
      setSelectedUser(null);
      setErrorMessage(error.message || "사용자 상세 정보를 불러오지 못했습니다.");
    } finally {
      setIsDetailLoading(false);
    }
  }

  function handleCreateChange(event) {
    const { name, value, type, checked } = event.target;
    setCreateErrorMessage("");
    setCreateForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function handleEditChange(event) {
    const { name, value, type, checked } = event.target;
    setEditForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function handlePasswordChange(event) {
    const { name, value } = event.target;
    setPasswordForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleCreateUser(event) {
    event.preventDefault();
    const nextUserId = createForm.userId.trim();
    const nextName = createForm.name.trim();
    const nextPassword = createForm.password.trim();

    if (!nextUserId || !nextName || !nextPassword) {
      setCreateErrorMessage("사용자 ID, 이름, 비밀번호를 모두 입력해 주세요.");
      return;
    }

    setIsCreating(true);
    setCreateErrorMessage("");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await createUserRequest({
        userId: nextUserId,
        name: nextName,
        password: nextPassword,
        role: createForm.role,
        isActive: createForm.isActive,
      });

      setCreateForm(initialCreateForm);
      setSuccessMessage("사용자를 생성했습니다.");
      setIsCreateModalOpen(false);
      await loadUsers(response.user?.id);
      if (response.user?.id) {
        await loadUserDetail(response.user.id);
      }
    } catch (error) {
      setCreateErrorMessage(error.message || "필수 입력값을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleUpdateUser(event) {
    event.preventDefault();
    if (!selectedUserId) {
      return;
    }

    setIsUpdating(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await updateUserRequest(selectedUserId, {
        userId: editForm.userId.trim(),
        name: editForm.name.trim(),
        role: editForm.role,
        isActive: editForm.isActive,
      });

      setSuccessMessage("사용자 정보를 수정했습니다.");
      await loadUsers(response.user?.id || selectedUserId);
      await loadUserDetail(response.user?.id || selectedUserId);
    } catch (error) {
      setErrorMessage(error.message || "사용자 정보를 수정하지 못했습니다.");
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleUpdatePassword(event) {
    event.preventDefault();
    if (!selectedUserId) {
      return;
    }

    setIsChangingPassword(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await updateUserPasswordRequest(selectedUserId, {
        password: passwordForm.password,
      });
      setPasswordForm(initialPasswordForm);
      setSuccessMessage("사용자 비밀번호를 변경했습니다.");
      await loadUserDetail(selectedUserId);
    } catch (error) {
      setErrorMessage(error.message || "사용자 비밀번호를 변경하지 못했습니다.");
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleDeactivateUser() {
    if (!selectedUserId || !selectedUser) {
      return;
    }

    setIsDeactivating(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await deactivateUserRequest(selectedUserId);
      setSuccessMessage("사용자를 비활성화했습니다.");
      setIsDeactivateConfirmOpen(false);
      await loadUsers(response.user?.id || selectedUserId);
      await loadUserDetail(response.user?.id || selectedUserId);
    } catch (error) {
      setErrorMessage(error.message || "사용자를 비활성화하지 못했습니다.");
    } finally {
      setIsDeactivating(false);
    }
  }

  async function handleActivateUser() {
    if (!selectedUserId || !selectedUser) {
      return;
    }

    setIsActivating(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await updateUserRequest(selectedUserId, {
        isActive: true,
      });

      setSuccessMessage("사용자를 활성화했습니다.");
      setIsActivateConfirmOpen(false);
      await loadUsers(response.user?.id || selectedUserId);
      await loadUserDetail(response.user?.id || selectedUserId);
    } catch (error) {
      setErrorMessage(error.message || "사용자를 활성화하지 못했습니다.");
    } finally {
      setIsActivating(false);
    }
  }

  function renderNotice() {
    if (errorMessage) {
      return <div className="settings-banner error">{errorMessage}</div>;
    }

    if (successMessage) {
      return <div className="settings-banner success">{successMessage}</div>;
    }

    return null;
  }

  function openCreateModal() {
    setCreateForm(initialCreateForm);
    setCreateErrorMessage("");
    setErrorMessage("");
    setSuccessMessage("");
    setIsCreateModalOpen(true);
  }

  function openManageModal() {
    if (!selectedUserId) {
      setErrorMessage("먼저 사용자 목록에서 계정을 선택해 주세요.");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsManageModalOpen(true);
  }

  function closeCreateModal() {
    if (isCreating) {
      return;
    }

    setCreateErrorMessage("");
    setIsCreateModalOpen(false);
  }

  function closeManageModal() {
    if (isUpdating || isChangingPassword || isActivating || isDeactivating) {
      return;
    }

    setIsManageModalOpen(false);
    setIsActivateConfirmOpen(false);
    setIsDeactivateConfirmOpen(false);
  }

  function openActivateConfirmModal() {
    if (selectedUser?.isActive || isActivating || isDeactivating) {
      return;
    }

    setIsActivateConfirmOpen(true);
  }

  function closeActivateConfirmModal() {
    if (isActivating || isDeactivating) {
      return;
    }

    setIsActivateConfirmOpen(false);
  }

  function openDeactivateConfirmModal() {
    if (!selectedUser?.isActive || isActivating || isDeactivating) {
      return;
    }

    setIsDeactivateConfirmOpen(true);
  }

  function closeDeactivateConfirmModal() {
    if (isActivating || isDeactivating) {
      return;
    }

    setIsDeactivateConfirmOpen(false);
  }

  function renderCreateModal() {
    if (!isCreateModalOpen) {
      return null;
    }

    return (
      <div className="settings-modal-overlay" onClick={closeCreateModal}>
        <div className="settings-modal" onClick={(event) => event.stopPropagation()}>
          <div className="settings-modal__head">
            <div>
              <h2>사용자 생성</h2>
              <p>새 관리자 계정을 등록합니다.</p>
            </div>
            <button type="button" className="settings-modal__close" onClick={closeCreateModal}>
              닫기
            </button>
          </div>

          <form className="settings-form-stack" onSubmit={handleCreateUser}>
            {createErrorMessage ? (
              <div className="settings-banner error settings-modal-banner">{createErrorMessage}</div>
            ) : null}

            <div className="settings-form-grid">
              <label className="settings-field">
                <span>사용자 ID</span>
                <input
                  name="userId"
                  value={createForm.userId}
                  onChange={handleCreateChange}
                  placeholder="manager01"
                />
              </label>
              <label className="settings-field">
                <span>이름</span>
                <input
                  name="name"
                  value={createForm.name}
                  onChange={handleCreateChange}
                  placeholder="manager"
                />
              </label>
            </div>

            <div className="settings-form-grid">
              <label className="settings-field">
                <span>비밀번호</span>
                <input
                  type="password"
                  name="password"
                  value={createForm.password}
                  onChange={handleCreateChange}
                  placeholder="password123"
                />
              </label>
              <label className="settings-field">
                <span>권한</span>
                <select name="role" value={createForm.role} onChange={handleCreateChange}>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                </select>
              </label>
            </div>

            <div className="settings-modal__actions">
              <button type="button" className="settings-secondary-button" onClick={closeCreateModal}>
                취소
              </button>
              <button type="submit" disabled={isCreating} className="settings-primary-button">
                <UserPlus size={15} />
                {isCreating ? "생성 중..." : "사용자 생성"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  function renderManageModal() {
    if (!isManageModalOpen || !selectedUserId) {
      return null;
    }

    return (
      <div className="settings-modal-overlay" onClick={closeManageModal}>
          <div className="settings-modal settings-modal--wide" onClick={(event) => event.stopPropagation()}>
            <div className="settings-modal__head">
              <div>
                <div className="settings-title-row">
                  <h2>사용자 관리</h2>
                  <div className="settings-tooltip">
                    <button
                      type="button"
                      className="settings-tooltip__trigger"
                      aria-label="사용자 관리 설명"
                    >
                      <CircleHelp size={15} />
                    </button>
                    <div className="settings-tooltip__content" role="tooltip">
                      계정 정보 수정, 비밀번호 변경, 계정 비활성화를 할 수 있습니다.
                    </div>
                  </div>
                </div>
              </div>
              <button type="button" className="settings-modal__close" onClick={closeManageModal}>
                닫기
            </button>
          </div>

          {isDetailLoading ? (
            <div className="settings-empty">사용자 상세 정보를 불러오는 중입니다.</div>
          ) : !selectedUser ? (
            <div className="settings-empty">사용자 상세 정보를 확인할 수 없습니다.</div>
          ) : (
            <div className="settings-stack">
              <div className="settings-user-summary">
                <strong>{selectedUser.name}</strong>
                <span>{selectedUser.userId}</span>
                <div className="settings-user-summary__grid">
                  <div>권한: {getRoleLabel(selectedUser.role)}</div>
                  <div>상태: {selectedUser.isActive ? "활성" : "비활성"}</div>
                  <div>생성일: {formatDateTime(selectedUser.createdAt)}</div>
                  <div>마지막 로그인: {formatDateTime(selectedUser.lastLoginAt, "로그인 이력 없음")}</div>
                </div>
              </div>

              <form className="settings-form-stack" onSubmit={handleUpdateUser}>
                <div className="settings-form-grid">
                  <label className="settings-field">
                    <span>사용자 ID</span>
                    <input name="userId" value={editForm.userId} onChange={handleEditChange} />
                  </label>
                  <label className="settings-field">
                    <span>이름</span>
                    <input name="name" value={editForm.name} onChange={handleEditChange} />
                  </label>
                </div>

                <div className="settings-form-grid">
                  <label className="settings-field">
                    <span>권한</span>
                    <select name="role" value={editForm.role} onChange={handleEditChange}>
                      <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                    </select>
                  </label>
                </div>

                <button type="submit" disabled={isUpdating} className="settings-primary-button">
                  {isUpdating ? "저장 중..." : "변경사항 저장"}
                </button>
              </form>

              <form className="settings-form-stack settings-divider" onSubmit={handleUpdatePassword}>
                <label className="settings-field">
                  <span>비밀번호 변경</span>
                  <input
                    type="password"
                    name="password"
                    value={passwordForm.password}
                    onChange={handlePasswordChange}
                    placeholder="newPassword123"
                  />
                </label>

                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="settings-secondary-button"
                >
                  <KeyRound size={15} />
                  {isChangingPassword ? "변경 중..." : "비밀번호 저장"}
                </button>
              </form>

              <div className="settings-divider settings-modal__footer">
                {selectedUser.isActive ? (
                  <button
                    type="button"
                    onClick={openDeactivateConfirmModal}
                    disabled={isActivating || isDeactivating}
                    className="settings-danger-button"
                  >
                    <UserX size={15} />
                    {isDeactivating ? "비활성화 중..." : "사용자 비활성화"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={openActivateConfirmModal}
                    disabled={isActivating || isDeactivating}
                    className="settings-primary-button"
                  >
                    <Shield size={15} />
                    {isActivating ? "활성화 중..." : "사용자 활성화"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderDeactivateConfirmModal() {
    if (!isDeactivateConfirmOpen || !selectedUser) {
      return null;
    }

    return (
      <div className="settings-modal-overlay" onClick={closeDeactivateConfirmModal}>
        <div
          className="settings-modal settings-modal--compact"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="settings-modal__head">
            <div>
              <h2>사용자 비활성화 확인</h2>
              <p>{selectedUser.userId} 계정을 정말 비활성화할까요?</p>
            </div>
            <button
              type="button"
              className="settings-modal__close"
              onClick={closeDeactivateConfirmModal}
            >
              닫기
            </button>
          </div>

          <div className="settings-confirm-copy">
            비활성화된 계정은 로그인할 수 없으며, 필요 시 다시 활성화 절차가 필요합니다.
          </div>

          <div className="settings-modal__actions">
            <button
              type="button"
              className="settings-secondary-button"
              onClick={closeDeactivateConfirmModal}
              disabled={isDeactivating}
            >
              취소
            </button>
            <button
              type="button"
              className="settings-danger-button"
              onClick={() => void handleDeactivateUser()}
              disabled={isDeactivating}
            >
              {isDeactivating ? "비활성화 중..." : "비활성화 진행"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderActivateConfirmModal() {
    if (!isActivateConfirmOpen || !selectedUser) {
      return null;
    }

    return (
      <div className="settings-modal-overlay" onClick={closeActivateConfirmModal}>
        <div
          className="settings-modal settings-modal--compact"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="settings-modal__head">
            <div>
              <h2>사용자 활성화 확인</h2>
              <p>{selectedUser.userId} 계정을 다시 활성화할까요?</p>
            </div>
            <button
              type="button"
              className="settings-modal__close"
              onClick={closeActivateConfirmModal}
            >
              닫기
            </button>
          </div>

          <div className="settings-confirm-copy">
            활성화된 계정은 다시 로그인할 수 있으며, 사용자 목록에서 즉시 활성 상태로 표시됩니다.
          </div>

          <div className="settings-modal__actions">
            <button
              type="button"
              className="settings-secondary-button"
              onClick={closeActivateConfirmModal}
              disabled={isActivating}
            >
              취소
            </button>
            <button
              type="button"
              className="settings-primary-button"
              onClick={() => void handleActivateUser()}
              disabled={isActivating}
            >
              {isActivating ? "활성화 중..." : "활성화 진행"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderUsersSection() {
    if (!isSuperAdmin) {
      return (
        <section className="ops-card settings-placeholder-card">
          <div className="ops-card-head">
            <div>
              <h2>사용자 관리</h2>
              <p>현재 계정에는 사용자 관리 권한이 없습니다.</p>
            </div>
          </div>
          <div className="settings-placeholder-body">
            <Shield size={18} />
            <span>최고 관리자 계정으로 로그인해야 사용자 관리 기능을 사용할 수 있습니다.</span>
          </div>
        </section>
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
              <button
                type="button"
                className="settings-primary-button"
                onClick={openCreateModal}
              >
                <UserPlus size={15} />
                사용자 생성
              </button>
              <button type="button" className="settings-action-button" onClick={() => void loadUsers()}>
                <RefreshCw size={15} />
                새로고침
              </button>
            </div>
          </div>
          {renderNotice()}
        </section>

        <section className="ops-card">
          <div className="ops-card-head">
            <div>
              <h2>사용자 목록</h2>
              <p>계정을 선택하면 상세 관리 모달이 바로 열립니다.</p>
            </div>
          </div>

          {isListLoading ? (
            <div className="settings-empty">사용자 목록을 불러오는 중입니다.</div>
          ) : users.length === 0 ? (
            <div className="settings-empty">등록된 사용자가 없습니다.</div>
          ) : (
            <div className="settings-user-list">
              {users.map((item) => {
                const isSelected = item.id === selectedUserId;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedUserId(item.id);
                      setErrorMessage("");
                      setSuccessMessage("");
                      setIsManageModalOpen(true);
                    }}
                    className={`settings-user-item${isSelected ? " is-selected" : ""}`}
                  >
                    <div className="settings-user-item__top">
                      <div>
                        <strong>{item.name}</strong>
                        <span>{item.userId}</span>
                      </div>
                      <em>{getRoleLabel(item.role)}</em>
                    </div>
                    <div className="settings-user-item__meta">
                      <span>{item.isActive ? "활성" : "비활성"}</span>
                      <span>{item.lastLoginAt ? formatDateTime(item.lastLoginAt, "로그인 이력 없음") : "로그인 이력 없음"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="ops-page settings-page">
      <header className="ops-header">
        <div>
          <p className="ops-kicker">Settings</p>
          <h1>관리자 설정</h1>
          <p className="ops-subtitle">관리자 계정 생성, 수정, 비밀번호 변경, 활성화 상태를 관리합니다.</p>
        </div>
      </header>

      <section className="ops-kpi-grid settings-kpis">
        <article className="ops-kpi-card blue">
          <div className="ops-kpi-icon">
            <UserCog size={19} />
          </div>
          <div>
            <span>등록 계정</span>
            <strong>{users.length}</strong>
            <small>현재 조회된 관리자 계정 수</small>
          </div>
        </article>

        <article className="ops-kpi-card green">
          <div className="ops-kpi-icon">
            <Shield size={19} />
          </div>
          <div>
            <span>활성 계정</span>
            <strong>{activeUserCount}</strong>
            <small>즉시 로그인 가능한 계정 수</small>
          </div>
        </article>

        <article className="ops-kpi-card slate">
          <div className="ops-kpi-icon">
            <UserX size={19} />
          </div>
          <div>
            <span>비활성 계정</span>
            <strong>{inactiveUserCount}</strong>
            <small>로그인할 수 없도록 비활성화된 계정 수</small>
          </div>
        </article>
      </section>
      <section className="settings-content">{renderUsersSection()}</section>
      {renderCreateModal()}
      {renderManageModal()}
      {renderActivateConfirmModal()}
      {renderDeactivateConfirmModal()}
    </div>
  );
}
