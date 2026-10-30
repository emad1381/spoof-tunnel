import { useEffect, useState } from "react";

const KNOWN_ROOTS = new Set(["dashboard", "login", "_next", "api"]);

/**
 * Detect the random web-path prefix from the current URL.
 * e.g. http://host:8080/ab12cd34ef/dashboard → "/ab12cd34ef"
 * Returns "" when there is no prefix (root deployment or asset path).
 */
export function getBasePath(): string {
  if (typeof window === "undefined") return "";
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0];
  if (KNOWN_ROOTS.has(first) || first.startsWith("_")) return "";
  return "/" + first;
}

/**
 * Reactive variant for rendering links. Returns "" on the first paint
 * (SSR-safe) and the real prefix after mount. Never call this inside an
 * effect or a callback — use getBasePath() there.
 */
export function useBasePath(): string {
  const [base, setBase] = useState("");
  useEffect(() => setBase(getBasePath()), []);
  return base;
}
