"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "@/lib/link";
import { getBasePath, useBasePath } from "@/lib/basepath";
import { ThemeToggle } from "@/lib/theme";
import {
  IconDashboard,
  IconPair,
  IconTunnels,
  IconTester,
  IconSettings,
  IconLogout,
  IconShield,
} from "@/lib/icons";

const NAV_ITEMS = [
  { path: "/dashboard", icon: IconDashboard, label: "نمای کلی", exact: true },
  { path: "/dashboard/pair", icon: IconPair, label: "ساخت اتصال" },
  { path: "/dashboard/tunnels", icon: IconTunnels, label: "اتصال‌ها" },
  { path: "/dashboard/tester", icon: IconTester, label: "آزمون اسپوف" },
  { path: "/dashboard/settings", icon: IconSettings, label: "تنظیمات" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const basePath = useBasePath();

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      window.location.replace(getBasePath() + "/login");
    }
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const logout = () => {
    localStorage.removeItem("token");
    window.location.replace(getBasePath() + "/login");
  };

  return (
    <div className="app-layout">
      <header className="top-bar">
        <div className="top-bar-start">
          <button
            className="hamburger-btn"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="باز و بستن منو"
            aria-expanded={mobileOpen}
          >
            <span className={`hamburger-icon ${mobileOpen ? "open" : ""}`}>
              <span />
              <span />
              <span />
            </span>
          </button>
          <div className="brand-mark">SP</div>
          <div className="brand-copy">
            <strong>Spoof Tunnel</strong>
            <span className="mono" style={{ fontSize: 11, color: "var(--accent-cyan)", opacity: 0.9 }}>v0.2.0</span>
          </div>
        </div>
        <div className="header-actions">
          <ThemeToggle />
          <a
            className="header-link-btn"
            href="https://github.com/emad1381/spoof-tunnel"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            <span className="hide-mobile">GitHub</span>
          </a>
          <button className="header-link-btn" onClick={logout} title="خروج از حساب">
            <IconLogout size={15} />
            <span className="hide-mobile">خروج</span>
          </button>
        </div>
      </header>

      <div className="app-body">
        {mobileOpen && <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />}

        <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`} aria-label="منوی اصلی">
          <nav className="sidebar-nav">
            {NAV_ITEMS.map((item) => {
              const href = basePath + item.path;
              const active = item.exact
                ? pathname === href || pathname === item.path
                : pathname === href || pathname?.startsWith(href + "/") || pathname?.startsWith(item.path + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  href={href}
                  className={`sidebar-item ${active ? "active" : ""}`}
                  onClick={() => setMobileOpen(false)}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="nav-icon" aria-hidden="true"><Icon size={18} /></span>
                  <span className="nav-label">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="sidebar-foot">
            <button
              className="sidebar-item hide-mobile"
              onClick={() => setCollapsed(!collapsed)}
              type="button"
            >
              <span className="nav-icon" aria-hidden="true" style={{ fontSize: 13 }}>{collapsed ? "◀" : "▶"}</span>
              {!collapsed && <span className="nav-label">جمع کردن منو</span>}
            </button>
            <a
              className="sidebar-item"
              href="https://github.com/emad1381/spoof-tunnel#readme"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="nav-icon" aria-hidden="true"><IconShield size={16} /></span>
              <span className="nav-label">مستندات و امنیت</span>
            </a>
          </div>
        </aside>

        <main className="main-content">{children}</main>
      </div>

      <footer className="app-footer">
        <span>Spoof Tunnel — هستهٔ L3 احراز هویت‌شده با رمزنگاری سرتاسری</span>
        <span>Apache-2.0 · منبع‌باز در گیت‌هاب</span>
      </footer>
    </div>
  );
}
