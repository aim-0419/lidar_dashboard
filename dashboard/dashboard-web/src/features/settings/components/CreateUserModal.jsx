import { Eye, EyeOff, UserPlus } from "lucide-react";
import { ROLE_OPTIONS } from "../settingsConstants";

// 관리자 계정 생성 모달. 상태는 부모(SettingsPage)가 들고, 여기서는 props만 받아 표시한다.
export function CreateUserModal({
  open,
  onClose,
  errorMessage,
  form,
  onChange,
  onSubmit,
  showPassword,
  onTogglePassword,
  isSuperAdminSelected,
  superAdminConfirmed,
  onSuperAdminConfirmChange,
  isCreating,
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="settings-modal__head">
          <div>
            <h2>사용자 생성</h2>
            <p>새 관리자 계정을 등록합니다.</p>
          </div>
          <button type="button" className="settings-modal__close" onClick={onClose}>
            닫기
          </button>
        </div>

        <form className="settings-form-stack" onSubmit={onSubmit}>
          {errorMessage ? (
            <div className="settings-banner error settings-modal-banner">{errorMessage}</div>
          ) : null}

          <div className="settings-form-grid">
            <label className="settings-field">
              <span>사용자 ID</span>
              <input
                name="userId"
                value={form.userId || ""}
                onChange={onChange}
                placeholder="manager01"
              />
            </label>
            <label className="settings-field">
              <span>이름</span>
              <input
                name="name"
                value={form.name || ""}
                onChange={onChange}
                placeholder="manager"
              />
            </label>
          </div>

          <div className="settings-form-grid">
            <label className="settings-field">
              <span>비밀번호</span>
              <div className="settings-password-field">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={form.password || ""}
                  onChange={onChange}
                  placeholder="password123"
                />
                <button
                  type="button"
                  className="settings-password-toggle"
                  onClick={onTogglePassword}
                  aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
            <label className="settings-field">
              <span>권한</span>
              <select name="role" value={form.role || "MANAGER"} onChange={onChange}>
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {isSuperAdminSelected ? (
            <label className="settings-role-confirm">
              <input
                type="checkbox"
                checked={superAdminConfirmed}
                onChange={(event) => onSuperAdminConfirmChange(event.target.checked)}
              />
              <span>최고 관리자 권한을 부여하는 것을 확인했습니다.</span>
            </label>
          ) : null}

          <div className="settings-modal__actions">
            <button type="button" className="settings-secondary-button" onClick={onClose}>
              취소
            </button>
            <button
              type="submit"
              disabled={isCreating || (isSuperAdminSelected && !superAdminConfirmed)}
              className="settings-primary-button"
            >
              <UserPlus size={15} />
              {isCreating ? "생성 중..." : "사용자 생성"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
