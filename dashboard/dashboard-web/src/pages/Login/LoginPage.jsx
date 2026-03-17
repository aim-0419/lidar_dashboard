import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleLogin = () => {
    // 지금은 그냥 로그인 성공 처리
    login();
    navigate("/");
  };

  return (
    <div style={wrap}>
      <div style={card}>
        <h2>{t("title.login")}</h2>

        <input placeholder="ID" style={input} />
        <input placeholder="Password" type="password" style={input} />

        <button onClick={handleLogin} style={btn}>
          {t("title.loginbtn")}
        </button>
      </div>
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

const input = {
  padding: 10,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "#111",
  color: "#fff",
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
