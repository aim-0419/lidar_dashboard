import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  requestPasswordResetCode,
  verifyPasswordResetCode,
  confirmPasswordReset,
} from "../../shared/api/http";
import "./forgotPassword.css";

const EMAIL_CODE_LENGTH = 6;
const DEFAULT_RESEND_COOLDOWN_SECONDS = 60;
const MIN_PASSWORD_LENGTH = 8;

export default function ForgotPasswordPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  useEffect(() => {
    const timer = setInterval(() => {
      setResendCooldown((previous) => (previous > 0 ? previous - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  async function handleSendCode(event) {
    event.preventDefault();
    setErrorMessage("");
    setInfoMessage("");

    const trimmedEmail = email.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage("올바른 이메일 형식을 입력해 주세요.");
      return;
    }

    setIsSendingCode(true);

    try {
      const result = await requestPasswordResetCode(trimmedEmail);
      setInfoMessage(result.message || "입력하신 이메일로 가입된 계정이 있다면 인증코드를 보냈습니다.");
      setStep("code");
      setResendCooldown(DEFAULT_RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      setErrorMessage(error.message || "인증코드 발송 중 오류가 발생했습니다.");
    } finally {
      setIsSendingCode(false);
    }
  }

  async function handleResendCode() {
    setErrorMessage("");
    setInfoMessage("");
    setIsSendingCode(true);

    try {
      const result = await requestPasswordResetCode(email.trim());
      setInfoMessage(result.message || "인증코드를 다시 보냈습니다.");
      setResendCooldown(DEFAULT_RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      setErrorMessage(error.message || "인증코드 발송 중 오류가 발생했습니다.");
    } finally {
      setIsSendingCode(false);
    }
  }

  async function handleVerifyCode(event) {
    event.preventDefault();
    setErrorMessage("");

    const trimmedCode = code.trim();

    if (!/^\d{6}$/.test(trimmedCode)) {
      setErrorMessage("인증코드 6자리를 입력해 주세요.");
      return;
    }

    setIsVerifyingCode(true);

    try {
      const result = await verifyPasswordResetCode(email.trim(), trimmedCode);
      setResetToken(result.resetToken || "");
      setInfoMessage("");
      setStep("reset");
    } catch (error) {
      setErrorMessage(error.message || "인증코드 확인 중 오류가 발생했습니다.");
    } finally {
      setIsVerifyingCode(false);
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    setErrorMessage("");

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상 입력해 주세요.`);
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setErrorMessage("새 비밀번호가 서로 일치하지 않습니다.");
      return;
    }

    setIsResetting(true);

    try {
      await confirmPasswordReset(resetToken, newPassword);
      setStep("done");
    } catch (error) {
      setErrorMessage(error.message || "비밀번호 재설정 중 오류가 발생했습니다.");
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <div className="signup-page">
      <div className="signup-card">
        <span className="signup-eyebrow">PASSWORD RESET</span>
        <h1>비밀번호 재설정</h1>

        {step === "email" ? (
          <>
            <p className="signup-description">
              가입할 때 등록한 이메일로 인증코드를 보내드립니다.
            </p>
            <form onSubmit={handleSendCode} style={{ display: "grid", gap: 14 }}>
              <label>
                이메일
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </label>
              {errorMessage ? <p className="signup-message error">{errorMessage}</p> : null}
              <button type="submit" disabled={isSendingCode}>
                {isSendingCode ? "발송 중..." : "인증코드 받기"}
              </button>
            </form>
          </>
        ) : null}

        {step === "code" ? (
          <>
            <p className="signup-description">{email}</p>
            {infoMessage ? <p className="signup-message success">{infoMessage}</p> : null}
            <form onSubmit={handleVerifyCode} style={{ display: "grid", gap: 14 }}>
              <label>
                인증코드
                <span className="signup-user-id-row">
                  <input
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, EMAIL_CODE_LENGTH))}
                    inputMode="numeric"
                    placeholder="6자리 숫자"
                    maxLength={EMAIL_CODE_LENGTH}
                  />
                  <button
                    type="button"
                    className="signup-check-button"
                    onClick={handleResendCode}
                    disabled={isSendingCode || resendCooldown > 0}
                  >
                    {resendCooldown > 0 ? `재전송 (${resendCooldown}초)` : "재전송"}
                  </button>
                </span>
              </label>
              {errorMessage ? <p className="signup-message error">{errorMessage}</p> : null}
              <button type="submit" disabled={isVerifyingCode || code.length !== EMAIL_CODE_LENGTH}>
                {isVerifyingCode ? "확인 중..." : "인증 확인"}
              </button>
            </form>
          </>
        ) : null}

        {step === "reset" ? (
          <>
            <p className="signup-description">인증이 완료되었습니다. 새 비밀번호를 입력해 주세요.</p>
            <form onSubmit={handleResetPassword} style={{ display: "grid", gap: 14 }}>
              <label>
                새 비밀번호
                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>
              <label>
                새 비밀번호 확인
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(event) => setConfirmNewPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />
              </label>
              {errorMessage ? <p className="signup-message error">{errorMessage}</p> : null}
              <button type="submit" disabled={isResetting}>
                {isResetting ? "변경 중..." : "비밀번호 재설정"}
              </button>
            </form>
          </>
        ) : null}

        {step === "done" ? (
          <>
            <p className="signup-message success">
              비밀번호가 변경되었습니다. 기존에 로그인되어 있던 모든 기기는 자동으로 로그아웃됩니다.
            </p>
            <button type="button" onClick={() => navigate("/login", { replace: true })}>
              로그인하러 가기
            </button>
          </>
        ) : null}

        {step !== "done" ? <Link to="/login">로그인으로 돌아가기</Link> : null}
      </div>
    </div>
  );
}
