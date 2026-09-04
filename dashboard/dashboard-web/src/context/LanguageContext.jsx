import { useEffect, useMemo, useState } from "react";
import { t as translate } from "../il8n/il8n";
import { LanguageContext } from "./language-context-value";

export function LanguageProvider({ children }) {
    const [lang, setLang] = useState(() => localStorage.getItem("dashboard:lang") || "ko");

useEffect(() => {
    localStorage.setItem("dashboard:lang", lang);
}, [lang]);

const value = useMemo(() => {
    return {
        lang,
        setLang,
        t: (key) => translate(lang, key),
    };
}, [lang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

