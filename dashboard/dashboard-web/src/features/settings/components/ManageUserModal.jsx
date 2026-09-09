import { CircleHelp, Eye, EyeOff, KeyRound, Shield, UserX } from "lucide-react";
import { ROLE_OPTIONS, formatDateTime, getRoleLabel } from "../settingsConstants";

// 사용자 관리 모달. 상태·핸들러는 부모(SettingsPage)가 들고,
// 편집/본인 비밀번호 변경/비밀번호 초기화 세 폼은 그룹 prop으로 받아 표시만 한다.
export function ManageUserModal({
  open,
  onClose,
  user,
  toastMessage,
  isDetailLoading,
  canManage,
  isSuperAdmin,
  isManagingOwnAccount,
  onActivate,
  onDeactivate,
  isActivating,
  isDeactivating,
  edit,
  ownPassword,
  resetPassword,
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div
        className="settings-modal settings-modal--wide"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
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
          <button type="button" className="settings-modal__close" onClick={onClose}>
            닫기
          </button>
        </div>

        {toastMessage ? (
          <div className="settings-manage-toast" role="status">
            {toastMessage}
          </div>
        ) : null}

        {isDetailLoading ? (
          <div className="settings-empty">사용자 상세 정보를 불러오는 중입니다.</div>
        ) : !canManage || !user ? (
          <div className="settings-empty">사용자 상세 정보를 확인할 수 없습니다.</div>
        ) : (
          <div className="settings-stack">
            <div className="settings-user-summary">
              <strong>{user.name}</strong>
              <span>{user.userId}</span>
              <div className="settings-user-summary__grid">
                <div>권한: {getRoleLabel(user.role)}</div>
                <div>상태: {user.isActive ? "활성" : "비활성"}</div>
                <div>생성일: {formatDateTime(user.createdAt)}</div>
                <div>마지막 로그인: {formatDateTime(user.lastLoginAt, "로그인 이력 없음")}</div>
              </div>
            </div>

            {user.isActive ? (
              <>
                <form className="settings-form-stack" onSubmit={edit.onSubmit}>
                  <div className="settings-form-grid">
                    <label className="settings-field">
                      <span>사용자 ID</span>
                      <input name="userId" value={edit.form.userId || ""} onChange={edit.onChange} />
                    </label>
                    <label className="settings-field">
                      <span>이름</span>
                      <input name="name" value={edit.form.name || ""} onChange={edit.onChange} />
                    </label>
                  </div>

                  <div className="settings-form-grid">
                    <label className="settings-field">
                      <span>권한</span>
                      <select
                        name="role"
                        value={edit.form.role || "MANAGER"}
                        onChange={edit.onChange}
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

                  {edit.isGrantingSuperAdmin ? (
                    <label className="settings-role-confirm">
                      <input
                        type="checkbox"
                        checked={edit.superAdminConfirmed}
                        onChange={(event) => edit.onSuperAdminConfirmChange(event.target.checked)}
                      />
                      <span>선택한 사용자를 최고 관리자로 변경하는 것을 확인했습니다.</span>
                    </label>
                  ) : null}

                  <button
                    type="submit"
                    disabled={
                      !canManage ||
                      edit.isUpdating ||
                      !edit.hasChanges ||
                      (edit.isGrantingSuperAdmin && !edit.superAdminConfirmed)
                    }
                    className="settings-primary-button"
                  >
                    {edit.isUpdating ? "저장 중..." : "변경사항 저장"}
                  </button>
                </form>

                {isManagingOwnAccount ? (
                  <form
                    className="settings-form-stack settings-divider"
                    onSubmit={ownPassword.onSubmit}
                  >
                    <label className="settings-field">
                      <span>기존 비밀번호</span>
                      <div
                        className={`settings-password-row${
                          ownPassword.isVerified ? " is-locked" : ""
                        }`}
                      >
                        <div className="settings-password-field">
                          <input
                            type={ownPassword.showCurrent ? "text" : "password"}
                            name="currentPassword"
                            value={ownPassword.form.currentPassword || ""}
                            onChange={ownPassword.onChange}
                            placeholder="current password"
                            disabled={ownPassword.isVerified}
                          />
                          <button
                            type="button"
                            className="settings-password-toggle"
                            onClick={ownPassword.onToggleCurrent}
                            aria-label={ownPassword.showCurrent ? "비밀번호 숨기기" : "비밀번호 보기"}
                            disabled={ownPassword.isVerified}
                          >
                            {ownPassword.showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        <button
                          type="button"
                          className="settings-secondary-button settings-password-verify-button"
                          onClick={() => void ownPassword.onVerify()}
                          disabled={
                            !canManage ||
                            ownPassword.isVerified ||
                            ownPassword.isVerifying ||
                            !ownPassword.form.currentPassword.trim()
                          }
                        >
                          {ownPassword.isVerifying ? "확인 중..." : "기존 비밀번호 확인"}
                        </button>
                      </div>
                      {ownPassword.verifyMessage ? (
                        <small className="settings-field-success">{ownPassword.verifyMessage}</small>
                      ) : null}
                      {ownPassword.errorMessage ? (
                        <small className="settings-field-error">{ownPassword.errorMessage}</small>
                      ) : null}
                    </label>

                    <label className="settings-field">
                      <span>새 비밀번호</span>
                      <div className="settings-password-field">
                        <input
                          type={ownPassword.showNew ? "text" : "password"}
                          name="newPassword"
                          value={ownPassword.form.newPassword || ""}
                          onChange={ownPassword.onChange}
                          placeholder="new password"
                          disabled={!ownPassword.isVerified}
                        />
                        <button
                          type="button"
                          className="settings-password-toggle"
                          onClick={ownPassword.onToggleNew}
                          aria-label={ownPassword.showNew ? "비밀번호 숨기기" : "비밀번호 보기"}
                          disabled={!ownPassword.isVerified}
                        >
                          {ownPassword.showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {ownPassword.sameMessage && !ownPassword.errorMessage ? (
                        <small className="settings-field-error">{ownPassword.sameMessage}</small>
                      ) : null}
                    </label>

                    <label className="settings-field">
                      <span>새 비밀번호 확인</span>
                      <div className="settings-password-field">
                        <input
                          type={ownPassword.showNew ? "text" : "password"}
                          name="confirmNewPassword"
                          value={ownPassword.form.confirmNewPassword || ""}
                          onChange={ownPassword.onChange}
                          placeholder="confirm new password"
                          disabled={!ownPassword.isVerified}
                        />
                        <button
                          type="button"
                          className="settings-password-toggle"
                          onClick={ownPassword.onToggleNew}
                          aria-label={ownPassword.showNew ? "비밀번호 숨기기" : "비밀번호 보기"}
                          disabled={!ownPassword.isVerified}
                        >
                          {ownPassword.showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {ownPassword.mismatchMessage && !ownPassword.errorMessage ? (
                        <small className="settings-field-error">{ownPassword.mismatchMessage}</small>
                      ) : null}
                    </label>

                    <button
                      type="submit"
                      disabled={
                        !canManage ||
                        ownPassword.isChanging ||
                        !ownPassword.hasChange ||
                        ownPassword.isSame ||
                        ownPassword.isMismatch ||
                        !ownPassword.isVerified
                      }
                      className="settings-secondary-button"
                    >
                      <KeyRound size={15} />
                      {ownPassword.isChanging ? "변경 중..." : "비밀번호 저장"}
                    </button>
                  </form>
                ) : null}

                {isSuperAdmin && !isManagingOwnAccount ? (
                  <form
                    className="settings-form-stack settings-divider"
                    onSubmit={resetPassword.onSubmit}
                  >
                    <div className="settings-reset-copy">
                      <strong>비밀번호 초기화</strong>
                      <span>
                        임시 비밀번호를 설정한 뒤 안전한 방법으로 해당 사용자에게 전달해 주세요.
                      </span>
                    </div>
                    <label className="settings-field">
                      <span>임시 비밀번호</span>
                      <div className="settings-password-field">
                        <input
                          type={resetPassword.show ? "text" : "password"}
                          name="newPassword"
                          value={resetPassword.form.newPassword || ""}
                          onChange={resetPassword.onChange}
                          placeholder="8자 이상 입력"
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          className="settings-password-toggle"
                          onClick={resetPassword.onToggle}
                          aria-label={resetPassword.show ? "비밀번호 숨기기" : "비밀번호 보기"}
                        >
                          {resetPassword.show ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </label>
                    <label className="settings-field">
                      <span>임시 비밀번호 확인</span>
                      <div className="settings-password-field">
                        <input
                          type={resetPassword.show ? "text" : "password"}
                          name="confirmNewPassword"
                          value={resetPassword.form.confirmNewPassword || ""}
                          onChange={resetPassword.onChange}
                          placeholder="임시 비밀번호를 다시 입력"
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          className="settings-password-toggle"
                          onClick={resetPassword.onToggle}
                          aria-label={resetPassword.show ? "비밀번호 숨기기" : "비밀번호 보기"}
                        >
                          {resetPassword.show ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {resetPassword.isMismatch || resetPassword.errorMessage ? (
                        <small className="settings-field-error">
                          {resetPassword.errorMessage || "입력한 임시 비밀번호가 일치하지 않습니다."}
                        </small>
                      ) : null}
                    </label>
                    <button
                      type="submit"
                      disabled={
                        !canManage ||
                        resetPassword.isResetting ||
                        !resetPassword.form.newPassword.trim() ||
                        !resetPassword.form.confirmNewPassword.trim() ||
                        resetPassword.isMismatch
                      }
                      className="settings-secondary-button"
                    >
                      <KeyRound size={15} />
                      {resetPassword.isResetting ? "초기화 중..." : "임시 비밀번호 설정"}
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
              {isSuperAdmin && !isManagingOwnAccount && user.isActive ? (
                <button
                  type="button"
                  onClick={onDeactivate}
                  disabled={!canManage || isActivating || isDeactivating}
                  className="settings-danger-button"
                >
                  <UserX size={15} />
                  {isDeactivating ? "비활성화 중..." : "사용자 비활성화"}
                </button>
              ) : isSuperAdmin && !isManagingOwnAccount ? (
                <button
                  type="button"
                  onClick={onActivate}
                  disabled={!canManage || isActivating || isDeactivating}
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
