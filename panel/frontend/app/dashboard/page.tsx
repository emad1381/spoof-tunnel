"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "@/lib/link";
import { api } from "@/lib/api";
import { useBasePath } from "@/lib/basepath";

type Telemetry = {
  peer_connected: boolean;
  tx_bytes: number;
  rx_bytes: number;
  tx_packets?: number;
  rx_packets?: number;
  drops: number;
  last_peer: number;
  rtt_ms?: number;
};

type Instance = {
  id: number;
  name: string;
  mode: string;
  status: string;
  uptime: number;
  error?: string;
  engine: string;
  telemetry?: Telemetry;
};

type Dash = {
  total: number;
  running_count: number;
  stopped_count: number;
  error_count: number;
  instances: Instance[] | null;
};

type System = { hostname: string; os: string; arch: string; memory_mb: number; cpus: number; go_version?: string };

const STATUS_LABEL: Record<string, string> = {
  running: "در حال اجرا",
  stopped: "متوقف",
  starting: "در حال شروع",
  stopping: "در حال توقف",
  error: "خطا",
};

function bytes(n = 0): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

function uptime(seconds = 0): string {
  if (seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h} ساعت ${m} دقیقه` : `${m} دقیقه`;
}

const fa = (n: number) => n.toLocaleString("fa-IR");

export default function Dashboard() {
  const [dash, setDash] = useState<Dash | null>(null);
  const [sys, setSys] = useState<System | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [updated, setUpdated] = useState("");
  const base = useBasePath();

  const refresh = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([api.dashboard(), api.system()]);
      setDash(d);
      setSys(s);
      setError("");
      setUpdated(new Date().toLocaleTimeString("fa-IR"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "دریافت وضعیت ناموفق بود");
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  async function toggle(i: Instance) {
    setBusy(i.id);
    try {
      if (i.status === "running") await api.instanceStop(i.id);
      else await api.instanceStart(i.id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "عملیات ناموفق بود");
    } finally {
      setBusy(null);
    }
  }

  const instances = dash?.instances ?? [];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">NETWORK OPERATIONS / 01</div>
          <h1>کنترل مسیر، در یک نگاه.</h1>
          <p className="page-intro">وضعیت پردازش تونل‌ها، ارتباط احرازشدهٔ طرف مقابل و ترافیک این سرور.</p>
        </div>
        <Link className="btn btn-primary" href={base + "/dashboard/pair"}>
          + اتصال دوطرفه
        </Link>
      </div>

      {error && (
        <div role="alert" className="banner error">
          <span>{error}</span>
          <button className="btn btn-ghost btn-sm" onClick={refresh}>تلاش دوباره</button>
        </div>
      )}

      <div className="stats">
        {[
          ["کل اتصال‌ها", dash?.total, "01"],
          ["در حال اجرا", dash?.running_count, "02"],
          ["متوقف", dash?.stopped_count, "03"],
          ["نیازمند بررسی", dash?.error_count, "04"],
        ].map(([label, value, idx]) => (
          <div className="stat" key={String(idx)}>
            <span className="stat-index">{idx}</span>
            <span className="stat-label">{label}</span>
            <strong className="stat-value">{value === undefined ? "—" : fa(Number(value))}</strong>
          </div>
        ))}
      </div>

      <section className="panel">
        <div className="section-head">
          <h2>اتصال‌های این سرور</h2>
          <span className="live-label">
            <span className={`status-dot ${error ? "stopped" : "running"}`} />
            {updated ? `به‌روزرسانی ${updated}` : "در حال دریافت…"}
          </span>
        </div>

        {!dash && !error && <p className="muted">در حال دریافت وضعیت سرور…</p>}

        {dash && instances.length === 0 && (
          <div className="empty">
            <div className="empty-icon">↔</div>
            <h3>هنوز مسیری ساخته نشده</h3>
            <p>آدرس واقعی و مبدأ جعلی دو سرور را وارد کن تا تنظیمات مکمل ساخته شود.</p>
            <div className="row center">
              <Link className="btn btn-primary" href={base + "/dashboard/pair"}>ساخت اتصال</Link>
              <Link className="btn btn-ghost" href={base + "/dashboard/tunnels"}>ورود فایل تنظیمات</Link>
            </div>
          </div>
        )}

        {instances.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>نام / نقش</th>
                  <th>پردازش</th>
                  <th>ارتباط دوطرفه</th>
                  <th>ترافیک</th>
                  <th>تأخیر</th>
                  <th>اجرا</th>
                  <th>کنترل</th>
                </tr>
              </thead>
              <tbody>
                {instances.map((i) => {
                  const t = i.telemetry;
                  const peer = i.engine === "tun" ? !!t?.peer_connected : false;
                  return (
                    <tr key={i.id}>
                      <td>
                        <Link className="row-link" href={base + `/dashboard/tunnels/edit?id=${i.id}`}>{i.name}</Link>
                        <div className="sub">
                          <span className={`mode-badge ${i.mode}`}>{i.mode === "local" ? "ایران" : "خارج"}</span>
                          <span className="mono">{i.engine === "tun" ? "L3" : "UDP"}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`pill ${i.status}`}>{STATUS_LABEL[i.status] || i.status}</span>
                        {i.error && <div className="inline-error" title={i.error}>{i.error}</div>}
                      </td>
                      <td>
                        {i.engine !== "tun" ? (
                          <span className="pill muted">رله قدیمی</span>
                        ) : peer ? (
                          <span className="pill ok">پاسخ معتبر</span>
                        ) : (
                          <span className={`pill ${i.status === "running" ? "warn" : "muted"}`}>
                            {i.status === "running" ? "در انتظار پاسخ" : "—"}
                          </span>
                        )}
                      </td>
                      <td className="mono" dir="ltr">
                        ↑ {bytes(t?.tx_bytes)}<br />↓ {bytes(t?.rx_bytes)}
                        {!!t?.drops && <div className="drop-note">{fa(t.drops)} drop</div>}
                      </td>
                      <td className="mono">{peer && t?.rtt_ms ? `${fa(Math.round(t.rtt_ms))} ms` : "—"}</td>
                      <td className="mono">{uptime(i.uptime)}</td>
                      <td>
                        <div className="row">
                          <button
                            className={`btn btn-sm ${i.status === "running" ? "btn-ghost" : "btn-primary"}`}
                            disabled={busy === i.id || i.status === "stopping" || i.status === "starting"}
                            onClick={() => toggle(i)}
                          >
                            {busy === i.id ? "…" : i.status === "running" ? "توقف" : "راه‌اندازی"}
                          </button>
                          <Link className="btn btn-ghost btn-sm" href={base + `/dashboard/tunnels/edit?id=${i.id}`}>تنظیمات</Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid-2-1">
        <section className="route-card">
          <div className="eyebrow">HOW TRAFFIC FLOWS</div>
          <h2>مقصد واقعی، مبدأ قابل انتخاب.</h2>
          <div className="path" dir="ltr">
            <span>TCP / UDP / ICMP</span><b>→</b><span>Local</span><b>⇄</b><span>Remote</span><b>→</b><span>Peer TUN</span>
          </div>
          <p>
            «پاسخ معتبر» یعنی بستهٔ challenge طرف مقابل با کلید مشترک تأیید شده است؛ نه اینکه سرویس یا اینترنت شما سالم است.
            اگر پاسخ نمی‌رسد، فایل سمت مقابل، حامل‌های رفت و برگشت، پورت‌های دریافت و پذیرش spoof در دیتاسنتر را بررسی کن.
          </p>
        </section>

        <section className="panel">
          <div className="eyebrow">HOST TELEMETRY</div>
          <h2>{sys?.hostname || "سرور"}</h2>
          <dl className="host-info">
            <dt>سیستم</dt><dd dir="ltr">{sys ? `${sys.os} / ${sys.arch}` : "—"}</dd>
            <dt>پردازنده</dt><dd>{sys?.cpus ?? "—"} هسته</dd>
            <dt>حافظهٔ پنل</dt><dd>{sys ? `${sys.memory_mb} MB` : "—"}</dd>
            <dt>نسخهٔ Go</dt><dd dir="ltr">{sys?.go_version ?? "—"}</dd>
          </dl>
        </section>
      </div>
    </div>
  );
}
