"use client";
import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
export type ThemeChoice = "dark" | "light";
const KEY = "spoof-theme";
const EVENT = "spoof-theme-change";
const ThemeContext = createContext<{ theme: ThemeChoice; toggle: () => void }>({ theme: "dark", toggle: () => {} });
export function useTheme() { return useContext(ThemeContext); }
function snapshot(): ThemeChoice { return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark"; }
function setTheme(theme: ThemeChoice) {
 document.documentElement.setAttribute("data-theme", theme);
 document.documentElement.style.colorScheme = theme;
 window.dispatchEvent(new Event(EVENT));
}
function subscribe(notify: () => void) {
 const storage = (event: StorageEvent) => {
  if (event.key === KEY) setTheme(event.newValue === "light" ? "light" : "dark");
 };
 window.addEventListener(EVENT, notify); window.addEventListener("storage", storage);
 return () => { window.removeEventListener(EVENT, notify); window.removeEventListener("storage", storage); };
}
const serverSnapshot = (): ThemeChoice => "dark";
export function ThemeProvider({ children }: { children: ReactNode }) {
 const theme = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
 const toggle = () => {
  const next = snapshot() === "dark" ? "light" : "dark";
  try { localStorage.setItem(KEY, next); } catch { /* Theme still works when storage is unavailable. */ }
  setTheme(next);
 };
 return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>;
}
export function ThemeToggle() {
 const { theme, toggle } = useTheme();
 const label = theme === "dark" ? "تغییر به حالت روشن" : "تغییر به حالت تیره";
 return <button className="header-link-btn" onClick={toggle} type="button" title={label} aria-label={label}>
  <span aria-hidden="true">{theme === "dark" ? "☀️" : "🌙"}</span>
  <span className="hide-mobile">{theme === "dark" ? "روشن" : "تیره"}</span>
 </button>;
}
