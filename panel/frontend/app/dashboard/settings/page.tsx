"use client";
import { useState } from "react";
import { api, setToken } from "@/lib/api";

const MIN = 12;
const MAX = 72;

export default function SettingsPage() {
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (newPass.length < MIN) {
      setError(`رمز جدید باید حداقل ${MIN} کاراکتر باشد.`);
      return;
    }
    if (newPass.length > MAX) {
      setError(`رمز جدید حداکثر ${MAX} بایت است.`);
      return;
    }
    if (newPass !== confirm) {
      setError("تکرار رمز جدید مطابق نیست.");
      return;
    }
    setLoading(true);
    try {
      const data = await api.changePassword(oldPass, newPass);
      if (data.token) setToken(data.token);
      setSuccess("رمز عبور تغییر کرد و نشست‌های قبلی باطل شدند.");
      setOldPass("");
      setNewPass("");
      setConfirm("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "تغییر رمز ناموفق بود";
      setError(msg === "wrong password" ? "رمز فعلی نادرست است." : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <div className="eyebrow">SECURITY / 04</div>
          <h1>تنظیمات امنیتی</h1>
          <p className="page-intro">تغییر رمز مدیر؛ با ذخیرهٔ رمز، همهٔ توکن‌های قبلی باطل می‌شوند.</p>
        </div>
      </div>

      <section className="panel">
        <h2>تغییر رمز عبور</h2>
        {error && <div role="alert" className="banner error">{error}</div>}
        {success && <div role="status" className="banner ok">{success}</div>}

        <form onSubmit={submit} className="stack">
          <label className="field">
            <span>رمز فعلی</span>
            <input
              className="input"
              type="password"
              value={oldPass}
              onChange={(e) => setOldPass(e.target.value)}
              autoComplete="current-password"
              required
              dir="ltr"
            />
          </label>
          <label className="field">
            <span>رمز جدید <small className="muted">({MIN} تا {MAX} کاراکتر)</small></span>
            <input
              className="input"
              type="password"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              autoComplete="new-password"
              minLength={MIN}
              maxLength={MAX}
              required
              dir="ltr"
            />
          </label>
          <label className="field">
            <span>تکرار رمز جدید</span>
            <input
              className="input"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              dir="ltr"
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "در حال ذخیره…" : "ذخیرهٔ رمز جدید"}
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>یادآوری‌های امنیتی</h2>
        <ul className="list">
          <li>پنل روی HTTP سرو می‌شود؛ برای مدیریت از راه دور از reverse proxy با TLS یا SSH tunneling استفاده کن.</li>
          <li>فایل خروجی اتصال حاوی PSK است؛ آن را فقط از کانال امن منتقل کن.</li>
          <li>مسیر تصادفی پنل جای رمز را نمی‌گیرد و فقط یک لایهٔ کاهش نویز است.</li>
        </ul>
      </section>
    </div>
  );
}
