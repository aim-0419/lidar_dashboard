import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Radar,
  User,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { LoginScanField } from "../../features/auth/components/LoginScanField";
import { BrandMark } from "../../shared/components/BrandMark";
import "./login.css";

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
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

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
    <div className="login-root">
      <div className="login-backdrop" aria-hidden="true">
        <span className="login-glow one" />
        <span className="login-glow two" />
        <span className="login-grid" />
      </div>

      <LoginScanField />

      <div className="login-layout">
        {/* 좌측: 라이다 스캔 3D 연출 히어로 */}
        <section className="login-hero">
          <div className="login-hero-content">
            <div className="login-badge">
              <Radar size={14} />
              LiDAR WRONG-WAY PREVENTION
            </div>
            <h1>
              회전교차로의 <em>역주행</em>을
              <br />
              실시간으로 잡아냅니다
            </h1>
            <p>
              라이다 다중 객체 payload를 실시간으로 해석해 역주행·보행자 진입을 감지하고,
              전광판과 차단기까지 한 화면에서 관제합니다.
            </p>

          </div>
        </section>

        {/* 우측: 인증 패널 */}
        <section className="login-panel">
          <div className="login-card">
            <div className="login-card-glow" aria-hidden="true" />

            <div className="login-brand">
              <div className="login-brand-icon">
                <BrandMark size={22} />
              </div>
              <div>
                <strong>{t("title.trafficside")}</strong>
                <span>{t("title.trafficsub")}</span>
              </div>
            </div>

            <h2>{t("title.login")}</h2>

            <form onSubmit={handleSubmit} className="login-form">
              <label className="login-field">
                <span>사용자 ID</span>
                <div className="login-input">
                  <User size={16} />
                  <input
                    name="userId"
                    placeholder="관제 계정 ID"
                    value={form.userId}
                    onChange={handleChange}
                    autoComplete="username"
                  />
                </div>
              </label>

              <label className="login-field">
                <span>비밀번호</span>
                <div className="login-input">
                  <Lock size={16} />
                  <input
                    name="password"
                    placeholder="비밀번호"
                    type={isPasswordVisible ? "text" : "password"}
                    value={form.password}
                    onChange={handleChange}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="login-eye"
                    onClick={() => setIsPasswordVisible((value) => !value)}
                    aria-label={isPasswordVisible ? "비밀번호 숨기기" : "비밀번호 표시"}
                  >
                    {isPasswordVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </label>

              {errorMessage ? (
                <p className="login-error" role="alert">
                  <AlertCircle size={15} />
                  {errorMessage}
                </p>
              ) : null}

              <button type="submit" disabled={isSubmitting} className="login-submit">
                <span>{isSubmitting ? "로그인 중..." : t("title.loginbtn")}</span>
                <ArrowRight size={17} />
              </button>
            </form>

          </div>
        </section>
      </div>
    </div>
  );
}
