import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";

// 사용자 로그인 정보를 받아 백엔드 로그인 흐름을 시작합니다.
export default function LoginPage() {
  const { login, isLoggedIn, isInitializing } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();

  const [form, setForm] = useState({
    userId: "",
    password: "",
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 로그인 성공 후 원래 요청했던 화면으로 다시 이동할 경로입니다.
  const redirectPath = location.state?.from?.pathname || "/";

  useEffect(() => {
    if (!isInitializing && isLoggedIn) {
      navigate(redirectPath, { replace: true });
    }
  }, [isInitializing, isLoggedIn, navigate, redirectPath]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      // 로그인에 성공하면 AuthContext가 accessToken과 현재 사용자 정보를 저장합니다.
      await login({
        userId: form.userId.trim(),
        password: form.password,
      });
      navigate(redirectPath, { replace: true });
    } catch (error) {
      setErrorMessage(error.message || "로그인 처리 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div style={wrap}>
      <form style={card} onSubmit={handleSubmit}>
        <h2 style={title}>{t("title.login")}</h2>

        <input
          name="userId"
          placeholder="ID"
          value={form.userId}
          onChange={handleChange}
          style={input}
          autoComplete="username"
        />
        <input
          name="password"
          placeholder="Password"
          type="password"
          value={form.password}
          onChange={handleChange}
          style={input}
          autoComplete="current-password"
        />

        {errorMessage ? <p style={errorText}>{errorMessage}</p> : null}

        <button type="submit" disabled={isSubmitting} style={btn}>
          {isSubmitting ? "로그인 중..." : t("title.loginbtn")}
        </button>
        <Link to="/signup-request" style={signupLink}>
          관리자 계정 가입 신청
        </Link>
      </form>
    </div>
  );
}

const wrap = {
  height: "100vh",
  display: "grid",
  placeItems: "center",
  background: "#0b0f14",
};

const card = {
  width: 360,
  padding: 24,
  borderRadius: 16,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#fff",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const title = {
  margin: 0,
};

const input = {
  padding: 10,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "#111",
  color: "#fff",
};

const errorText = {
  margin: 0,
  fontSize: 13,
  color: "#ff8f8f",
};

const btn = {
  marginTop: 8,
  padding: 10,
  borderRadius: 8,
  background: "#00ffb4",
  border: "none",
  fontWeight: 700,
  cursor: "pointer",
};

const signupLink = {
  color: "#a7f3d0",
  fontSize: 13,
  fontWeight: 700,
  textAlign: "center",
  textDecoration: "none",
};
