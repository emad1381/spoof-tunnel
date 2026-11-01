"use client";
import { useEffect, useRef, type ReactNode } from "react";
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
 const ref = useRef<HTMLDivElement>(null);
 useEffect(() => {
  const previous = document.activeElement as HTMLElement | null;
  const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
  const items = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('button,a,input,[tabindex="0"]') || []).filter(el => el.getClientRects().length > 0);
  items()[0]?.focus();
  const keydown = (event: KeyboardEvent) => {
   if (event.key === "Escape") { event.preventDefault(); onClose(); }
   if (event.key !== "Tab") return;
   const controls = items(), first = controls[0], last = controls[controls.length - 1];
   if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
   if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };
  window.addEventListener("keydown", keydown);
  return () => { window.removeEventListener("keydown", keydown); document.body.style.overflow = overflow; previous?.focus(); };
 }, [onClose]);
 return <div className="modal-overlay" onClick={onClose}>
  <div ref={ref} className="modal-content" role="dialog" aria-modal="true" aria-label={title} onClick={event => event.stopPropagation()}>
   <h2>{title}</h2>{children}
  </div>
 </div>;
}
