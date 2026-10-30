import type { Metadata, Viewport } from "next";
import { Vazirmatn } from "next/font/google";
import { ToastProvider } from "@/lib/toast";
import { ThemeProvider } from "@/lib/theme";

import "./design.css";

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-sans",
  display: "swap",
});

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
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
