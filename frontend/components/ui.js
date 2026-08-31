"use client";

import { X } from "lucide-react";
import { statusMeta } from "@/lib/status";

export const inputCls =
  "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/40 focus:border-[#1F3864]";

export function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs font-medium text-slate-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className={`shadow-premium-lg bg-white rounded-2xl w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function StatusPill({ code }) {
  const s = statusMeta(code);
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
      style={{ backgroundColor: s.fill, borderColor: s.border, color: s.text }}
    >
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.text }} />
      {s.label}
    </span>
  );
}

export function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="shadow-premium group bg-white rounded-2xl p-4 flex items-center gap-3.5 transition-transform hover:-translate-y-0.5">
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `linear-gradient(135deg, ${accent}26, ${accent}12)`, color: accent }}
      >
        <Icon size={21} />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-500 truncate">{label}</div>
        <div className="text-xl font-bold text-slate-800 truncate tracking-tight">{value}</div>
      </div>
    </div>
  );
}

export function EmptyState({ text }) {
  return (
    <div className="text-center text-sm text-slate-400 py-10 border border-dashed border-slate-200 rounded-xl">
      {text}
    </div>
  );
}

export function Th({ children }) {
  return (
    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-3 py-2 whitespace-nowrap">
      {children}
    </th>
  );
}

export function Td({ children, className = "" }) {
  return <td className={`px-3 py-2 text-sm text-slate-700 ${className}`}>{children}</td>;
}

export function Btn({ children, onClick, variant = "primary", size = "md", disabled, type = "button", className = "" }) {
  const base = "inline-flex items-center gap-1.5 rounded-lg font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]";
  const sizes = size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-4 py-2.5 text-sm";
  const variants = {
    primary: "bg-gradient-to-b from-[#28477a] to-[#1F3864] text-white shadow-sm shadow-[#1F3864]/30 hover:shadow-md hover:shadow-[#1F3864]/40 hover:brightness-110",
    ghost: "text-slate-600 hover:bg-slate-100",
    danger: "text-red-600 hover:bg-red-50",
    outline: "border border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400",
    gold: "bg-gradient-to-b from-[#e0ac2b] to-[#B7860B] text-white shadow-sm shadow-[#B7860B]/30 hover:shadow-md hover:shadow-[#B7860B]/40 hover:brightness-110",
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={`${base} ${sizes} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

export function PageHeader({ title, children }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{message}</div>
  );
}

export function LoadingBlock() {
  return <div className="text-center text-sm text-slate-400 py-16">Loading…</div>;
}
