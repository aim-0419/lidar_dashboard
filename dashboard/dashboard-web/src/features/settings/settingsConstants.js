// 관리자 설정 화면에서 공용으로 쓰는 폼 기본값, 역할 라벨/옵션, 표시용 포매터.

export const initialCreateForm = {
  userId: "",
  name: "",
  password: "",
  role: "MANAGER",
  isActive: true,
};

export const initialEditForm = {
  userId: "",
  name: "",
  role: "MANAGER",
  isActive: true,
};

export const initialPasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmNewPassword: "",
};

export const initialResetPasswordForm = {
  newPassword: "",
  confirmNewPassword: "",
};

export const ROLE_LABELS = {
  SUPER_ADMIN: "최고 관리자",
  MANAGER: "관리자",
};

export const ROLE_OPTIONS = [
  { value: "SUPER_ADMIN", label: "SUPER_ADMIN" },
  { value: "MANAGER", label: "MANAGER" },
];

export function formatDateTime(value, fallback = "-") {
  if (!value) {
    return fallback;
  }

  const nextDate = new Date(value);
  if (Number.isNaN(nextDate.getTime())) {
    return fallback;
  }

  return nextDate.toLocaleString();
}

export function getRoleLabel(role) {
  if (!role) {
    return "선택 없음";
  }

  const normalizedRole = String(role).toUpperCase();
  return ROLE_LABELS[normalizedRole] || normalizedRole;
}
