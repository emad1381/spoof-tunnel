"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeChoice = "dark" | "light";
const KEY = "spoof-theme";

function systemTheme(): ThemeChoice {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

const ThemeContext = createContext<{ theme: ThemeChoice; toggle: () => void }>({
  theme: "dark",
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function initialTheme(): ThemeChoice {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(KEY);
  return stored === "light" || stored === "dark" ? (stored as ThemeChoice) : systemTheme();
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeChoice>(initialTheme);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);
  const toggle = () => {
    setTheme((prev) => {
      const next: ThemeChoice = prev === "dark" ? "light" : "dark";
      localStorage.setItem(KEY, next);
      return next;
    });
  };
  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      className="header-link-btn"
      onClick={toggle}
      type="button"
      title={theme === "dark" ? "تغییر به حالت روشن" : "تغییر به حالت تیره"}
      aria-label={theme === "dark" ? "تغییر به حالت روشن" : "تغییر به حالت تیره"}
    >
      <span aria-hidden="true">{theme === "dark" ? "☀️" : "🌙"}</span>
      <span className="hide-mobile">{theme === "dark" ? "روشن" : "تیره"}</span>
    </button>
  );
}
