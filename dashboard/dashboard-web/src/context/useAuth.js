import { useContext } from "react";
import { AuthContext } from "./auth-context-value";

export function useAuth() {
  return useContext(AuthContext);
}
