import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { checkSignupRequestUserId, createSignupRequest } from "../../shared/api/http";
import "./signupRequest.css";

const initialForm = {
  userId: "",
  name: "",
  password: "",
  email: "",
  phoneNumber: "",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_NUMBER_PATTERN = /^01[016789]-\d{3,4}-\d{4}$/;

function formatPhoneNumber(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;

  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export default function SignupRequestPage() {
  const [form, setForm] = useState(initialForm);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [userIdMessage, setUserIdMessage] = useState("");
  const [isUserIdAvailable, setIsUserIdAvailable] = useState(false);
  const [isCheckingUserId, setIsCheckingUserId] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ email: "", phoneNumber: "" });
  const currentUserIdRef = useRef("");
  const isFormComplete = Object.values(form).every((value) => value.trim() !== "");

  function handleChange(event) {
    const { name, value } = event.target;

    if (name === "userId") {
      currentUserIdRef.current = value.trim();
      setIsUserIdAvailable(false);
      setUserIdMessage("");
      setForm({ ...initialForm, userId: value });
      return;
    }

    if (name === "phoneNumber") {
      setFieldErrors((previous) => ({ ...previous, phoneNumber: "" }));
      setForm((previous) => ({ ...previous, phoneNumber: formatPhoneNumber(value) }));
      return;
    }

    if (name === "email") {
      setFieldErrors((previous) => ({ ...previous, email: "" }));
    }

    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function getFieldError(name, value) {
    if (name === "email" && !EMAIL_PATTERN.test(value.trim())) {
      return "올바른 이메일 형식으로 입력해 주세요.";
    }

    if (name === "phoneNumber" && !PHONE_NUMBER_PATTERN.test(value.trim())) {
      return "전화번호는 010-1234-5678 형식으로 입력해 주세요.";
    }

    return "";
  }

  function handleFieldBlur(event) {
    const { name, value } = event.target;

    if (name !== "email" && name !== "phoneNumber") {
      return;
    }

    setFieldErrors((previous) => ({
      ...previous,
      [name]: getFieldError(name, value),
    }));
  }

  async function handleUserIdCheck() {
    const userId = form.userId.trim();

    setErrorMessage("");
    setSuccessMessage("");

    if (!userId) {
      setUserIdMessage("사용자 ID를 입력해 주세요.");
      setIsUserIdAvailable(false);
      return;
    }

    setIsCheckingUserId(true);

    try {
      const result = await checkSignupRequestUserId(userId);

      // 확인 요청 중 ID가 변경된 경우, 이전 요청의 응답은 반영하지 않는다.
      if (currentUserIdRef.current !== userId) {
        return;
      }

      if (!result.available) {
        setUserIdMessage("이미 사용 중인 ID로 사용할 수 없습니다.");
        setIsUserIdAvailable(false);
        return;
      }

      setUserIdMessage("사용 가능한 ID입니다.");
      setIsUserIdAvailable(true);
    } catch (error) {
      if (currentUserIdRef.current !== userId) {
        return;
      }

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
      setErrorMessage("사용자 ID 중복 확인을 완료해 주세요.");
      return;
    }

    const emailError = getFieldError("email", form.email);
    const phoneNumberError = getFieldError("phoneNumber", form.phoneNumber);

    if (emailError || phoneNumberError) {
      setFieldErrors({ email: emailError, phoneNumber: phoneNumberError });
      return;
    }

    setIsSubmitting(true);

    try {
      await createSignupRequest({
        userId: form.userId.trim(),
        name: form.name.trim(),
        password: form.password,
        email: form.email.trim(),
        phoneNumber: form.phoneNumber.trim(),
      });

      setForm(initialForm);
      setIsUserIdAvailable(false);
      setUserIdMessage("");
      setSuccessMessage("가입 신청이 완료되었습니다. 최고관리자 승인 후 로그인할 수 있습니다.");
    } catch (error) {
      setErrorMessage(error.message || "가입 신청 처리 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
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
            <input
              name="userId"
              value={form.userId}
              onChange={handleChange}
              autoComplete="username"
              pattern="[A-Za-z0-9]{4,30}"
              title="사용자 ID는 영문과 숫자만 사용해 4~30자로 입력해 주세요."
              required
            />
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
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            onBlur={handleFieldBlur}
            autoComplete="email"
            aria-invalid={Boolean(fieldErrors.email)}
            required
            disabled={!isUserIdAvailable}
          />
        </label>
        {fieldErrors.email ? <p className="signup-field-message error">{fieldErrors.email}</p> : null}
        <label>
          전화번호
          <input
            name="phoneNumber"
            value={form.phoneNumber}
            onChange={handleChange}
            onBlur={handleFieldBlur}
            placeholder="010-1234-5678"
            autoComplete="tel"
            aria-invalid={Boolean(fieldErrors.phoneNumber)}
            required
            disabled={!isUserIdAvailable}
          />
        </label>
        {fieldErrors.phoneNumber ? <p className="signup-field-message error">{fieldErrors.phoneNumber}</p> : null}

        {errorMessage ? <p className="signup-message error">{errorMessage}</p> : null}
        {successMessage ? <p className="signup-message success">{successMessage}</p> : null}

        <button type="submit" disabled={isSubmitting || !isUserIdAvailable || !isFormComplete}>
          {isSubmitting ? "가입 신청 중..." : "가입 신청하기"}
        </button>
        <Link to="/login">로그인으로 돌아가기</Link>
      </form>
    </main>
  );
}
