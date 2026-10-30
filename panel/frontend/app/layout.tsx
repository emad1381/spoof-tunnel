import type { Metadata } from "next";

import "./globals.css";



export const metadata: Metadata = {
  title: "EMAD · Spoof Tunnel",
  description: "Spoof Tunnel Management Panel",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body >{children}</body>
    </html>
  );
}
