import { useLanguage } from "../context/LanguageContext";

export default function LanguageToggle() {
    const { lang, setLang } = useLanguage();

    return (
        <div style={{ display: "flex", gap:8 }}>
          <button onClick={() => setLang("ko")} style={btn(lang ==="ko")}>KO</button>
          <button onClick={() => setLang("en")} style={btn(lang === "en")}>EN</button>
        </div>
    );
}

const btn = (active) => ({
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.15)",
    background: active ? "rgba(0,255,180,0.18)" : "rgba(255,255,255,0.06)",
    color: "white",
    cursor: "pointer",
});