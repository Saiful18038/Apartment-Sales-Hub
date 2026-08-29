"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, getToken, setToken, setLicenseStatusHandler, setLicenseBlockedHandler, setUnauthorizedHandler, LicenseBlockedError } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [licenseStatus, setLicenseStatus] = useState("ACTIVE");
  const [licenseBlocked, setLicenseBlocked] = useState(null); // { status, message } | null

  useEffect(() => {
    setLicenseStatusHandler((status) => setLicenseStatus(status));
    setLicenseBlockedHandler((status, message) => setLicenseBlocked({ status, message }));
    setUnauthorizedHandler(() => {
      setUser(null);
    });
  }, []);

  useEffect(() => {
    (async () => {
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const me = await api.get("/me");
        setUser(me);
      } catch (e) {
        if (e instanceof LicenseBlockedError) {
          setLicenseBlocked({ status: e.licenseStatus, message: e.message });
        }
        setToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await api.login(email, password);
    setToken(res.token);
    setUser(res.user);
    setLicenseBlocked(null);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/logout");
    } catch {
      // ignore — we're clearing local state regardless
    }
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, licenseStatus, licenseBlocked, setLicenseBlocked }),
    [user, loading, login, logout, licenseStatus, licenseBlocked]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
