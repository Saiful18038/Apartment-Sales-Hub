"use client";

/**
 * Warm, decorative page chrome for Projects & Flats (the owner's request —
 * a softer, more premium feel than the app's plain slate-50 background).
 * Bleeds out of AppShell's <main> padding via negative margins so the
 * gradient fills edge-to-edge, then restores that padding on the inside.
 * Purely cosmetic: no status colors live here — those stay in lib/status.js
 * as the app's one deliberate source of color meaning.
 */
function PalmFrond({ className }) {
  return (
    <svg viewBox="0 0 120 120" className={className} fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity="0.55">
        <path d="M10 110 C 30 90, 40 60, 42 15" />
        <path d="M42 15 C 30 28, 18 34, 4 34" />
        <path d="M42 15 C 34 34, 30 44, 16 54" />
        <path d="M42 15 C 40 38, 38 52, 28 68" />
        <path d="M42 15 C 48 34, 54 42, 68 46" />
        <path d="M42 15 C 46 38, 50 50, 62 62" />
        <path d="M42 15 C 44 40, 48 58, 56 78" />
      </g>
    </svg>
  );
}

export default function PageBackdrop({ children }) {
  return (
    <div className="-m-3 sm:-m-6 p-3 sm:p-6 rounded-b-[28px] bg-gradient-to-br from-[#8CA0D3] via-[#9FB2DE] to-[#C3D0EA] relative overflow-hidden">
      <PalmFrond className="pointer-events-none absolute -top-2 right-8 w-24 h-24 text-[#F4E9C9] rotate-[15deg]" />
      <PalmFrond className="pointer-events-none absolute bottom-4 left-2 w-20 h-20 text-[#F4E9C9] rotate-[195deg]" />
      <div className="relative">{children}</div>
    </div>
  );
}
