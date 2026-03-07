"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

const THEME_KEY = "fluxa_theme";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("dark");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(THEME_KEY);
    const value = saved === "light" ? "light" : "dark";
    setThemeState(value);
    document.documentElement.setAttribute("data-theme", value);
  }, []);

  const setTheme = useCallback((value) => {
    if (value !== "dark" && value !== "light") return;
    setThemeState(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_KEY, value);
      document.documentElement.setAttribute("data-theme", value);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      if (typeof window !== "undefined") {
        window.localStorage.setItem(THEME_KEY, next);
        document.documentElement.setAttribute("data-theme", next);
      }
      return next;
    });
  }, []);

  const value = { theme, setTheme, toggleTheme };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: "dark",
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return ctx;
}
