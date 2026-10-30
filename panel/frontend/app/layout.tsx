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

/* Blocking theme script: runs before any page content is parsed, so a
   stored dark theme never flashes light first. The OS-light CSS block in
   design.css only applies when this script has not set data-theme yet
   (no stored choice, or JS failed) — it can never override a stored
   choice, because the script runs first. */
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('spoof-theme');if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.setAttribute('data-theme',t);document.documentElement.style.colorScheme=t;}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable} suppressHydrationWarning>
      <body>
        {/* Must stay the first element in <body>: it sets data-theme
            before the header, sidebar and main content are parsed. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
