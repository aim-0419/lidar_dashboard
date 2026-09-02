import { useEffect, useEffectEvent, useState } from "react";
import {
  CircleHelp,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  Shield,
  UserCog,
  UserPlus,
  UserX,
} from "lucide-react";
import { useAuth } from "../../context/useAuth";
import {
  createUserRequest,
  deactivateUserRequest,
  fetchUserDetail,
  fetchMyProfile,
  fetchUsers,
  updateUserPasswordRequest,
  updateUserRequest,
  verifyUserPasswordRequest,
} from "../../shared/api/http";
import "../Dashboard/dashboard.css";
import "./settings.css";

const initialCreateForm = {
  userId: "",
  name: "",
  password: "",
  role: "MANAGER",
  isActive: true,
};

const initialEditForm = {
  userId: "",
  name: "",
  role: "SUPER_ADMIN",
  isActive: true,
};

const initialPasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmNewPassword: "",
};

const ROLE_LABELS = {
  SUPER_ADMIN: "최고 관리자",
  MANAGER: "관리자",
};

const ROLE_OPTIONS = [
  { value: "SUPER_ADMIN", label: "SUPER_ADMIN" },
  { value: "MANAGER", label: "MANAGER" },
];

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
  const { user, logout, updateCurrentUser } = useAuth();
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
  const [isVerifyingCurrentPassword, setIsVerifyingCurrentPassword] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [createErrorMessage, setCreateErrorMessage] = useState("");
  const [manageToastMessage, setManageToastMessage] = useState("");
  const [passwordErrorMessage, setPasswordErrorMessage] = useState("");
  const [passwordVerifyMessage, setPasswordVerifyMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const isSuperAdmin = user?.role === "super_admin";

  const currentPasswordValue = passwordForm.currentPassword || "";
  const newPasswordValue = passwordForm.newPassword || "";
  const confirmNewPasswordValue = passwordForm.confirmNewPassword || "";
  const hasUserChanges = Boolean(
    selectedUser &&
      (
        editForm.userId.trim() !== (selectedUser.userId || "") ||
        editForm.name.trim() !== (selectedUser.name || "") ||
        String(editForm.role || "").toUpperCase() !== String(selectedUser.role || "").toUpperCase() ||
        Boolean(editForm.isActive) !== Boolean(selectedUser.isActive)
      )
  );
  const hasPasswordChange = Boolean(
    currentPasswordValue.trim() &&
      newPasswordValue.trim() &&
      confirmNewPasswordValue.trim()
  );
  const isManagingOwnAccount = selectedUserId === user?.id;
  const isCurrentPasswordVerified = passwordVerifyMessage === "기존 비밀번호가 확인되었습니다.";
  const visibleUsers = isSuperAdmin ? users : selectedUser ? [selectedUser] : [];
  const visibleUserCount = visibleUsers.length;
  const visibleActiveUserCount = visibleUsers.filter((item) => item.isActive).length;
  const visibleInactiveUserCount = visibleUsers.filter((item) => !item.isActive).length;
  const isSamePassword = Boolean(
    isCurrentPasswordVerified &&
    currentPasswordValue.trim() &&
      newPasswordValue.trim() &&
      currentPasswordValue === newPasswordValue
  );
  const isNewPasswordMismatch = Boolean(
    newPasswordValue.trim() &&
      confirmNewPasswordValue.trim() &&
      newPasswordValue !== confirmNewPasswordValue
  );
  const samePasswordMessage = isSamePassword
    ? "기존 비밀번호와 같은 비밀번호로 설정할 수 없습니다."
    : "";
  const newPasswordMismatchMessage = isNewPasswordMismatch
    ? "입력한 새 비밀번호가 일치하지 않습니다."
    : "";
  const loadUsersOnRoleChange = useEffectEvent(() => {
    void loadUsers();
  });
  const loadUserDetailOnSelectionChange = useEffectEvent((id) => {
    void loadUserDetail(id);
  });

  useEffect(() => {
    if (isSuperAdmin) {
      loadUsersOnRoleChange();
      return;
    }

    if (!user?.id) {
      return;
    }

    setUsers([]);
    setSelectedUserId(user.id);
    loadUserDetailOnSelectionChange(user.id);
  }, [isSuperAdmin, user?.id]);

  useEffect(() => {
    if (!selectedUserId || !isSuperAdmin) {
      return;
    }

    loadUserDetailOnSelectionChange(selectedUserId);
  }, [isSuperAdmin, selectedUserId]);

  useEffect(() => {
    if (!manageToastMessage) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setManageToastMessage("");
    }, 1800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [manageToastMessage]);

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
      const nextUser = isSuperAdmin ? (await fetchUserDetail(id)).user : await fetchMyProfile();
      setSelectedUser(nextUser);
      setEditForm({
        userId: nextUser.userId || "",
        name: nextUser.name || "",
        role: String(nextUser.role || "super_admin").toUpperCase(),
        isActive: Boolean(nextUser.isActive),
      });
      setPasswordForm(initialPasswordForm);
      setPasswordErrorMessage("");
      setPasswordVerifyMessage("");
      setShowCurrentPassword(false);
      setShowNewPassword(false);
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
    setPasswordErrorMessage("");
    setPasswordForm((prev) => {
      if (name === "currentPassword") {
        // 기존 비밀번호가 바뀌면 검증 상태를 초기화하고 새 비밀번호 입력도 다시 받는다.
        setPasswordVerifyMessage("");
        return {
          currentPassword: value,
          newPassword: "",
          confirmNewPassword: "",
        };
      }

      // 새 비밀번호 입력 중에는 기존 비밀번호 확인 완료 문구를 유지한다.
      return {
        ...prev,
        [name]: value,
      };
    });
  }

  async function handleVerifyCurrentPassword() {
    if (!selectedUserId) {
      return;
    }

    if (!passwordForm.currentPassword.trim()) {
      setPasswordErrorMessage("기존 비밀번호를 입력해 주세요.");
      return;
    }

    setIsVerifyingCurrentPassword(true);
    setPasswordErrorMessage("");
    setPasswordVerifyMessage("");

    try {
      await verifyUserPasswordRequest(selectedUserId, {
        currentPassword: passwordForm.currentPassword,
      });
      setPasswordVerifyMessage("기존 비밀번호가 확인되었습니다.");
    } catch (error) {
      if (
        error.message === "Current password is incorrect." ||
        error.message === "currentPassword is required."
      ) {
        setPasswordErrorMessage("기존 비밀번호가 일치하지 않습니다.");
      } else {
        setPasswordErrorMessage("기존 비밀번호를 확인하지 못했습니다.");
      }
    } finally {
      setIsVerifyingCurrentPassword(false);
    }
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

      if (response.user?.id === user?.id) {
        updateCurrentUser(response.user);
      }

      await loadUsers(response.user?.id || selectedUserId);
      await loadUserDetail(response.user?.id || selectedUserId);
      setManageToastMessage("저장 완료됐습니다.");
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

    if (!passwordForm.currentPassword.trim() || !passwordForm.newPassword.trim()) {
      setPasswordErrorMessage("기존 비밀번호와 새 비밀번호를 모두 입력해 주세요.");
      return;
    }

    if (!passwordForm.confirmNewPassword.trim()) {
      setPasswordErrorMessage("새 비밀번호 확인을 입력해 주세요.");
      return;
    }

    if (!isCurrentPasswordVerified) {
      setPasswordErrorMessage("기존 비밀번호 확인을 먼저 진행해 주세요.");
      return;
    }

    if (passwordForm.currentPassword === passwordForm.newPassword) {
      setPasswordErrorMessage("기존 비밀번호와 같은 비밀번호로 설정할 수 없습니다.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      setPasswordErrorMessage("입력한 새 비밀번호가 일치하지 않습니다.");
      return;
    }

    setIsChangingPassword(true);
    setPasswordErrorMessage("");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await updateUserPasswordRequest(selectedUserId, {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm(initialPasswordForm);
      if (selectedUserId === user?.id) {
        await logout();
        return;
      }

      await loadUserDetail(selectedUserId);
      setManageToastMessage("저장 완료됐습니다.");
    } catch (error) {
      if (error.message === "Current password is incorrect.") {
        setPasswordErrorMessage("기존 비밀번호가 일치하지 않습니다.");
      } else if (
        error.message === "currentPassword and newPassword are required." ||
        error.message === "password is required."
      ) {
        setPasswordErrorMessage("기존 비밀번호와 새 비밀번호를 모두 입력해 주세요.");
      } else if (error.message === "New password must be different from current password.") {
        setPasswordErrorMessage("기존 비밀번호와 같은 비밀번호로 설정할 수 없습니다.");
      } else {
        setPasswordErrorMessage("사용자 비밀번호를 변경하지 못했습니다.");
      }
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
      setIsManageModalOpen(false);
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
      setIsManageModalOpen(false);
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

  function closeCreateModal() {
    if (isCreating) {
      return;
    }

    setCreateErrorMessage("");
    setShowCreatePassword(false);
    setIsCreateModalOpen(false);
  }

  function closeManageModal() {
    if (isUpdating || isChangingPassword || isActivating || isDeactivating) {
      return;
    }

    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setPasswordErrorMessage("");
    setPasswordVerifyMessage("");
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
                  value={createForm.userId || ""}
                  onChange={handleCreateChange}
                  placeholder="manager01"
                />
              </label>
              <label className="settings-field">
                <span>이름</span>
                <input
                  name="name"
                  value={createForm.name || ""}
                  onChange={handleCreateChange}
                  placeholder="manager"
                />
              </label>
            </div>

            <div className="settings-form-grid">
              <label className="settings-field">
                <span>비밀번호</span>
                <div className="settings-password-field">
                  <input
                    type={showCreatePassword ? "text" : "password"}
                    name="password"
                    value={createForm.password || ""}
                    onChange={handleCreateChange}
                    placeholder="password123"
                  />
                  <button
                    type="button"
                    className="settings-password-toggle"
                    onClick={() => setShowCreatePassword((prev) => !prev)}
                    aria-label={showCreatePassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                  >
                    {showCreatePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>
              <label className="settings-field">
                <span>권한</span>
                <select name="role" value={createForm.role || "MANAGER"} onChange={handleCreateChange}>
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
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

          {manageToastMessage ? (
            <div className="settings-manage-toast" role="status">
              {manageToastMessage}
            </div>
          ) : null}

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

              {selectedUser.isActive ? (
                <>
                  <form className="settings-form-stack" onSubmit={handleUpdateUser}>
                    <div className="settings-form-grid">
                      <label className="settings-field">
                        <span>사용자 ID</span>
                        <input name="userId" value={editForm.userId || ""} onChange={handleEditChange} />
                      </label>
                      <label className="settings-field">
                        <span>이름</span>
                        <input name="name" value={editForm.name || ""} onChange={handleEditChange} />
                      </label>
                    </div>

                    <div className="settings-form-grid">
                      <label className="settings-field">
                        <span>권한</span>
                          <select
                            name="role"
                            value={editForm.role || "SUPER_ADMIN"}
                            onChange={handleEditChange}
                            disabled={isManagingOwnAccount || !isSuperAdmin}
                          >
                            {ROLE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={isUpdating || !hasUserChanges}
                      className="settings-primary-button"
                    >
                      {isUpdating ? "저장 중..." : "변경사항 저장"}
                    </button>
                  </form>

                  {isManagingOwnAccount ? (
                    <form className="settings-form-stack settings-divider" onSubmit={handleUpdatePassword}>
                      <label className="settings-field">
                        <span>기존 비밀번호</span>
                        <div className={`settings-password-row${isCurrentPasswordVerified ? " is-locked" : ""}`}>
                          <div className="settings-password-field">
                            <input
                              type={showCurrentPassword ? "text" : "password"}
                              name="currentPassword"
                              value={passwordForm.currentPassword || ""}
                              onChange={handlePasswordChange}
                              placeholder="current password"
                              disabled={isCurrentPasswordVerified}
                            />
                            <button
                              type="button"
                              className="settings-password-toggle"
                              onClick={() => setShowCurrentPassword((prev) => !prev)}
                              aria-label={showCurrentPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                              disabled={isCurrentPasswordVerified}
                            >
                              {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                          <button
                            type="button"
                            className="settings-secondary-button settings-password-verify-button"
                            onClick={() => void handleVerifyCurrentPassword()}
                            disabled={
                              isCurrentPasswordVerified ||
                              isVerifyingCurrentPassword ||
                              !passwordForm.currentPassword.trim()
                            }
                          >
                            {isVerifyingCurrentPassword ? "확인 중..." : "기존 비밀번호 확인"}
                          </button>
                        </div>
                        {passwordVerifyMessage ? (
                          <small className="settings-field-success">{passwordVerifyMessage}</small>
                        ) : null}
                        {passwordErrorMessage ? (
                          <small className="settings-field-error">{passwordErrorMessage}</small>
                        ) : null}
                      </label>

                      <label className="settings-field">
                        <span>새 비밀번호</span>
                        <div className="settings-password-field">
                          <input
                            type={showNewPassword ? "text" : "password"}
                            name="newPassword"
                            value={passwordForm.newPassword || ""}
                            onChange={handlePasswordChange}
                            placeholder="new password"
                            disabled={!isCurrentPasswordVerified}
                          />
                          <button
                            type="button"
                            className="settings-password-toggle"
                            onClick={() => setShowNewPassword((prev) => !prev)}
                            aria-label={showNewPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                            disabled={!isCurrentPasswordVerified}
                          >
                            {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        {samePasswordMessage && !passwordErrorMessage ? (
                          <small className="settings-field-error">{samePasswordMessage}</small>
                        ) : null}
                      </label>

                      <label className="settings-field">
                        <span>새 비밀번호 확인</span>
                        <div className="settings-password-field">
                          <input
                            type={showNewPassword ? "text" : "password"}
                            name="confirmNewPassword"
                            value={passwordForm.confirmNewPassword || ""}
                            onChange={handlePasswordChange}
                            placeholder="confirm new password"
                            disabled={!isCurrentPasswordVerified}
                          />
                          <button
                            type="button"
                            className="settings-password-toggle"
                            onClick={() => setShowNewPassword((prev) => !prev)}
                            aria-label={showNewPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                            disabled={!isCurrentPasswordVerified}
                          >
                            {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        {newPasswordMismatchMessage && !passwordErrorMessage ? (
                          <small className="settings-field-error">{newPasswordMismatchMessage}</small>
                        ) : null}
                      </label>

                      <button
                        type="submit"
                        disabled={
                          isChangingPassword ||
                          !hasPasswordChange ||
                          isSamePassword ||
                          isNewPasswordMismatch ||
                          !isCurrentPasswordVerified
                        }
                        className="settings-secondary-button"
                      >
                        <KeyRound size={15} />
                        {isChangingPassword ? "변경 중..." : "비밀번호 저장"}
                      </button>
                    </form>
                  ) : null}
                </>
              ) : (
                <div className="settings-confirm-copy">
                  비활성화된 계정은 정보 수정과 비밀번호 변경을 할 수 없습니다. 다시 사용하려면 아래에서
                  계정을 활성화해 주세요.
                </div>
              )}

              <div className="settings-divider settings-modal__footer">
                {isSuperAdmin && !isManagingOwnAccount && selectedUser.isActive ? (
                  <button
                    type="button"
                    onClick={openDeactivateConfirmModal}
                    disabled={isActivating || isDeactivating}
                    className="settings-danger-button"
                  >
                    <UserX size={15} />
                    {isDeactivating ? "비활성화 중..." : "사용자 비활성화"}
                  </button>
                ) : isSuperAdmin && !isManagingOwnAccount ? (
                  <button
                    type="button"
                    onClick={openActivateConfirmModal}
                    disabled={isActivating || isDeactivating}
                    className="settings-primary-button"
                  >
                    <Shield size={15} />
                    {isActivating ? "활성화 중..." : "사용자 활성화"}
                  </button>
                ) : null}
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
        <div className="settings-stack">
          <section className="ops-card">
            <div className="ops-card-head">
              <div>
                <h2>내 계정</h2>
                <p>이름, 로그인 ID, 비밀번호를 직접 관리할 수 있습니다.</p>
              </div>
            </div>
            {renderNotice()}
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
                  onClick={() => {
                    setSelectedUserId(selectedUser.id);
                    setErrorMessage("");
                    setSuccessMessage("");
                    setIsManageModalOpen(true);
                  }}
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
                        className={`settings-status-badge ${
                          item.isActive ? "active" : "inactive"
                        }`}
                      >
                        {item.isActive ? "활성" : "비활성"}
                      </span>
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
            <strong>{visibleUserCount}</strong>
            <small>{isSuperAdmin ? "현재 조회된 관리자 계정 수" : "현재 로그인한 계정 수"}</small>
          </div>
        </article>

        <article className="ops-kpi-card green">
          <div className="ops-kpi-icon">
            <Shield size={19} />
          </div>
          <div>
            <span>활성 계정</span>
            <strong>{visibleActiveUserCount}</strong>
            <small>즉시 로그인 가능한 계정 수</small>
          </div>
        </article>

        <article className="ops-kpi-card slate">
          <div className="ops-kpi-icon">
            <UserX size={19} />
          </div>
          <div>
            <span>비활성 계정</span>
            <strong>{visibleInactiveUserCount}</strong>
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
