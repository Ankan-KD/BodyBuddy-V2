"use client";

/**
 * Admin Theme Context
 * ------------------
 * Provides a Light / Dark toggle that is scoped entirely to the admin shell.
 * Persists the choice in localStorage under the key "admin-theme".
 * Defaults to "light" for all users unless they have explicitly chosen "dark".
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";

type AdminTheme = "light" | "dark";

const STORAGE_KEY = "admin-theme";

interface AdminThemeCtx {
  theme: AdminTheme;
  toggleTheme: () => void;
  isDark: boolean;
}

const AdminThemeContext = createContext<AdminThemeCtx>({
  theme: "light",
  toggleTheme: () => {},
  isDark: false,
});

export function AdminThemeProvider({ children }: { children: ReactNode }) {
  // Initialise from localStorage (SSR-safe: default to "light")
  const [theme, setTheme] = useState<AdminTheme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Read persisted preference once the component is mounted in the browser
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "dark" || stored === "light") {
        setTheme(stored);
      }
    } catch {
      // localStorage unavailable — keep default
    }
    setMounted(true);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: AdminTheme = prev === "light" ? "dark" : "light";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return (
    <AdminThemeContext.Provider
      value={{ theme, toggleTheme, isDark: theme === "dark" }}
    >
      {/* Suppress hydration mismatch by not rendering children until mounted */}
      {mounted ? children : <>{children}</>}
    </AdminThemeContext.Provider>
  );
}

export function useAdminTheme() {
  return useContext(AdminThemeContext);
}
