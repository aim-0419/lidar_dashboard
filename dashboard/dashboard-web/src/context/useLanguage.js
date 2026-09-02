import { useContext } from "react";
import { LanguageContext } from "./language-context-value";

export function useLanguage() {
  return useContext(LanguageContext);
}
