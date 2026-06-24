import { useEffect, useMemo, useState } from "react";
import { fetchCurrentUser, loginUser, registerUser } from "../api";
import { AuthContext } from "./auth";

function readStoredToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("spendsmart_token") ||
    ""
  );
}

function storeToken(token) {
  localStorage.setItem("access_token", token);
  localStorage.setItem("spendsmart_token", token);
}

function clearStoredToken() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("token");
  localStorage.removeItem("spendsmart_token");
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(readStoredToken);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    let active = true;

    async function loadUser() {
      await Promise.resolve();

      if (!token) {
        if (active) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      try {
        const currentUser = await fetchCurrentUser();
        if (active) setUser(currentUser);
      } catch {
        clearStoredToken();
        if (active) {
          setToken("");
          setUser(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadUser();

    return () => {
      active = false;
    };
  }, [token]);

  async function authenticate(mode, credentials) {
    const response =
      mode === "signup"
        ? await registerUser(credentials)
        : await loginUser(credentials);
    const nextToken = response.access_token;

    storeToken(nextToken);
    setToken(nextToken);

    try {
      const currentUser = await fetchCurrentUser();
      setUser(currentUser);
      return currentUser;
    } catch {
      const fallbackUser = { email: credentials.email };
      setUser(fallbackUser);
      return fallbackUser;
    }
  }

  function logout() {
    clearStoredToken();
    setToken("");
    setUser(null);
  }

  const value = useMemo(
    () => ({
      authenticate,
      loading,
      logout,
      token,
      user,
    }),
    [loading, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
