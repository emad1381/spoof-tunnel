"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { getBasePath, useBasePath } from "@/lib/basepath";

const CARRIERS = [
  { value: "icmp", label: "ICMP (پیشنهادی)" },
  { value: "tcp", label: "TCP خام" },
  { value: "udp", label: "UDP" },
  { value: "ipip", label: "پروتکل ۴" },
  { value: "experimental", label: "پروتکل ۲۵۳" },
];

type Instance = Record<string, string | number | boolean | null | undefined>;

const STATUS: Record<string, string> = {
  running: "در حال اجرا",
  stopped: "متوقف",
  starting: "در حال شروع",
  stopping: "در حال توقف",
  error: "خطا",
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small className="hint">{hint}</small>}
    </label>
  );
}

function EditContent() {
  const params = useSearchParams();
  const router = useRouter();
  const id = Number(params.get("id"));
  const base = useBasePath();

  const [config, setConfig] = useState<Instance | null>(null);
  const [status, setStatus] = useState("stopped");
  const [uptime, setUptime] = useState(0);
  const [statusError, setStatusError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"config" | "ips" | "logs">("config");
  const [spoofIPs, setSpoofIPs] = useState("");
  const [savedIPs, setSavedIPs] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [wsState, setWsState] = useState<"off" | "live" | "retry">("off");
  const logEnd = useRef<HTMLDivElement>(null);

  const load = useCallback(async (full = true) => {
    if (!id) return;
    try {
      const data = await api.getInstance(id);
      if (full) setConfig(data.instance);
      setStatus(data.status);
      setUptime(data.uptime);
      setStatusError(data.error || "");
    } catch {
      router.replace(base + "/dashboard/tunnels");
    }
  }, [id, base, router]);

  useEffect(() => {
    if (!id) {
      router.replace(getBasePath() + "/dashboard/tunnels");
      return;
    }
    void load(true);
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void load(false);
    }, 3000);
    return () => clearInterval(t);
  }, [id, load, router]);

  useEffect(() => {
    if (!id) return;
    api.getInstanceSpoofIPs(id).then((d) => setSpoofIPs(d.content || "")).catch(() => {});
  }, [id]);

  // Live logs over WebSocket
  useEffect(() => {
    if (tab !== "logs" || !id) return;
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const token = localStorage.getItem("token") || "";
      const url = `${proto}//${window.location.host}${getBasePath()}/api/instances/${id}/logs?token=${encodeURIComponent(token)}`;
      ws = new WebSocket(url);
      ws.onopen = () => setWsState("live");
      ws.onmessage = (ev) => setLogs((prev) => [...prev.slice(-800), String(ev.data)]);
      ws.onclose = () => {
        if (closed) return;
        setWsState("retry");
        timer = setTimeout(connect, 2500);
      };
    };
    connect();
    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      ws?.close();
      setWsState("off");
    };
  }, [tab, id]);

  useEffect(() => {
    logEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const set = (key: string, value: string | number | boolean) =>
    setConfig((c) => (c ? { ...c, [key]: value } : c));

  const save = async () => {
    if (!config) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api.updateInstance(id, config);
      setNotice("تنظیمات ذخیره شد. برای اعمال، تونل را دوباره راه‌اندازی کن.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیره ناموفق بود");
    } finally {
      setSaving(false);
    }
  };

  const saveIPs = async () => {
    setError("");
    try {
      const r = await api.setInstanceSpoofIPs(id, spoofIPs);
      setSavedIPs(true);
      setSpoofIPs((v) => v);
      setNotice(`${r.count} آدرس ذخیره شد. برای اعمال، تونل را دوباره راه‌اندازی کن.`);
      setTimeout(() => setSavedIPs(false), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ذخیرهٔ فهرست ناموفق بود");
    }
  };

  const control = async (kind: "start" | "stop" | "restart") => {
    setError("");
    try {
      if (kind === "start") await api.instanceStart(id);
      else if (kind === "stop") await api.instanceStop(id);
      else await api.instanceRestart(id);
      setTimeout(() => void load(false), 700);
    } catch (e) {
      setError(e instanceof Error ? e.message : "عملیات ناموفق بود");
    }
  };

  const download = () => {
    if (!config) return;
    const payload = { ...config };
    delete payload.status;
    delete payload.uptime;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${String(config.name || "tunnel").replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!config) return <div className="page"><p className="muted">در حال دریافت تنظیمات…</p></div>;

  const isTun = config.engine === "tun";
  const isLocal = config.mode === "local";
  const running = status === "running";
  const locked = running || status === "stopping";

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">CONNECTION / SETTINGS</div>
          <div className="row">
            <h1>{String(config.name || "اتصال")}</h1>
            <span className={`pill ${status}`}>{STATUS[status] || status}</span>
          </div>
          <p className="page-intro">
            {isTun ? "هستهٔ L3: ترافیک TCP، UDP و ICMP از رابط TUN عبور می‌کند." : "موتور قدیمی UDP relay؛ برای امکانات کامل یک اتصال TUN بساز."}
          </p>
        </div>
        <div className="row">
          <button className="btn btn-ghost" onClick={() => router.push(getBasePath() + "/dashboard/tunnels")}>بازگشت</button>
          {running ? (
            <>
              <button className="btn btn-ghost" onClick={() => control("stop")}>توقف</button>
              <button className="btn btn-ghost" onClick={() => control("restart")}>راه‌اندازی مجدد</button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={() => control("start")}>راه‌اندازی</button>
          )}
        </div>
      </div>

      {statusError && <div role="alert" className="banner error">{statusError}</div>}
      {error && <div role="alert" className="banner error">{error}</div>}
      {notice && <div role="status" className="banner ok">{notice}</div>}

      <div className="tabs" role="tablist">
        {([
          ["config", "تنظیمات"],
          ["ips", "IPهای اسپوف"],
          ["logs", "لاگ زنده"],
        ] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "config" && (
        <>
          {locked && <div className="banner warn">برای ویرایش، ابتدا پردازش را متوقف کن.</div>}

          <div className="grid-2">
            <section className="panel">
              <h2>هویت</h2>
              <div className="stack">
                <Field label="نام اتصال">
                  <input className="input" value={String(config.name ?? "")} disabled={locked} onChange={(e) => set("name", e.target.value)} maxLength={100} />
                </Field>
                <Field label="شروع خودکار با پنل">
                  <label className="switch-row">
                    <input type="checkbox" checked={!!config.enabled} disabled={locked} onChange={(e) => set("enabled", e.target.checked)} />
                    <span>این اتصال هنگام بالا آمدن پنل اجرا شود</span>
                  </label>
                </Field>
                <Field label="کلید مشترک (PSK)" hint="کلید در فایل خروجی است؛ آن را منتشر نکن.">
                  <input className="input mono" dir="ltr" value="••••••••••••••••" readOnly />
                </Field>
              </div>
            </section>

            <section className="panel">
              <h2>حامل‌ها و پورت‌ها</h2>
              <div className="stack">
                <Field label="حامل ارسال">
                  <select className="input" value={String(config.send_transport ?? "icmp")} disabled={locked} onChange={(e) => set("send_transport", e.target.value)}>
                    {CARRIERS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </Field>
                <Field label="حامل دریافت" hint="باید معکوس حامل ارسال طرف مقابل باشد.">
                  <select className="input" value={String(config.recv_transport ?? "icmp")} disabled={locked} onChange={(e) => set("recv_transport", e.target.value)}>
                    {CARRIERS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </Field>
                <div className="grid-2 tight">
                  <Field label={isLocal ? "پورت دریافت طرف مقابل" : "پورت دریافت این سرور"}>
                    <input className="input mono" dir="ltr" type="number" min={1} max={65535}
                      value={Number(isLocal ? config.remote_port : config.listen_port) || ""}
                      disabled={locked}
                      onChange={(e) => set(isLocal ? "remote_port" : "listen_port", Number(e.target.value))} />
                  </Field>
                  <Field label={isLocal ? "پورت دریافت این سرور" : "پورت دریافت طرف مقابل"}>
                    <input className="input mono" dir="ltr" type="number" min={1} max={65535}
                      value={Number(isLocal ? config.recv_port : config.client_port) || ""}
                      disabled={locked}
                      onChange={(e) => set(isLocal ? "recv_port" : "client_port", Number(e.target.value))} />
                  </Field>
                </div>
              </div>
            </section>

            <section className="panel">
              <h2>آدرس‌های واقعی</h2>
              <div className="stack">
                <Field label="IP واقعی این سرور" hint="مقصد بسته‌ها و مبنای سوکت خام.">
                  <input className="input mono" dir="ltr" value={String(config.local_ip ?? "")} disabled={locked} onChange={(e) => set("local_ip", e.target.value)} />
                </Field>
                <Field label="IP واقعی طرف مقابل">
                  <input className="input mono" dir="ltr"
                    value={String((isLocal ? config.remote_addr : config.client_ip) ?? "")}
                    disabled={locked}
                    onChange={(e) => set(isLocal ? "remote_addr" : "client_ip", e.target.value)} />
                </Field>
              </div>
            </section>

            <section className="panel">
              <h2>مبدأ جعلی</h2>
              <div className="stack">
                <Field label="مبدأ جعلی این سمت" hint={isTun ? "برای چند IP از تب «IPهای اسپوف» استفاده کن." : ""}>
                  <input className="input mono" dir="ltr" value={String(config.spoof_ip ?? "")} disabled={locked} onChange={(e) => set("spoof_ip", e.target.value)} />
                </Field>
                <Field label="مبدأ جعلی مورد انتظار طرف مقابل" hint="بسته‌های دیگر IPها دور ریخته می‌شوند.">
                  <input className="input mono" dir="ltr" value={String(config.peer_spoof_ip ?? "")} disabled={locked} onChange={(e) => set("peer_spoof_ip", e.target.value)} />
                </Field>
              </div>
            </section>

            {isTun && (
              <section className="panel">
                <h2>رابط TUN</h2>
                <div className="stack">
                  <Field label="نام رابط" hint="۱ تا ۱۵ کاراکتر، با حرف شروع شود.">
                    <input className="input mono" dir="ltr" value={String(config.tun_interface ?? "")} disabled={locked} onChange={(e) => set("tun_interface", e.target.value)} />
                  </Field>
                  <div className="grid-2 tight">
                    <Field label="آدرس داخلی این سمت">
                      <input className="input mono" dir="ltr" value={String(config.tun_address ?? "")} disabled={locked} onChange={(e) => set("tun_address", e.target.value)} />
                    </Field>
                    <Field label="آدرس داخلی طرف مقابل">
                      <input className="input mono" dir="ltr" value={String(config.tun_peer ?? "")} disabled={locked} onChange={(e) => set("tun_peer", e.target.value)} />
                    </Field>
                  </div>
                  <Field label="MTU" hint="۵۷۶ تا ۱۳۰۰؛ برای مسیرهای پرافت ۱۲۸۰ امن است.">
                    <input className="input mono" dir="ltr" type="number" min={576} max={1300}
                      value={Number(config.tun_mtu) || ""}
                      disabled={locked}
                      onChange={(e) => set("tun_mtu", Number(e.target.value))} />
                  </Field>
                </div>
              </section>
            )}
          </div>

          <div className="row end sticky-actions">
            <button className="btn btn-ghost" onClick={download}>دانلود تنظیمات</button>
            <button className="btn btn-primary" disabled={saving || locked} onClick={save}>
              {saving ? "در حال ذخیره…" : "ذخیرهٔ تنظیمات"}
            </button>
          </div>
        </>
      )}

      {tab === "ips" && (
        <section className="panel">
          <div className="section-head">
            <h2>فهرست IPهای مبدأ جعلی <small className="muted">({spoofIPs.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#")).length} آدرس)</small></h2>
            <button className="btn btn-primary btn-sm" onClick={saveIPs} disabled={running}>
              {savedIPs ? "ذخیره شد" : "ذخیرهٔ فهرست"}
            </button>
          </div>
          <p className="page-intro">
            هر خط یک IP، CIDR یا بازه. هستهٔ L3 این آدرس‌ها را به‌صورت گردشی (round-robin) روی بسته‌های ارسالی استفاده می‌کند.
            برای اعمال، تونل را دوباره راه‌اندازی کن. حداقل یک آدرس باید با «مبدأ جعلی این سمت» هم‌خوان باشد.
          </p>
          <textarea
            className="input mono"
            dir="ltr"
            rows={14}
            value={spoofIPs}
            disabled={running}
            onChange={(e) => setSpoofIPs(e.target.value)}
            placeholder={"198.51.100.10\n198.51.100.0/28\n203.0.113.5-203.0.113.20"}
            spellCheck={false}
          />
          {running && <p className="hint">پردازش در حال اجراست؛ برای ویرایش فهرست ابتدا آن را متوقف کن.</p>}
        </section>
      )}

      {tab === "logs" && (
        <section className="panel">
          <div className="section-head">
            <h2>لاگ زنده</h2>
            <div className="row">
              <span className={`pill ${wsState === "live" ? "ok" : wsState === "retry" ? "warn" : "muted"}`}>
                {wsState === "live" ? "متصل" : wsState === "retry" ? "اتصال مجدد…" : "غیرفعال"}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => setLogs([])}>پاک کردن</button>
            </div>
          </div>
          <div className="log-viewer" dir="ltr">
            {logs.length === 0 && <div className="muted">هنوز لاگی ثبت نشده است. تونل را راه‌اندازی کن.</div>}
            {logs.map((line, i) => (
              <div key={`${i}-${line.slice(0, 12)}`} className={/error|fatal|panic/i.test(line) ? "log-error" : /warn/i.test(line) ? "log-warn" : ""}>
                {line}
              </div>
            ))}
            <div ref={logEnd} />
          </div>
        </section>
      )}
    </div>
  );
}

export default function EditPage() {
  return (
    <Suspense fallback={<div className="page"><p className="muted">در حال بارگذاری…</p></div>}>
      <EditContent />
    </Suspense>
  );
}
