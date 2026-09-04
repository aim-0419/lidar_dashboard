import { useEffect, useMemo, useState } from "react";
import {
  clearAccessToken,
  fetchMyProfile,
  initializeAccessToken,
  loginRequest,
  logoutRequest,
  setAccessToken,
  setUnauthorizedHandler,
} from "../shared/api/http";
import { AuthContext } from "./auth-context-value";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const handleUnauthorized = () => {
      clearAccessToken();
      setUser(null);
      setIsInitializing(false);
    };

    setUnauthorizedHandler(handleUnauthorized);

    return () => {
      setUnauthorizedHandler(null);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initializeAuth() {
      try {
        const token = await initializeAccessToken();

        if (!token) {
          if (isMounted) {
            setUser(null);
          }
          return;
        }

        const nextUser = await fetchMyProfile();

        if (isMounted) {
          setUser(nextUser);
        }
      } catch {
        clearAccessToken();

        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    }

    initializeAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  async function login(credentials) {
    const result = await loginRequest(credentials);
    setAccessToken(result.accessToken);
    setUser(result.user);
    return result;
  }

  async function logout() {
    try {
      await logoutRequest();
    } finally {
      clearAccessToken();
      setUser(null);
    }
  }

  function updateCurrentUser(nextUser) {
    setUser((currentUser) => (currentUser ? { ...currentUser, ...nextUser } : currentUser));
  }

  const value = useMemo(
    () => ({
      user,
      isLoggedIn: Boolean(user),
      isInitializing,
      login,
      logout,
      updateCurrentUser,
    }),
    [isInitializing, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
