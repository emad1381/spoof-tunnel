"use client";
import { useEffect } from "react";
import { getBasePath } from "@/lib/basepath";

export default function Home() {
  useEffect(() => {
    const base = getBasePath();
    const token = localStorage.getItem("token");
    window.location.replace(base + (token ? "/dashboard" : "/login"));
  }, []);

  return (
    <div className="boot-screen">
      <div className="boot-logo">SP</div>
      <div className="status-dot starting" />
      <p>در حال ورود به پنل…</p>
    </div>
  );
}
