"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { getBasePath, useBasePath } from "@/lib/basepath";
import { useToast } from "@/lib/toast";
import { IconPlay, IconStop, IconRestart, IconDownload } from "@/lib/icons";

const CARRIERS = [
  { value: "icmp", label: "ICMP Echo (پیشنهادی)" },
  { value: "tcp", label: "TCP خام (PSH/ACK)" },
  { value: "udp", label: "UDP Datagram" },
  { value: "ipip", label: "پروتکل ۴ (IPIP)" },
  { value: "experimental", label: "پروتکل ۲۵۳ (آزمایشی)" },
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
  const { toast } = useToast();

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
      toast.success("تنظیمات اتصال با موفقیت ذخیره شد.");
      setNotice("تنظیمات ذخیره شد. برای اعمال، تونل را دوباره راه‌اندازی کن.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ذخیره ناموفق بود";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const saveIPs = async () => {
    setError("");
    try {
      const r = await api.setInstanceSpoofIPs(id, spoofIPs);
      setSavedIPs(true);
      toast.success(`${r.count} آدرس مبدأ جعلی با موفقیت ذخیره شد.`);
      setNotice(`${r.count} آدرس ذخیره شد. برای اعمال، تونل را دوباره راه‌اندازی کن.`);
      setTimeout(() => setSavedIPs(false), 1800);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "ذخیرهٔ فهرست ناموفق بود";
      setError(msg);
      toast.error(msg);
    }
  };

  const control = async (kind: "start" | "stop" | "restart") => {
    setError("");
    try {
      if (kind === "start") {
        await api.instanceStart(id);
        toast.success("اتصال راه‌اندازی شد.");
      } else if (kind === "stop") {
        await api.instanceStop(id);
        toast.info("اتصال متوقف شد.");
      } else {
        await api.instanceRestart(id);
        toast.success("اتصال مجدداً راه‌اندازی شد.");
      }
      setTimeout(() => void load(false), 700);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "عملیات ناموفق بود";
      setError(msg);
      toast.error(msg);
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
    toast.success("فایل تنظیمات اتصال دانلود شد.");
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
            {isTun ? "هستهٔ L3: بسته‌های کامل TCP، UDP و ICMP از طریق رابط TUN منتقل می‌شوند." : "موتور قدیمی UDP relay."}
          </p>
        </div>
        <div className="row">
          <button className="btn btn-ghost" onClick={() => router.push(getBasePath() + "/dashboard/tunnels")}>
            ← بازگشت به اتصال‌ها
          </button>
          {running ? (
            <>
              <button className="btn btn-ghost" onClick={() => control("stop")}>
                <IconStop size={12} />
                <span>توقف</span>
              </button>
              <button className="btn btn-ghost" onClick={() => control("restart")}>
                <IconRestart size={12} />
                <span>راه‌اندازی مجدد</span>
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={() => control("start")}>
              <IconPlay size={12} />
              <span>راه‌اندازی اتصال</span>
            </button>
          )}
        </div>
      </div>

      {statusError && <div role="alert" className="banner error">{statusError}</div>}
      {error && <div role="alert" className="banner error">{error}</div>}
      {notice && <div role="status" className="banner ok">{notice}</div>}

      <div className="tabs" role="tablist">
        {([
          ["config", "تنظیمات اتصال"],
          ["ips", "استخر IPهای اسپوف"],
          ["logs", "لاگ زندهٔ تونل"],
        ] as const).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "config" && (
        <>
          {locked && <div className="banner warn">برای تغییر تنظیمات، ابتدا دکمهٔ «توقف» را بزنید.</div>}

          <div className="grid-2">
            <section className="panel">
              <h2>هویت و راه‌اندازی</h2>
              <div className="stack">
                <Field label="نام اتصال">
                  <input className="input" value={String(config.name ?? "")} disabled={locked} onChange={(e) => set("name", e.target.value)} maxLength={100} />
                </Field>
                <Field label="شروع خودکار">
                  <label className="switch-row">
                    <input type="checkbox" checked={!!config.enabled} disabled={locked} onChange={(e) => set("enabled", e.target.checked)} />
                    <span>اجرای خودکار هنگام بوت شدن پنل</span>
                  </label>
                </Field>
                <Field label="کلید رمزنگاری مشترک (PSK)" hint="کلید ۳۲ بایتی محرمانه داخل فایل دانلود است.">
                  <input className="input mono" dir="ltr" value="••••••••••••••••••••••••••••••••" readOnly />
                </Field>
              </div>
            </section>

            <section className="panel">
              <h2>پروتکل‌های حامل و پورت‌ها</h2>
              <div className="stack">
                <Field label="حامل ارسال (Upload Carrier)">
                  <select className="input" value={String(config.send_transport ?? "icmp")} disabled={locked} onChange={(e) => set("send_transport", e.target.value)}>
                    {CARRIERS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </Field>
                <Field label="حامل دریافت (Download Carrier)" hint="باید با حامل ارسال طرف مقابل هم‌خوان باشد.">
                  <select className="input" value={String(config.recv_transport ?? "icmp")} disabled={locked} onChange={(e) => set("recv_transport", e.target.value)}>
                    {CARRIERS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </Field>
                <div className="grid-2 tight">
                  <Field label={isLocal ? "پورت دریافت خارج" : "پورت دریافت این سرور"}>
                    <input className="input mono" dir="ltr" type="number" min={1} max={65535}
                      value={Number(isLocal ? config.remote_port : config.listen_port) || ""}
                      disabled={locked}
                      onChange={(e) => set(isLocal ? "remote_port" : "listen_port", Number(e.target.value))} />
                  </Field>
                  <Field label={isLocal ? "پورت دریافت ایران" : "پورت دریافت طرف مقابل"}>
                    <input className="input mono" dir="ltr" type="number" min={1} max={65535}
                      value={Number(isLocal ? config.recv_port : config.client_port) || ""}
                      disabled={locked}
                      onChange={(e) => set(isLocal ? "recv_port" : "client_port", Number(e.target.value))} />
                  </Field>
                </div>
              </div>
            </section>

            <section className="panel">
              <h2>آدرس‌های واقعی دو سرور</h2>
              <div className="stack">
                <Field label="IP واقعی سرور محلی" hint="مقصد بسته‌ها و بایند سوکت خام.">
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
              <h2>آدرس‌های مبدأ جعلی (Spoof)</h2>
              <div className="stack">
                <Field label="مبدأ جعلی این سمت" hint="برای گردش بین چند IP از تب «استخر IPهای اسپوف» استفاده کن.">
                  <input className="input mono" dir="ltr" value={String(config.spoof_ip ?? "")} disabled={locked} onChange={(e) => set("spoof_ip", e.target.value)} />
                </Field>
                <Field label="مبدأ جعلی مورد انتظار طرف مقابل">
                  <input className="input mono" dir="ltr" value={String(config.peer_spoof_ip ?? "")} disabled={locked} onChange={(e) => set("peer_spoof_ip", e.target.value)} />
                </Field>
              </div>
            </section>

            {isTun && (
              <section className="panel">
                <h2>پیکربندی رابط TUN مجازی</h2>
                <div className="stack">
                  <Field label="نام رابط سیستم (Network Interface)" hint="۱ تا ۱۵ کاراکتر (مثلاً sptest0).">
                    <input className="input mono" dir="ltr" value={String(config.tun_interface ?? "")} disabled={locked} onChange={(e) => set("tun_interface", e.target.value)} />
                  </Field>
                  <div className="grid-2 tight">
                    <Field label="IP داخلی این سمت">
                      <input className="input mono" dir="ltr" value={String(config.tun_address ?? "")} disabled={locked} onChange={(e) => set("tun_address", e.target.value)} />
                    </Field>
                    <Field label="IP داخلی طرف مقابل">
                      <input className="input mono" dir="ltr" value={String(config.tun_peer ?? "")} disabled={locked} onChange={(e) => set("tun_peer", e.target.value)} />
                    </Field>
                  </div>
                  <Field label="MTU رابط TUN" hint="محدوده ۵۷۶ تا ۱۳۰۰ بایت (پیشنهادی: ۱۲۸۰).">
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
            <button className="btn btn-ghost" onClick={download}>
              <IconDownload size={14} />
              <span>دانلود فایل کانفیگ JSON</span>
            </button>
            <button className="btn btn-primary" disabled={saving || locked} onClick={save}>
              {saving ? "در حال ذخیره‌سازی…" : "ذخیرهٔ تنظیمات اتصال"}
            </button>
          </div>
        </>
      )}

      {tab === "ips" && (
        <section className="panel">
          <div className="section-head">
            <div>
              <h2>استخر آدرس‌های جعلی گردشی (Multi-Spoof)</h2>
              <span className="hint">
                تعداد: {spoofIPs.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#")).length} آدرس فعال
              </span>
            </div>
            <button className="btn btn-primary btn-sm" onClick={saveIPs} disabled={running}>
              {savedIPs ? "ذخیره شد ✓" : "ذخیرهٔ استخر IP"}
            </button>
          </div>
          <p className="page-intro">
            هستهٔ تونل L3 در هنگام ارسال بسته‌ها به صورت گردشی (Round-Robin) بدون توقف از این آدرس‌ها به عنوان مبدأ جعلی استفاده می‌کند.
            فقط یک آدرس IPv4 در هر خط بنویس؛ پیشوند CIDR و بازهٔ خط فاصله اینجا پشتیبانی نمی‌شود و ذخیرهٔ آن‌ها باعث خطا در شروع تونل می‌شود. برای آزمون گستره‌های بزرگ، از صفحهٔ «آزمون اسپوف» استفاده کن که CIDR و بازه را می‌پذیرد.
          </p>
          <textarea
            className="input mono"
            dir="ltr"
            rows={14}
            value={spoofIPs}
            disabled={running}
            onChange={(e) => setSpoofIPs(e.target.value)}
            placeholder={"198.51.100.10\n203.0.113.5\n203.0.113.6"}
            spellCheck={false}
          />
          {running && <p className="hint" style={{ color: "var(--accent-amber)" }}>تونل در حال حاضر فعال است؛ برای ذخیرهٔ لیست جدید ابتدا اتصال را متوقف کنید.</p>}
        </section>
      )}

      {tab === "logs" && (
        <section className="panel">
          <div className="section-head">
            <div>
              <h2>لاگ زندهٔ پروسهٔ تانل</h2>
              <span className="hint">جریان لاگ‌های زندهٔ سوکت خام، هندشیک‌ها و خطاهای هسته.</span>
            </div>
            <div className="row">
              <span className={`pill ${wsState === "live" ? "ok" : wsState === "retry" ? "warn" : "muted"}`}>
                {wsState === "live" ? "● سوکت فعال" : wsState === "retry" ? "اتصال مجدد…" : "غیرفعال"}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => setLogs([])}>پاک کردن لاگ</button>
            </div>
          </div>
          <div className="log-viewer" dir="ltr">
            {logs.length === 0 && <div className="muted">در حال حاضر لاگی ثبت نشده است. با راه‌اندازی اتصال، لاگ‌های خروجی اینجا نمایش داده می‌شوند.</div>}
            {logs.map((line, i) => (
              <div key={`${i}-${line.slice(0, 14)}`} className={/error|fatal|panic/i.test(line) ? "log-error" : /warn/i.test(line) ? "log-warn" : ""}>
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
