import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import { useLanguage } from "../../context/useLanguage";
import "./login.css";

const LOGIN_BACKGROUND_VIDEO_SRC = "/videos/login-background.mp4";

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
    <div className="login-page">
      <div className="login-page__media" aria-hidden="true">
        <video
          className="login-page__video"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
        >
          <source src={LOGIN_BACKGROUND_VIDEO_SRC} type="video/mp4" />
        </video>
        <div className="login-page__video-fallback" />
        <div className="login-page__overlay" />
        <div className="login-page__grid" />
        <div className="login-page__scan login-page__scan--primary" />
        <div className="login-page__scan login-page__scan--secondary" />
        <div className="login-page__ring login-page__ring--one" />
        <div className="login-page__ring login-page__ring--two" />
        <div className="login-page__glow login-page__glow--left" />
        <div className="login-page__glow login-page__glow--right" />
      </div>

      <main className="login-page__content">
        <section className="login-panel">
          <h3 className="login-panel__title">관리자 로그인</h3>

          <form className="login-panel__form" onSubmit={handleSubmit}>
            <label className="login-panel__field">
              <span className="login-panel__label">ID</span>
              <input
                name="userId"
                placeholder="id"
                value={form.userId}
                onChange={handleChange}
                className="login-panel__input"
                autoComplete="username"
              />
            </label>

            <label className="login-panel__field">
              <span className="login-panel__label">비밀번호</span>
              <input
                name="password"
                placeholder="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                className="login-panel__input"
                autoComplete="current-password"
              />
            </label>

            {errorMessage ? <p className="login-panel__error">{errorMessage}</p> : null}

            <button type="submit" disabled={isSubmitting} className="login-panel__submit">
              {isSubmitting ? "로그인 중..." : t("title.loginbtn")}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
