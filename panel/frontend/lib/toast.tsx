"use client";
import React, { createContext, useContext, useState, useCallback } from "react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    info: (msg: string) => void;
  };
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev.slice(-3), { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  const toast = {
    success: (msg: string) => addToast("success", msg),
    error: (msg: string) => addToast("error", msg),
    info: (msg: string) => addToast("info", msg),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <aside className="toast-portal" aria-live="polite" aria-label="اعلان‌ها">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-card ${t.type}`} role="status">
            <span className="toast-icon">
              {t.type === "success" && "✓"}
              {t.type === "error" && "✕"}
              {t.type === "info" && "ℹ"}
            </span>
            <span className="toast-msg">{t.message}</span>
          </div>
        ))}
      </aside>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback safe dummy
    return {
      toast: {
        success: (m: string) => alert(m),
        error: (m: string) => alert(m),
        info: (m: string) => console.log(m),
      },
    };
  }
  return ctx;
}
