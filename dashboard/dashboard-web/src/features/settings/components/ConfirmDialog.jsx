// 관리자 설정의 활성화/비활성화 확인 모달처럼 구조가 같은 확인 대화상자를 공용으로 그린다.
// 상태는 부모가 들고, 이 컴포넌트는 props만 받아 표시한다.
export function ConfirmDialog({
  open,
  title,
  question,
  description,
  confirmLabel,
  confirmBusyLabel,
  confirmTone = "primary", // "primary" | "danger"
  isBusy = false,
  confirmDisabled = false,
  onConfirm,
  onClose,
}) {
  if (!open) {
    return null;
  }

  const confirmClass =
    confirmTone === "danger" ? "settings-danger-button" : "settings-primary-button";

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div
        className="settings-modal settings-modal--compact"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="settings-modal__head">
          <div>
            <h2>{title}</h2>
            <p>{question}</p>
          </div>
          <button type="button" className="settings-modal__close" onClick={onClose}>
            닫기
          </button>
        </div>

        <div className="settings-confirm-copy">{description}</div>

        <div className="settings-modal__actions">
          <button
            type="button"
            className="settings-secondary-button"
            onClick={onClose}
            disabled={isBusy}
          >
            취소
          </button>
          <button
            type="button"
            className={confirmClass}
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {isBusy ? confirmBusyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
