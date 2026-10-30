"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "@/lib/link";
import { api } from "@/lib/api";
import { useBasePath } from "@/lib/basepath";

type Instance = {
  id: number;
  name: string;
  mode: string;
  engine: string;
  status: string;
  uptime: number;
  status_error?: string;
  send_transport: string;
  recv_transport: string;
  remote_addr?: string;
  client_ip?: string;
  tun_address?: string;
  tun_peer?: string;
  spoof_ip?: string;
  peer_spoof_ip?: string;
  remote_port?: number;
  recv_port?: number;
  listen_port?: number;
  client_port?: number;
  enabled: boolean;
};

type Telemetry = { peer_connected: boolean; tx_bytes: number; rx_bytes: number; rtt_ms?: number; drops: number };

const LABEL: Record<string, string> = {
  running: "در حال اجرا",
  stopped: "متوقف",
  starting: "در حال شروع",
  stopping: "در حال توقف",
  error: "خطا",
};

function size(n = 0) {
  if (n < 1024) return `${n} B`;
  const u = ["KB", "MB", "GB"];
  let v = n / 1024, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${u[i]}`;
}

function duration(s = 0) {
  if (!s) return "—";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

export default function TunnelsPage() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [telemetry, setTelemetry] = useState<Record<number, Telemetry>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [toDelete, setToDelete] = useState<Instance | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const base = useBasePath();

  const load = useCallback(async () => {
    try {
      const [list, dash] = await Promise.all([api.listInstances(), api.dashboard()]);
      setInstances(list);
      const map: Record<number, Telemetry> = {};
      for (const d of dash.instances ?? []) if (d.telemetry) map[d.id] = d.telemetry;
      setTelemetry(map);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "دریافت فهرست ناموفق بود");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 4000);
    return () => clearInterval(t);
  }, [load]);

  const action = async (id: number, kind: "start" | "stop" | "restart") => {
    setBusy(id);
    try {
      if (kind === "start") await api.instanceStart(id);
      else if (kind === "stop") await api.instanceStop(id);
      else await api.instanceRestart(id);
      setTimeout(load, 600);
    } catch (e) {
      setError(e instanceof Error ? e.message : "عملیات ناموفق بود");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    try {
      await api.deleteInstance(toDelete.id);
      setToDelete(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "حذف ناموفق بود");
    }
  };

  const importFile = async (file: File) => {
    try {
      const config = JSON.parse(await file.text());
      if (!config || typeof config !== "object") throw new Error("فایل JSON معتبر نیست.");
      delete config.id;
      delete config.created_at;
      delete config.updated_at;
      delete config.status;
      delete config.uptime;
      if (!config.name) config.name = file.name.replace(/\.json$/i, "");
      await api.createInstance(config);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ورود تنظیمات ناموفق بود");
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">CONNECTIONS / 03</div>
          <h1>اتصال‌ها</h1>
          <p className="page-intro">هر اتصال یک رابط TUN و یک شبکهٔ داخلی مستقل دارد. قبل از ویرایش، پردازش را متوقف کن.</p>
        </div>
        <div className="row">
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            ورود فایل JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFile(f);
              e.target.value = "";
            }}
          />
          <Link className="btn btn-primary" href={base + "/dashboard/pair"}>+ اتصال جدید</Link>
        </div>
      </div>

      {error && (
        <div role="alert" className="banner error">
          <span>{error}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setError("")}>بستن</button>
        </div>
      )}

      {loading && <p className="muted">در حال دریافت…</p>}

      {!loading && instances.length === 0 && (
        <div className="empty panel">
          <div className="empty-icon">🔗</div>
          <h3>هنوز اتصالی ثبت نشده</h3>
          <p>با «اتصال جدید» هر دو سمت را بساز، یا فایل JSON سمت مقابل را وارد کن.</p>
          <Link className="btn btn-primary" href={base + "/dashboard/pair"}>ساخت اتصال دوطرفه</Link>
        </div>
      )}

      <div className="cards">
        {instances.map((i) => {
          const t = telemetry[i.id];
          const peer = i.engine === "tun" && !!t?.peer_connected;
          const endpoint = i.mode === "local" ? i.remote_addr : i.client_ip;
          return (
            <article className="panel conn-card" key={i.id}>
              <header className="conn-head">
                <div className="row">
                  <span className={`status-dot ${i.status}`} aria-hidden="true" />
                  <div>
                    <Link className="conn-title" href={`${base}/dashboard/tunnels/edit?id=${i.id}`}>{i.name}</Link>
                    <div className="sub">
                      <span className={`mode-badge ${i.mode}`}>{i.mode === "local" ? "ایران · local" : "خارج · remote"}</span>
                      <span className="mono" dir="ltr">{i.send_transport} → {i.recv_transport}</span>
                    </div>
                  </div>
                </div>
                <span className={`pill ${i.status}`}>{LABEL[i.status] || i.status}</span>
              </header>

              <div className="conn-grid">
                <div><span className="k">طرف مقابل</span><span className="v mono" dir="ltr">{endpoint || "—"}</span></div>
                <div><span className="k">شبکهٔ داخلی</span><span className="v mono" dir="ltr">{i.tun_address || "—"} → {i.tun_peer || "—"}</span></div>
                <div><span className="k">مبدأ جعلی</span><span className="v mono" dir="ltr">{i.spoof_ip || "—"}</span></div>
                <div><span className="k">پورت‌ها</span><span className="v mono" dir="ltr">{i.mode === "local" ? `${i.remote_port}/${i.recv_port}` : `${i.listen_port}/${i.client_port}`}</span></div>
              </div>

              {i.status_error && <div className="inline-error">{i.status_error}</div>}

              <footer className="conn-foot">
                <div className="conn-telemetry">
                  <span className={peer ? "pill ok" : i.status === "running" ? "pill warn" : "pill muted"}>
                    {i.engine !== "tun" ? "رله قدیمی" : peer ? "پاسخ معتبر" : i.status === "running" ? "در انتظار پاسخ" : "بدون ارتباط"}
                  </span>
                  <span className="mono" dir="ltr">↑{size(t?.tx_bytes)} ↓{size(t?.rx_bytes)}</span>
                  {peer && t?.rtt_ms ? <span className="mono" dir="ltr">{Math.round(t.rtt_ms)} ms</span> : null}
                  <span className="mono" dir="ltr">{duration(i.uptime)}</span>
                </div>
                <div className="row">
                  {i.status === "running" ? (
                    <>
                      <button className="btn btn-ghost btn-sm" disabled={busy === i.id} onClick={() => action(i.id, "stop")}>توقف</button>
                      <button className="btn btn-ghost btn-sm" disabled={busy === i.id} onClick={() => action(i.id, "restart")}>راه‌اندازی مجدد</button>
                    </>
                  ) : (
                    <button className="btn btn-primary btn-sm" disabled={busy === i.id} onClick={() => action(i.id, "start")}>
                      {busy === i.id ? "…" : "راه‌اندازی"}
                    </button>
                  )}
                  <Link className="btn btn-ghost btn-sm" href={`${base}/dashboard/tunnels/edit?id=${i.id}`}>تنظیمات</Link>
                  <button className="btn btn-ghost btn-sm danger-text" onClick={() => setToDelete(i)} aria-label={`حذف ${i.name}`}>حذف</button>
                </div>
              </footer>
            </article>
          );
        })}
      </div>

      {toDelete && (
        <div className="modal-overlay" onClick={() => setToDelete(null)}>
          <div className="modal-content" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>حذف اتصال</h2>
            <p className="page-intro">
              «{toDelete.name}» و تنظیمات محلی آن حذف می‌شود. سمت مقابل جداگانه باید حذف شود.
            </p>
            <div className="row end">
              <button className="btn btn-ghost" onClick={() => setToDelete(null)}>انصراف</button>
              <button className="btn btn-danger" onClick={remove}>حذف قطعی</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
