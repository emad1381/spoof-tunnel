import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/lib/toast";

import "./globals.css";
import "./theme.css";

export const metadata: Metadata = {
  title: "Spoof Tunnel",
  description: "پنل مدیریت تونل اسپوف احراز هویت‌شده با رمزنگاری لایهٔ ۳",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#08090d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className="dark">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
