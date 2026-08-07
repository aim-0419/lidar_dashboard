import { useEffect, useMemo, useState } from "react";
import { Bell, Globe, Monitor, Shield, UserCog, UserPlus, KeyRound, UserX, RefreshCw } from "lucide-react";
import { Card } from "../../shared/components/Card";
import { useAuth } from "../../context/AuthContext";
import {
  createUserRequest,
  deactivateUserRequest,
  fetchUserDetail,
  fetchUsers,
  updateUserPasswordRequest,
  updateUserRequest,
} from "../../shared/api/http";

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

// 설정 placeholder 섹션과 사용자 관리 패널을 함께 관리합니다.
export default function SettingsPage() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState("users");
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
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const isSuperAdmin = user?.role === "super_admin";

  const navItems = useMemo(
    () => [
      { id: "general", icon: Globe, label: "일반" },
      { id: "notifications", icon: Bell, label: "알림" },
      { id: "users", icon: UserCog, label: "사용자 관리" },
      { id: "display", icon: Monitor, label: "화면" },
    ],
    [],
  );

  useEffect(() => {
    if (activeSection !== "users" || !isSuperAdmin) {
      return;
    }

    // 사용자 관리 섹션이 활성화되면 최신 사용자 목록을 불러옵니다.
    void loadUsers();
  }, [activeSection, isSuperAdmin]);

  useEffect(() => {
    if (!selectedUserId || activeSection !== "users" || !isSuperAdmin) {
      return;
    }

    // 선택된 사용자가 바뀌면 해당 사용자 상세 정보를 다시 불러옵니다.
    void loadUserDetail(selectedUserId);
  }, [activeSection, isSuperAdmin, selectedUserId]);

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
    setIsCreating(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await createUserRequest({
        userId: createForm.userId.trim(),
        name: createForm.name.trim(),
        password: createForm.password,
        role: createForm.role,
        isActive: createForm.isActive,
      });

      setCreateForm(initialCreateForm);
      setSuccessMessage("사용자를 생성했습니다.");
      await loadUsers(response.user?.id);
      if (response.user?.id) {
        await loadUserDetail(response.user.id);
      }
    } catch (error) {
      setErrorMessage(error.message || "사용자를 생성하지 못했습니다.");
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

    const confirmed = window.confirm(`${selectedUser.userId} 사용자를 비활성화할까요?`);
    if (!confirmed) {
      return;
    }

    setIsDeactivating(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await deactivateUserRequest(selectedUserId);
      setSuccessMessage("사용자를 비활성화했습니다.");
      await loadUsers(response.user?.id || selectedUserId);
      await loadUserDetail(response.user?.id || selectedUserId);
    } catch (error) {
      setErrorMessage(error.message || "사용자를 비활성화하지 못했습니다.");
    } finally {
      setIsDeactivating(false);
    }
  }

  function renderPlaceholder(title, description) {
    return (
      <Card title={title}>
        <div className="text-sm text-gray-600">{description}</div>
      </Card>
    );
  }

  function renderUsersSection() {
    if (!isSuperAdmin) {
      return renderPlaceholder("사용자 관리", "사용자 관리 권한이 없습니다.");
    }

    return (
      <div className="space-y-6">
        <Card title="사용자 관리 개요">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-800">관리자 계정을 관리합니다</div>
              <div className="text-xs text-gray-500">
                사용자 목록 조회, 생성, 수정, 비활성화, 비밀번호 변경을 관리합니다.
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadUsers()}
              className="inline-flex items-center justify-center gap-2 rounded border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4" />
              새로고침
            </button>
          </div>

          {errorMessage ? (
            <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div className="mt-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {successMessage}
            </div>
          ) : null}
        </Card>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_1.35fr]">
          <Card title="사용자 목록" className="bg-white">
            {isListLoading ? (
              <div className="text-sm text-gray-500">사용자 목록을 불러오는 중입니다.</div>
            ) : users.length === 0 ? (
              <div className="text-sm text-gray-500">등록된 사용자가 없습니다.</div>
            ) : (
              <div className="space-y-3">
                {users.map((item) => {
                  const isSelected = item.id === selectedUserId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedUserId(item.id)}
                      className={`w-full rounded border px-4 py-3 text-left transition ${
                        isSelected
                          ? "border-gray-900 bg-gray-900 text-white"
                          : "border-gray-200 bg-white text-gray-800 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold">{item.name}</div>
                          <div className={`text-xs ${isSelected ? "text-gray-200" : "text-gray-500"}`}>
                            {item.userId}
                          </div>
                        </div>
                        <div
                          className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${
                            isSelected ? "bg-white/15 text-white" : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {item.role}
                        </div>
                      </div>
                      <div className={`mt-3 flex items-center justify-between text-xs ${isSelected ? "text-gray-200" : "text-gray-500"}`}>
                        <span>{item.isActive ? "활성" : "비활성"}</span>
                        <span>{item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString() : "로그인 이력 없음"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          <div className="space-y-6">
            <Card title="사용자 생성" className="bg-white">
              <form className="space-y-4" onSubmit={handleCreateUser}>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm text-gray-700">
                    <span className="font-semibold">사용자 ID</span>
                    <input
                      name="userId"
                      value={createForm.userId}
                      onChange={handleCreateChange}
                      className="w-full rounded border border-gray-300 px-3 py-2"
                      placeholder="manager01"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-gray-700">
                    <span className="font-semibold">이름</span>
                    <input
                      name="name"
                      value={createForm.name}
                      onChange={handleCreateChange}
                      className="w-full rounded border border-gray-300 px-3 py-2"
                      placeholder="manager"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm text-gray-700">
                    <span className="font-semibold">비밀번호</span>
                    <input
                      type="password"
                      name="password"
                      value={createForm.password}
                      onChange={handleCreateChange}
                      className="w-full rounded border border-gray-300 px-3 py-2"
                      placeholder="password123"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-gray-700">
                    <span className="font-semibold">권한</span>
                    <select
                      name="role"
                      value={createForm.role}
                      onChange={handleCreateChange}
                      className="w-full rounded border border-gray-300 px-3 py-2"
                    >
                      <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                    </select>
                  </label>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    name="isActive"
                    checked={createForm.isActive}
                    onChange={handleCreateChange}
                  />
                  활성 사용자
                </label>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="inline-flex items-center justify-center gap-2 rounded bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  <UserPlus className="h-4 w-4" />
                  {isCreating ? "생성 중..." : "사용자 생성"}
                </button>
              </form>
            </Card>

            <Card title="선택한 사용자" className="bg-white">
              {!selectedUserId ? (
                <div className="text-sm text-gray-500">목록에서 사용자를 선택해 계정을 관리하세요.</div>
              ) : isDetailLoading ? (
                <div className="text-sm text-gray-500">사용자 상세 정보를 불러오는 중입니다.</div>
              ) : !selectedUser ? (
                <div className="text-sm text-gray-500">사용자 상세 정보를 확인할 수 없습니다.</div>
              ) : (
                <div className="space-y-6">
                  <div className="rounded border border-gray-200 bg-gray-50 p-4">
                    <div className="text-sm font-semibold text-gray-800">{selectedUser.name}</div>
                    <div className="mt-1 text-xs text-gray-500">{selectedUser.userId}</div>
                    <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-gray-600 md:grid-cols-2">
                      <div>권한: {selectedUser.role}</div>
                      <div>상태: {selectedUser.isActive ? "활성" : "비활성"}</div>
                      <div>생성일: {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleString() : "-"}</div>
                      <div>마지막 로그인: {selectedUser.lastLoginAt ? new Date(selectedUser.lastLoginAt).toLocaleString() : "로그인 이력 없음"}</div>
                    </div>
                  </div>

                  <form className="space-y-4" onSubmit={handleUpdateUser}>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <label className="space-y-2 text-sm text-gray-700">
                        <span className="font-semibold">사용자 ID</span>
                        <input
                          name="userId"
                          value={editForm.userId}
                          onChange={handleEditChange}
                          className="w-full rounded border border-gray-300 px-3 py-2"
                        />
                      </label>
                      <label className="space-y-2 text-sm text-gray-700">
                        <span className="font-semibold">이름</span>
                        <input
                          name="name"
                          value={editForm.name}
                          onChange={handleEditChange}
                          className="w-full rounded border border-gray-300 px-3 py-2"
                        />
                      </label>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <label className="space-y-2 text-sm text-gray-700">
                        <span className="font-semibold">권한</span>
                        <select
                          name="role"
                          value={editForm.role}
                          onChange={handleEditChange}
                          className="w-full rounded border border-gray-300 px-3 py-2"
                        >
                          <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                        </select>
                      </label>
                      <label className="inline-flex items-center gap-2 pt-8 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          name="isActive"
                          checked={editForm.isActive}
                          onChange={handleEditChange}
                        />
                        활성 사용자
                      </label>
                    </div>
                    <button
                      type="submit"
                      disabled={isUpdating}
                      className="rounded bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                    >
                      {isUpdating ? "저장 중..." : "변경사항 저장"}
                    </button>
                  </form>

                  <form className="space-y-4 border-t border-gray-200 pt-6" onSubmit={handleUpdatePassword}>
                    <div className="space-y-2 text-sm text-gray-700">
                      <span className="font-semibold">비밀번호 변경</span>
                      <input
                        type="password"
                        name="password"
                        value={passwordForm.password}
                        onChange={handlePasswordChange}
                        className="w-full rounded border border-gray-300 px-3 py-2"
                        placeholder="newPassword123"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isChangingPassword}
                      className="inline-flex items-center justify-center gap-2 rounded border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100"
                    >
                      <KeyRound className="h-4 w-4" />
                      {isChangingPassword ? "변경 중..." : "비밀번호 저장"}
                    </button>
                  </form>

                  <div className="border-t border-gray-200 pt-6">
                    <button
                      type="button"
                      onClick={() => void handleDeactivateUser()}
                      disabled={isDeactivating || !selectedUser.isActive}
                      className="inline-flex items-center justify-center gap-2 rounded border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      <UserX className="h-4 w-4" />
                      {isDeactivating ? "비활성화 중..." : "사용자 비활성화"}
                    </button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-6 font-sans">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">설정</h1>
          <div className="text-sm text-gray-500">대시보드 설정과 관리자 계정을 관리합니다.</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[240px_1fr]">
        <div className="space-y-2">
          {navItems.map(({ id, icon: Icon, label }) => {
            const isActive = activeSection === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveSection(id)}
                className={`flex w-full items-center gap-3 rounded px-4 py-3 text-left text-sm transition ${
                  isActive
                    ? "bg-gray-900 text-white"
                    : "border border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="font-semibold">{label}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-6">
          {activeSection === "general" && renderPlaceholder("일반", "일반 설정은 아직 연결되지 않았습니다.")}
          {activeSection === "notifications" && renderPlaceholder("알림", "알림 설정은 아직 연결되지 않았습니다.")}
          {activeSection === "users" && renderUsersSection()}
          {activeSection === "display" && renderPlaceholder("화면", "화면 설정은 아직 연결되지 않았습니다.")}
        </div>
      </div>
    </div>
  );
}
