import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useAuth } from "../../context/useAuth";
import {
  createUserRequest,
  deactivateUserRequest,
  fetchUserDetail,
  fetchMyProfile,
  fetchUsers,
  resetUserPasswordRequest,
  updateUserPasswordRequest,
  updateUserRequest,
  verifyUserPasswordRequest,
} from "../../shared/api/http";
import {
  initialCreateForm,
  initialEditForm,
  initialPasswordForm,
  initialResetPasswordForm,
} from "../../features/settings/settingsConstants";
import { ConfirmDialog } from "../../features/settings/components/ConfirmDialog";
import { CreateUserModal } from "../../features/settings/components/CreateUserModal";
import { ManageUserModal } from "../../features/settings/components/ManageUserModal";
import { UserKpiCards } from "../../features/settings/components/UserKpiCards";
import { UsersSection } from "../../features/settings/components/UsersSection";
import "../Dashboard/dashboard.css";
import "./settings.css";

export default function SettingsPage() {
  const { user, logout, updateCurrentUser } = useAuth();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isActivateConfirmOpen, setIsActivateConfirmOpen] = useState(false);
  const [isDeactivateConfirmOpen, setIsDeactivateConfirmOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const listRequestId = useRef(0);
  const [userSearchKeyword, setUserSearchKeyword] = useState("");
  const [userStatusFilter, setUserStatusFilter] = useState("ALL");
  const [userPage, setUserPage] = useState(1);
  const [userPagination, setUserPagination] = useState({
    page: 1,
    limit: 20,
    totalPages: 1,
    totalItems: 0,
  });
  const [userSummary, setUserSummary] = useState({
    totalCount: 0,
    activeCount: 0,
    inactiveCount: 0,
  });
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const detailRequestId = useRef(0);
  const [createForm, setCreateForm] = useState(initialCreateForm);
  const [editForm, setEditForm] = useState(initialEditForm);
  const [passwordForm, setPasswordForm] = useState(initialPasswordForm);
  const [resetPasswordForm, setResetPasswordForm] = useState(initialResetPasswordForm);
  const [isListLoading, setIsListLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isVerifyingCurrentPassword, setIsVerifyingCurrentPassword] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [createErrorMessage, setCreateErrorMessage] = useState("");
  const [manageToastMessage, setManageToastMessage] = useState("");
  const [passwordErrorMessage, setPasswordErrorMessage] = useState("");
  const [resetPasswordErrorMessage, setResetPasswordErrorMessage] = useState("");
  const [passwordVerifyMessage, setPasswordVerifyMessage] = useState("");
  const [isCurrentPasswordVerified, setIsCurrentPasswordVerified] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [isCreateSuperAdminConfirmed, setIsCreateSuperAdminConfirmed] = useState(false);
  const [isEditSuperAdminConfirmed, setIsEditSuperAdminConfirmed] = useState(false);

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
  const canManageSelectedUser = Boolean(
    !isDetailLoading && selectedUser && selectedUser.id === selectedUserId
  );
  const visibleUsers = isSuperAdmin ? users : selectedUser ? [selectedUser] : [];
  const visibleUserCount = isSuperAdmin ? userSummary.totalCount : visibleUsers.length;
  const visibleActiveUserCount = isSuperAdmin
    ? userSummary.activeCount
    : visibleUsers.filter((item) => item.isActive).length;
  const visibleInactiveUserCount = isSuperAdmin
    ? userSummary.inactiveCount
    : visibleUsers.filter((item) => !item.isActive).length;
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
  const isResetPasswordMismatch = Boolean(
    resetPasswordForm.newPassword.trim() &&
      resetPasswordForm.confirmNewPassword.trim() &&
      resetPasswordForm.newPassword !== resetPasswordForm.confirmNewPassword
  );
  const isCreatingSuperAdmin = String(createForm.role || "").toUpperCase() === "SUPER_ADMIN";
  const isGrantingSuperAdmin = Boolean(
    selectedUser &&
      String(selectedUser.role || "").toUpperCase() !== "SUPER_ADMIN" &&
      String(editForm.role || "").toUpperCase() === "SUPER_ADMIN"
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
      return () => {
        listRequestId.current += 1;
      };
    }

    if (!user?.id) {
      return;
    }

    setUsers([]);
    setSelectedUserId(user.id);
  }, [isSuperAdmin, user?.id]);

  useEffect(() => {
    if (!selectedUserId || (isSuperAdmin && !isManageModalOpen)) {
      return;
    }

    loadUserDetailOnSelectionChange(selectedUserId);
    return () => {
      // 모달을 닫거나 선택을 바꾸면 이전 상세 응답을 무효화한다.
      detailRequestId.current += 1;
    };
  }, [isSuperAdmin, isManageModalOpen, selectedUserId]);

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

  useEffect(() => {
    function handleEscapeKey(event) {
      if (event.key !== "Escape") {
        return;
      }

      if (isDeactivateConfirmOpen && !isDeactivating) {
        setIsDeactivateConfirmOpen(false);
        return;
      }

      if (isActivateConfirmOpen && !isActivating) {
        setIsActivateConfirmOpen(false);
        return;
      }

      if (isManageModalOpen && !isUpdating && !isChangingPassword && !isResettingPassword) {
        setIsManageModalOpen(false);
        return;
      }

      if (isCreateModalOpen && !isCreating) {
        setIsCreateModalOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscapeKey);
    return () => window.removeEventListener("keydown", handleEscapeKey);
  }, [
    isActivateConfirmOpen,
    isActivating,
    isChangingPassword,
    isCreateModalOpen,
    isCreating,
    isDeactivateConfirmOpen,
    isDeactivating,
    isManageModalOpen,
    isResettingPassword,
    isUpdating,
  ]);

  // 목록 필터와 페이지 변경은 모달의 수정 대상 계정을 바꾸지 않는다.
  async function loadUsers(options = {}) {
    const requestId = ++listRequestId.current;
    setIsListLoading(true);
    setErrorMessage("");

    try {
      const nextPage = options.page ?? userPage;
      const nextStatusFilter = options.statusFilter ?? userStatusFilter;
      let query = {
        page: nextPage,
        limit: 20,
        keyword: options.keyword ?? userSearchKeyword.trim(),
        ...(nextStatusFilter === "ACTIVE" ? { isActive: true } : {}),
        ...(nextStatusFilter === "INACTIVE" ? { isActive: false } : {}),
      };
      let response = await fetchUsers(query);
      if (requestId !== listRequestId.current) {
        return;
      }

      // 삭제·비활성화로 마지막 페이지가 사라지면 같은 필터로 한 번만 보정한다.
      const lastPage = Math.max(1, response.pagination?.totalPages ?? 1);
      if (response.pagination && (response.pagination.page ?? query.page) > lastPage) {
        query = { ...query, page: lastPage };
        response = await fetchUsers(query);
        if (requestId !== listRequestId.current) {
          return;
        }

        const correctedLastPage = Math.max(1, response.pagination?.totalPages ?? 1);
        if ((response.pagination?.page ?? query.page) > correctedLastPage) {
          throw new Error("사용자 목록이 다시 변경되었습니다. 다시 조회해 주세요.");
        }
      }

      const nextUsers = response.users || [];
      setUsers(nextUsers);
      setUserPagination(
        response.pagination || {
          page: query.page,
          limit: 20,
          totalPages: 1,
          totalItems: nextUsers.length,
        },
      );
      setUserSummary(
        response.summary || {
          totalCount: nextUsers.length,
          activeCount: nextUsers.filter((item) => item.isActive).length,
          inactiveCount: nextUsers.filter((item) => !item.isActive).length,
        },
      );
      setUserPage(response.pagination?.page || query.page);
    } catch (error) {
      if (requestId !== listRequestId.current) {
        return;
      }
      setErrorMessage(error.message || "사용자 목록을 불러오지 못했습니다.");
    } finally {
      if (requestId === listRequestId.current) {
        setIsListLoading(false);
      }
    }
  }

  async function loadUserDetail(id) {
    const requestId = ++detailRequestId.current;
    setSelectedUser(null);
    if (!id) {
      setEditForm(initialEditForm);
      setIsCurrentPasswordVerified(false);
      setIsDetailLoading(false);
      return;
    }

    setIsDetailLoading(true);
    setErrorMessage("");

    try {
      const nextUser = isSuperAdmin ? (await fetchUserDetail(id)).user : await fetchMyProfile();
      if (requestId !== detailRequestId.current) {
        return;
      }
      if (!nextUser || nextUser.id !== id) {
        throw new Error("선택한 사용자의 상세 정보를 확인할 수 없습니다.");
      }
      setSelectedUser(nextUser);
      setEditForm({
        userId: nextUser.userId || "",
        name: nextUser.name || "",
        role: String(nextUser.role || "manager").toUpperCase(),
        isActive: Boolean(nextUser.isActive),
      });
      setIsEditSuperAdminConfirmed(false);
      setPasswordForm(initialPasswordForm);
      setResetPasswordForm(initialResetPasswordForm);
      setPasswordErrorMessage("");
      setResetPasswordErrorMessage("");
      setPasswordVerifyMessage("");
      setIsCurrentPasswordVerified(false);
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowResetPassword(false);
    } catch (error) {
      if (requestId !== detailRequestId.current) {
        return;
      }
      setSelectedUser(null);
      setErrorMessage(error.message || "사용자 상세 정보를 불러오지 못했습니다.");
    } finally {
      if (requestId === detailRequestId.current) {
        setIsDetailLoading(false);
      }
    }
  }

  function handleCreateChange(event) {
    const { name, value, type, checked } = event.target;
    setCreateErrorMessage("");
    if (name === "role" && value !== "SUPER_ADMIN") {
      setIsCreateSuperAdminConfirmed(false);
    }
    setCreateForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function handleEditChange(event) {
    const { name, value, type, checked } = event.target;
    if (name === "role" && value !== "SUPER_ADMIN") {
      setIsEditSuperAdminConfirmed(false);
    }
    setEditForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function handleUserSearchSubmit(event) {
    event.preventDefault();
    setUserPage(1);
    void loadUsers({ page: 1 });
  }

  function handleUserStatusFilterChange(event) {
    const nextStatusFilter = event.target.value;
    setUserStatusFilter(nextStatusFilter);
    setUserPage(1);
    void loadUsers({ page: 1, statusFilter: nextStatusFilter });
  }

  function handleUserPageChange(nextPage) {
    if (nextPage < 1 || nextPage > userPagination.totalPages || nextPage === userPage) {
      return;
    }

    setUserPage(nextPage);
    void loadUsers({ page: nextPage });
  }

  function handlePasswordChange(event) {
    const { name, value } = event.target;
    setPasswordErrorMessage("");
    if (name === "currentPassword") {
      // 기존 비밀번호가 바뀌면 검증 상태를 초기화하고 새 비밀번호 입력도 다시 받는다.
      setPasswordVerifyMessage("");
      setIsCurrentPasswordVerified(false);
      setPasswordForm({
        currentPassword: value,
        newPassword: "",
        confirmNewPassword: "",
      });
      return;
    }

    // 새 비밀번호 입력 중에는 기존 비밀번호 확인 완료 문구를 유지한다.
    setPasswordForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleResetPasswordChange(event) {
    const { name, value } = event.target;
    setResetPasswordErrorMessage("");
    setResetPasswordForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleVerifyCurrentPassword() {
    if (!canManageSelectedUser) {
      return;
    }

    if (!passwordForm.currentPassword.trim()) {
      setPasswordErrorMessage("기존 비밀번호를 입력해 주세요.");
      return;
    }

    setIsVerifyingCurrentPassword(true);
    setPasswordErrorMessage("");
    setPasswordVerifyMessage("");
    setIsCurrentPasswordVerified(false);

    try {
      await verifyUserPasswordRequest(selectedUserId, {
        currentPassword: passwordForm.currentPassword,
      });
      setPasswordVerifyMessage("기존 비밀번호가 확인되었습니다.");
      setIsCurrentPasswordVerified(true);
    } catch (error) {
      setIsCurrentPasswordVerified(false);
      if (
        error.message === "Current password is incorrect." ||
        error.message === "currentPassword is required."
      ) {
        setPasswordErrorMessage("기존 비밀번호가 일치하지 않습니다.");
      } else if (error.status === 429) {
        setPasswordErrorMessage("비밀번호 확인 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
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

    if (isCreatingSuperAdmin && !isCreateSuperAdminConfirmed) {
      setCreateErrorMessage("최고 관리자 권한 부여 여부를 확인해 주세요.");
      return;
    }

    setIsCreating(true);
    setCreateErrorMessage("");
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await createUserRequest({
        userId: nextUserId,
        name: nextName,
        password: nextPassword,
        role: createForm.role,
        isActive: createForm.isActive,
      });

      setCreateForm(initialCreateForm);
      setSuccessMessage("사용자를 생성했습니다.");
      setIsCreateModalOpen(false);
      await loadUsers();
    } catch (error) {
      setCreateErrorMessage(error.message || "필수 입력값을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleUpdateUser(event) {
    event.preventDefault();
    if (!canManageSelectedUser) {
      return;
    }

    if (isGrantingSuperAdmin && !isEditSuperAdminConfirmed) {
      setErrorMessage("최고 관리자 권한 부여 여부를 확인해 주세요.");
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

      // 사용자 목록 API는 최고 관리자 전용이므로 본인 수정 후에는 호출하지 않는다.
      if (isSuperAdmin) {
        await loadUsers();
      }
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
    if (!canManageSelectedUser) {
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
      setIsCurrentPasswordVerified(false);
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
      } else if (error.status === 429) {
        setPasswordErrorMessage("비밀번호 확인 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
      } else {
        setPasswordErrorMessage("사용자 비밀번호를 변경하지 못했습니다.");
      }
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleDeactivateUser() {
    if (!canManageSelectedUser) {
      return;
    }

    setIsDeactivating(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await deactivateUserRequest(selectedUserId);
      setSuccessMessage("사용자를 비활성화했습니다.");
      setIsDeactivateConfirmOpen(false);
      setIsManageModalOpen(false);
      await loadUsers();
    } catch (error) {
      setErrorMessage(error.message || "사용자를 비활성화하지 못했습니다.");
    } finally {
      setIsDeactivating(false);
    }
  }

  async function handleResetUserPassword(event) {
    event.preventDefault();

    if (!canManageSelectedUser || !isSuperAdmin || isManagingOwnAccount) {
      return;
    }

    const nextPassword = resetPasswordForm.newPassword.trim();
    const confirmPassword = resetPasswordForm.confirmNewPassword.trim();

    if (!nextPassword || !confirmPassword) {
      setResetPasswordErrorMessage("임시 비밀번호와 확인 값을 모두 입력해 주세요.");
      return;
    }

    if (nextPassword !== confirmPassword) {
      setResetPasswordErrorMessage("입력한 임시 비밀번호가 일치하지 않습니다.");
      return;
    }

    setIsResettingPassword(true);
    setResetPasswordErrorMessage("");

    try {
      await resetUserPasswordRequest(selectedUserId, {
        newPassword: nextPassword,
      });
      setResetPasswordForm(initialResetPasswordForm);
      setManageToastMessage("임시 비밀번호를 설정했습니다.");
    } catch (error) {
      setResetPasswordErrorMessage(
        error.message || "사용자 비밀번호를 초기화하지 못했습니다.",
      );
    } finally {
      setIsResettingPassword(false);
    }
  }

  async function handleActivateUser() {
    if (!canManageSelectedUser) {
      return;
    }

    setIsActivating(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await updateUserRequest(selectedUserId, {
        isActive: true,
      });

      setSuccessMessage("사용자를 활성화했습니다.");
      setIsActivateConfirmOpen(false);
      setIsManageModalOpen(false);
      await loadUsers();
    } catch (error) {
      setErrorMessage(error.message || "사용자를 활성화하지 못했습니다.");
    } finally {
      setIsActivating(false);
    }
  }

  function openCreateModal() {
    setCreateForm(initialCreateForm);
    setIsCreateSuperAdminConfirmed(false);
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
    if (isUpdating || isChangingPassword || isResettingPassword || isActivating || isDeactivating) {
      return;
    }

    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setPasswordErrorMessage("");
    setResetPasswordErrorMessage("");
    setPasswordVerifyMessage("");
    setIsCurrentPasswordVerified(false);
    setResetPasswordForm(initialResetPasswordForm);
    setIsManageModalOpen(false);
    setIsActivateConfirmOpen(false);
    setIsDeactivateConfirmOpen(false);
  }

  function openManageModal(id) {
    detailRequestId.current += 1;
    setSelectedUser(null);
    setIsDetailLoading(true);
    setSelectedUserId(id);
    setErrorMessage("");
    setSuccessMessage("");
    setIsManageModalOpen(true);
  }

  function openActivateConfirmModal() {
    if (!canManageSelectedUser || selectedUser?.isActive || isActivating || isDeactivating) {
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
    if (!canManageSelectedUser || !selectedUser?.isActive || isActivating || isDeactivating) {
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

  return (
    <div className="ops-page settings-page">
      <header className="ops-header">
        <div>
          <p className="ops-kicker">Settings</p>
          <h1>관리자 설정</h1>
          <p className="ops-subtitle">관리자 계정 생성, 수정, 비밀번호 변경, 활성화 상태를 관리합니다.</p>
        </div>
      </header>

      <UserKpiCards
        show={isSuperAdmin}
        totalCount={visibleUserCount}
        activeCount={visibleActiveUserCount}
        inactiveCount={visibleInactiveUserCount}
      />

      <section className="settings-content">
        <UsersSection
          isSuperAdmin={isSuperAdmin}
          errorMessage={errorMessage}
          successMessage={successMessage}
          isDetailLoading={isDetailLoading}
          selectedUser={selectedUser}
          onOpenManage={openManageModal}
          onOpenCreate={openCreateModal}
          onRefresh={() => void loadUsers()}
          users={users}
          isListLoading={isListLoading}
          searchKeyword={userSearchKeyword}
          onSearchKeywordChange={setUserSearchKeyword}
          onSearchSubmit={handleUserSearchSubmit}
          statusFilter={userStatusFilter}
          onStatusFilterChange={handleUserStatusFilterChange}
          pagination={userPagination}
          page={userPage}
          onPageChange={handleUserPageChange}
        />
      </section>

      <CreateUserModal
        open={isCreateModalOpen}
        onClose={closeCreateModal}
        errorMessage={createErrorMessage}
        form={createForm}
        onChange={handleCreateChange}
        onSubmit={handleCreateUser}
        showPassword={showCreatePassword}
        onTogglePassword={() => setShowCreatePassword((prev) => !prev)}
        isSuperAdminSelected={isCreatingSuperAdmin}
        superAdminConfirmed={isCreateSuperAdminConfirmed}
        onSuperAdminConfirmChange={setIsCreateSuperAdminConfirmed}
        isCreating={isCreating}
      />

      <ManageUserModal
        open={isManageModalOpen && Boolean(selectedUserId)}
        onClose={closeManageModal}
        user={selectedUser}
        toastMessage={manageToastMessage}
        isDetailLoading={isDetailLoading}
        canManage={canManageSelectedUser}
        isSuperAdmin={isSuperAdmin}
        isManagingOwnAccount={isManagingOwnAccount}
        onActivate={openActivateConfirmModal}
        onDeactivate={openDeactivateConfirmModal}
        isActivating={isActivating}
        isDeactivating={isDeactivating}
        edit={{
          form: editForm,
          onChange: handleEditChange,
          onSubmit: handleUpdateUser,
          isGrantingSuperAdmin,
          superAdminConfirmed: isEditSuperAdminConfirmed,
          onSuperAdminConfirmChange: setIsEditSuperAdminConfirmed,
          isUpdating,
          hasChanges: hasUserChanges,
        }}
        ownPassword={{
          form: passwordForm,
          onChange: handlePasswordChange,
          onSubmit: handleUpdatePassword,
          isVerified: isCurrentPasswordVerified,
          onVerify: handleVerifyCurrentPassword,
          isVerifying: isVerifyingCurrentPassword,
          verifyMessage: passwordVerifyMessage,
          errorMessage: passwordErrorMessage,
          showCurrent: showCurrentPassword,
          onToggleCurrent: () => setShowCurrentPassword((prev) => !prev),
          showNew: showNewPassword,
          onToggleNew: () => setShowNewPassword((prev) => !prev),
          sameMessage: samePasswordMessage,
          mismatchMessage: newPasswordMismatchMessage,
          isChanging: isChangingPassword,
          hasChange: hasPasswordChange,
          isSame: isSamePassword,
          isMismatch: isNewPasswordMismatch,
        }}
        resetPassword={{
          form: resetPasswordForm,
          onChange: handleResetPasswordChange,
          onSubmit: handleResetUserPassword,
          show: showResetPassword,
          onToggle: () => setShowResetPassword((prev) => !prev),
          isMismatch: isResetPasswordMismatch,
          errorMessage: resetPasswordErrorMessage,
          isResetting: isResettingPassword,
        }}
      />

      <ConfirmDialog
        open={isActivateConfirmOpen && Boolean(selectedUser)}
        title="사용자 활성화 확인"
        question={`${selectedUser?.userId ?? ""} 계정을 다시 활성화할까요?`}
        description="활성화된 계정은 다시 로그인할 수 있으며, 사용자 목록에서 즉시 활성 상태로 표시됩니다."
        confirmLabel="활성화 진행"
        confirmBusyLabel="활성화 중..."
        confirmTone="primary"
        isBusy={isActivating}
        confirmDisabled={!canManageSelectedUser || isActivating}
        onConfirm={() => void handleActivateUser()}
        onClose={closeActivateConfirmModal}
      />

      <ConfirmDialog
        open={isDeactivateConfirmOpen && Boolean(selectedUser)}
        title="사용자 비활성화 확인"
        question={`${selectedUser?.userId ?? ""} 계정을 정말 비활성화할까요?`}
        description="비활성화된 계정은 로그인할 수 없으며, 필요 시 다시 활성화 절차가 필요합니다."
        confirmLabel="비활성화 진행"
        confirmBusyLabel="비활성화 중..."
        confirmTone="danger"
        isBusy={isDeactivating}
        confirmDisabled={!canManageSelectedUser || isDeactivating}
        onConfirm={() => void handleDeactivateUser()}
        onClose={closeDeactivateConfirmModal}
      />
    </div>
  );
}
