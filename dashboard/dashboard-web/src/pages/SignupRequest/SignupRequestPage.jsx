import { useState } from "react";
import { Link } from "react-router-dom";
import {
  cancelSignupRequest,
  checkSignupRequestUserId,
  createSignupRequest,
} from "../../shared/api/http";
import "./signupRequest.css";

const initialForm = {
  userId: "",
  name: "",
  password: "",
  email: "",
  phoneNumber: "",
};

const initialCancelForm = {
  id: "",
  userId: "",
  password: "",
};

export default function SignupRequestPage() {
  const [form, setForm] = useState(initialForm);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [userIdMessage, setUserIdMessage] = useState("");
  const [isUserIdAvailable, setIsUserIdAvailable] = useState(false);
  const [isCheckingUserId, setIsCheckingUserId] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancelForm, setCancelForm] = useState(initialCancelForm);
  const [cancelMessage, setCancelMessage] = useState("");
  const [isCancelSuccess, setIsCancelSuccess] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const isFormComplete = Object.values(form).every((value) => value.trim() !== "");

  function handleChange(event) {
    const { name, value } = event.target;

    if (name === "userId") {
      setIsUserIdAvailable(false);
      setUserIdMessage("");
      setForm({ ...initialForm, userId: value });
      return;
    }

    setForm((previous) => ({ ...previous, [name]: value }));
  }

  async function handleUserIdCheck() {
    const userId = form.userId.trim();

    setErrorMessage("");
    setSuccessMessage("");

    if (!userId) {
      setUserIdMessage("사용자 ID를 입력해주세요.");
      setIsUserIdAvailable(false);
      return;
    }

    setIsCheckingUserId(true);

    try {
      const result = await checkSignupRequestUserId(userId);

      if (!result.available) {
        setUserIdMessage("이미 사용 중인 ID로 사용할 수 없습니다.");
        setIsUserIdAvailable(false);
        return;
      }

      setUserIdMessage("사용 가능한 ID입니다.");
      setIsUserIdAvailable(true);
    } catch (error) {
      setUserIdMessage(error.message || "사용 가능한 ID 확인 중 오류가 발생했습니다.");
      setIsUserIdAvailable(false);
    } finally {
      setIsCheckingUserId(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!isUserIdAvailable) {
      setErrorMessage("사용자 ID 중복 확인을 완료해주세요.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await createSignupRequest({
        userId: form.userId.trim(),
        name: form.name.trim(),
        password: form.password,
        email: form.email.trim(),
        phoneNumber: form.phoneNumber.trim(),
      });
      const submittedRequest = response.request;

      setForm(initialForm);
      setIsUserIdAvailable(false);
      setUserIdMessage("");
      setCancelForm({
        id: submittedRequest?.id || "",
        userId: submittedRequest?.userId || "",
        password: "",
      });
      setSuccessMessage(
        `가입 신청이 완료되었습니다. 신청 번호(${submittedRequest?.id || "-"})를 보관해 주세요. 최고관리자 승인 후 로그인할 수 있습니다.`,
      );
    } catch (error) {
      setErrorMessage(error.message || "가입 신청 처리 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancelSubmit(event) {
    event.preventDefault();
    setCancelMessage("");
    setIsCancelSuccess(false);

    if (!cancelForm.id.trim() || !cancelForm.userId.trim() || !cancelForm.password) {
      setCancelMessage("신청 번호, 사용자 ID, 비밀번호를 모두 입력해주세요.");
      return;
    }

    setIsCancelling(true);

    try {
      await cancelSignupRequest(cancelForm.id.trim(), {
        userId: cancelForm.userId.trim(),
        password: cancelForm.password,
      });
      setCancelForm(initialCancelForm);
      setCancelMessage("가입 신청이 취소되었습니다. 같은 정보로 다시 신청할 수 있습니다.");
      setIsCancelSuccess(true);
    } catch (error) {
      setCancelMessage(error.message || "가입 신청 취소 중 오류가 발생했습니다.");
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <main className="signup-page">
      <form className="signup-card" onSubmit={handleSubmit}>
        <p className="signup-eyebrow">ADMIN ACCOUNT REQUEST</p>
        <h1>관리자 계정 가입 신청</h1>
        <p className="signup-description">신청 계정은 최고관리자 승인 후 관리자 권한으로 생성됩니다.</p>

        <label>
          사용자 ID
          <span className="signup-user-id-row">
            <input name="userId" value={form.userId} onChange={handleChange} autoComplete="username" required />
            <button type="button" className="signup-check-button" onClick={handleUserIdCheck} disabled={isCheckingUserId}>
              {isCheckingUserId ? "확인 중..." : "ID 중복 확인"}
            </button>
          </span>
        </label>
        {userIdMessage ? <p className={`signup-user-id-message ${isUserIdAvailable ? "success" : "error"}`}>{userIdMessage}</p> : null}
        <label>
          이름
          <input name="name" value={form.name} onChange={handleChange} autoComplete="name" required disabled={!isUserIdAvailable} />
        </label>
        <label>
          비밀번호
          <input name="password" type="password" value={form.password} onChange={handleChange} autoComplete="new-password" required disabled={!isUserIdAvailable} />
        </label>
        <label>
          이메일
          <input name="email" type="email" value={form.email} onChange={handleChange} autoComplete="email" required disabled={!isUserIdAvailable} />
        </label>
        <label>
          전화번호
          <input name="phoneNumber" value={form.phoneNumber} onChange={handleChange} placeholder="010-1234-5678" autoComplete="tel" required disabled={!isUserIdAvailable} />
        </label>

        {errorMessage ? <p className="signup-message error">{errorMessage}</p> : null}
        {successMessage ? <p className="signup-message success">{successMessage}</p> : null}

        <button type="submit" disabled={isSubmitting || !isUserIdAvailable || !isFormComplete}>
          {isSubmitting ? "가입 신청 중..." : "가입 신청하기"}
        </button>
        <Link to="/login">로그인으로 돌아가기</Link>
      </form>

      <details className="signup-cancel-card">
        <summary>기존 가입 신청 취소</summary>
        <p>대기 중인 신청만 취소할 수 있습니다. 신청 번호는 가입 신청 완료 화면에서 확인할 수 있습니다.</p>
        <form onSubmit={handleCancelSubmit}>
          <label>
            신청 번호
            <input
              name="id"
              value={cancelForm.id}
              onChange={(event) => setCancelForm((previous) => ({ ...previous, id: event.target.value }))}
              required
            />
          </label>
          <label>
            사용자 ID
            <input
              name="userId"
              value={cancelForm.userId}
              onChange={(event) => setCancelForm((previous) => ({ ...previous, userId: event.target.value }))}
              autoComplete="username"
              required
            />
          </label>
          <label>
            비밀번호
            <input
              name="password"
              type="password"
              value={cancelForm.password}
              onChange={(event) => setCancelForm((previous) => ({ ...previous, password: event.target.value }))}
              autoComplete="current-password"
              required
            />
          </label>
          {cancelMessage ? <p className={`signup-message ${isCancelSuccess ? "success" : "error"}`}>{cancelMessage}</p> : null}
          <button type="submit" className="signup-cancel-button" disabled={isCancelling}>
            {isCancelling ? "취소 처리 중..." : "가입 신청 취소"}
          </button>
        </form>
      </details>
    </main>
  );
}
