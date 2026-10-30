"use client";
import { useState } from "react";
import { api, setToken } from "@/lib/api";
import { getBasePath } from "@/lib/basepath";
import { ThemeToggle } from "@/lib/theme";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api.login(username.trim(), password);
      setToken(data.token);
      window.location.replace(getBasePath() + "/dashboard");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ورود ناموفق بود";
      setError(
        msg === "Too many login attempts; try again in a minute"
          ? "تلاش‌های ناموفق زیاد بوده است؛ یک دقیقه بعد دوباره تلاش کن."
          : msg === "invalid credentials"
            ? "نام کاربری یا رمز عبور نادرست است."
            : msg
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-wrap">
      <div className="login-top">
        <ThemeToggle />
      </div>
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-mark lg">SP</div>
          <h1>ورود به پنل</h1>
          <p>Spoof Tunnel · پنل مدیریت تونل احراز هویت‌شده</p>
        </div>

        {error && <div role="alert" className="banner error">{error}</div>}

        <form onSubmit={submit} className="stack">
          <label className="field">
            <span>نام کاربری</span>
            <input
              className="input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
              dir="ltr"
            />
          </label>

          <label className="field">
            <span>رمز عبور</span>
            <div className="input-group">
              <input
                className="input"
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                dir="ltr"
              />
              <button
                type="button"
                className="input-addon"
                onClick={() => setShow(!show)}
                aria-label={show ? "پنهان کردن رمز" : "نمایش رمز"}
              >
                {show ? "پنهان" : "نمایش"}
              </button>
            </div>
          </label>

          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            {loading ? "در حال ورود…" : "ورود"}
          </button>
        </form>

        <p className="login-foot">
          دسترسی از راه دور را فقط روی HTTPS یا از طریق SSH forwarding انجام بده.
          فایل‌های تنظیمات دانلودی شامل کلید محرمانه (PSK) هستند.
        </p>
      </div>
    </main>
  );
}
