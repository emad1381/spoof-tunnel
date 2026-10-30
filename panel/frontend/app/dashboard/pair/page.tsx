"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "@/lib/link";
import { api } from "@/lib/api";
import { useBasePath } from "@/lib/basepath";

type End = Record<string, string | number | boolean>;

const CARRIERS = [
  { value: "icmp", label: "ICMP" },
  { value: "tcp", label: "TCP خام" },
  { value: "udp", label: "UDP" },
  { value: "ipip", label: "پروتکل ۴" },
  { value: "experimental", label: "پروتکل ۲۵۳" },
];

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

function suggestSubnet(used: string[]): string {
  for (let c = 0; c < 250; c++) {
    const base = `10.77.${c}.0/30`;
    if (!used.includes(base)) return base;
  }
  return `10.88.${Math.floor(Math.random() * 250)}.0/30`;
}

function download(name: string, config: End) {
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PairPage() {
  const base = useBasePath();
  const [form, setForm] = useState({
    engine: "tun",
    auto_start: true,
    tun_subnet: "10.77.0.0/30",
    name: "تونل من",
    local_ip: "",
    remote_ip: "",
    local_spoof: "",
    remote_spoof: "",
    listen: "127.0.0.1:5000",
    forward: "127.0.0.1:51820",
    upload: "icmp",
    download: "icmp",
    local_port: 5001,
    remote_port: 8090,
    save_role: "local" as "local" | "remote" | "",
  });
  const [result, setResult] = useState<{ local: End; remote: End; saved: End | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<"local" | "remote" | "">("");

  useEffect(() => {
    api.listInstances()
      .then((list: Array<{ tun_address?: string }>) => {
        const used = (list || []).map((i) => (i.tun_address || "").replace(/\.\d+\/30$/, ".0/30")).filter(Boolean);
        setForm((f) => ({ ...f, tun_subnet: suggestSubnet(used) }));
      })
      .catch(() => {});
  }, []);

  const set = (key: keyof typeof form, value: string | number | boolean) => {
    setResult(null);
    setError("");
    setForm((f) => ({ ...f, [key]: value }));
  };

  const problems = useMemo(() => {
    const list: string[] = [];
    if (!IPV4.test(form.local_ip)) list.push("IP واقعی سرور ایران معتبر نیست.");
    if (!IPV4.test(form.remote_ip)) list.push("IP واقعی سرور خارج معتبر نیست.");
    if (!IPV4.test(form.local_spoof)) list.push("مبدأ جعلی ایران معتبر نیست.");
    if (!IPV4.test(form.remote_spoof)) list.push("مبدأ جعلی خارج معتبر نیست.");
    if (form.local_spoof === form.remote_spoof) list.push("مبدأهای جعلی دو طرف باید متفاوت باشند.");
    if (!/^\d{1,3}(\.\d{1,3}){3}\/30$/.test(form.tun_subnet)) list.push("شبکهٔ داخلی باید IPv4 با prefix یعنی /30 باشد.");
    if (!form.name.trim()) list.push("نام اتصال لازم است.");
    return list;
  }, [form]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (problems.length) {
      setError(problems[0]);
      return;
    }
    setBusy(true);
    setError("");
    try {
      setResult(await api.pair(form));
    } catch (err) {
      setError(err instanceof Error ? err.message : "ساخت تنظیمات ناموفق بود");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (role: "local" | "remote") => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(result[role], null, 2));
      setCopied(role);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setError("کپی در مرورگر ممکن نشد؛ از دانلود استفاده کن.");
    }
  };

  const preview = (c: End) => JSON.stringify({ ...c, psk: "•••••••• (در فایل دانلودی)" }, null, 2);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">CONNECTION BUILDER / 02</div>
          <h1>دو سمت، یک اتصال.</h1>
          <p className="page-intro">
            تنظیمات مکمل ایران و خارج را یک‌جا بساز. حامل رفت یک سمت، حامل برگشت سمت دیگر می‌شود؛
            پورت‌های دریافت و کلید مشترک خودکار هماهنگ می‌شوند.
          </p>
        </div>
      </div>

      <div className="builder">
        <form className="panel" onSubmit={submit}>
          <h2>مسیر اتصال</h2>

          <div className="grid-2">
            <label className="field">
              <span>IP واقعی سرور ایران</span>
              <input className="input mono" dir="ltr" inputMode="decimal" placeholder="203.0.113.10"
                value={form.local_ip} onChange={(e) => set("local_ip", e.target.value.trim())} required />
            </label>
            <label className="field">
              <span>IP واقعی سرور خارج</span>
              <input className="input mono" dir="ltr" inputMode="decimal" placeholder="198.51.100.20"
                value={form.remote_ip} onChange={(e) => set("remote_ip", e.target.value.trim())} required />
            </label>
            <label className="field">
              <span>مبدأ جعلی سمت ایران</span>
              <input className="input mono" dir="ltr" inputMode="decimal" placeholder="192.0.2.11"
                value={form.local_spoof} onChange={(e) => set("local_spoof", e.target.value.trim())} required />
            </label>
            <label className="field">
              <span>مبدأ جعلی سمت خارج</span>
              <input className="input mono" dir="ltr" inputMode="decimal" placeholder="192.0.2.22"
                value={form.remote_spoof} onChange={(e) => set("remote_spoof", e.target.value.trim())} required />
            </label>
          </div>

          <div className="grid-2">
            <label className="field">
              <span>نام اتصال</span>
              <input className="input" maxLength={100} value={form.name} onChange={(e) => set("name", e.target.value)} required />
            </label>
            <label className="field">
              <span>شبکهٔ داخلی TUN</span>
              <input className="input mono" dir="ltr" value={form.tun_subnet} onChange={(e) => set("tun_subnet", e.target.value)} required />
              <small className="hint">هر اتصال باید /30 یکتا داشته باشد؛ مقدار پیشنهادی از اتصال‌های موجود پرهیز می‌کند.</small>
            </label>
          </div>

          <div className="grid-2">
            <label className="field">
              <span>حامل رفت (ایران → خارج)</span>
              <select className="input" value={form.upload} onChange={(e) => set("upload", e.target.value)}>
                {CARRIERS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>حامل برگشت (خارج → ایران)</span>
              <select className="input" value={form.download} onChange={(e) => set("download", e.target.value)}>
                {CARRIERS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>پورت دریافت ایران</span>
              <input className="input mono" dir="ltr" type="number" min={1} max={65535}
                value={form.local_port} onChange={(e) => set("local_port", Number(e.target.value))} />
            </label>
            <label className="field">
              <span>پورت دریافت خارج</span>
              <input className="input mono" dir="ltr" type="number" min={1} max={65535}
                value={form.remote_port} onChange={(e) => set("remote_port", Number(e.target.value))} />
            </label>
          </div>

          <label className="field">
            <span>این پنل روی کدام سمت است؟</span>
            <select className="input" value={form.save_role} onChange={(e) => set("save_role", e.target.value)}>
              <option value="local">ایران · local (ذخیره در این سرور)</option>
              <option value="remote">خارج · remote (ذخیره در این سرور)</option>
              <option value="">فقط تولید فایل، بدون ذخیره</option>
            </select>
          </label>

          <label className="switch-row">
            <input type="checkbox" checked={form.auto_start} onChange={(e) => set("auto_start", e.target.checked)} />
            <span>شروع خودکار این اتصال با بالا آمدن پنل</span>
          </label>

          {error && <div role="alert" className="banner error">{error}</div>}

          <button className="btn btn-primary btn-block" disabled={busy || problems.length > 0}>
            {busy ? "در حال ساخت…" : "ساخت تنظیمات هماهنگ"}
          </button>
          {problems.length > 0 && <p className="hint">{problems[0]}</p>}
        </form>

        <aside className="stack">
          <div className="route-card">
            <span className="eyebrow">PACKET ROUTE</span>
            <div className="route-node">ایران <small dir="ltr">{form.local_ip || "LOCAL IPv4"}</small></div>
            <div className="route-wire"><span>{form.upload.toUpperCase()} ↓ ↑ {form.download.toUpperCase()}</span></div>
            <div className="route-node">خارج <small dir="ltr">{form.remote_ip || "REMOTE IPv4"}</small></div>
            <p>IPهای واقعی مقصد بسته‌اند؛ آدرس‌های جعلی فقط در فیلد مبدأ قرار می‌گیرند.</p>
          </div>
          <div className="panel">
            <h3>هستهٔ L3 و رمزنگاری</h3>
            <p className="page-intro">
              دو آدرس داخلی از /30 ساخته می‌شود و یک PSK تصادفی ۳۲ بایتی تولید می‌شود.
              فایل خروجی حاوی کلید است؛ آن را فقط به سرور مقابل برسان.
            </p>
          </div>
        </aside>
      </div>

      {result && (
        <section className="panel result-panel" role="status">
          <div className="section-head">
            <h2>تنظیمات آماده است</h2>
            {result.saved ? (
              <Link className="btn btn-ghost btn-sm" href={base + "/dashboard/tunnels"}>مشاهدهٔ اتصال‌ها</Link>
            ) : null}
          </div>
          <p className="page-intro">
            {result.saved
              ? "سمت انتخاب‌شده در همین سرور ذخیره شد. فایل سمت دیگر را در پنل مقابل وارد کن."
              : "هر دو سمت ساخته شد ولی چیزی ذخیره نشد؛ فایل‌ها را دانلود کن."}
          </p>
          <div className="grid-2">
            {(["local", "remote"] as const).map((role) => (
              <div key={role} className="panel inner">
                <h3>{role === "local" ? "ایران / local" : "خارج / remote"}</h3>
                <pre className="code" dir="ltr">{preview(result[role])}</pre>
                <div className="row">
                  <button className="btn btn-primary btn-sm" onClick={() => download(`emad-${role}.json`, result[role])}>دانلود فایل</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => copy(role)}>
                    {copied === role ? "کپی شد" : "کپی"}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="banner warn">فایل حاوی PSK است. آن را در چت عمومی، ریپو یا اسکرین‌شات منتشر نکن.</div>
        </section>
      )}
    </div>
  );
}
