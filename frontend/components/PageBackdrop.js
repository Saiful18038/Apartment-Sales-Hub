"use client";

/**
 * Warm, decorative page chrome for Projects/Flats/Dashboard (the owner's
 * request, from a reference screenshot — a softer, more premium feel than
 * the app's plain slate-50 background). Bleeds out of AppShell's <main>
 * padding via negative margins so the gradient fills edge-to-edge, then
 * restores that padding on the inside. Purely cosmetic: no status colors
 * live here — those stay in lib/status.js as the app's one deliberate
 * source of color meaning.
 *
 * Matched to the reference image's three distinguishing details, not just
 * "a blue gradient": (1) a faint diagonal hatch-line texture across the
 * whole background, not a flat gradient, (2) fuller, denser palm fronds
 * (several leaflets per stroke, not a single thin line) in a warm gold,
 * tucked in the filter-bar corners and one larger one bottom-right of the
 * page, (3) a small four-point sparkle glyph near that bottom-right frond.
 */
export function PalmFrond({ className }) {
  return (
    <svg viewBox="0 0 140 140" className={className} fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeLinecap="round">
        {/* stem */}
        <path d="M14 130 C 40 100, 56 70, 60 20" strokeWidth="2.4" opacity="0.85" />
        {/* fronds — paired leaflets branching off the stem, both sides */}
        <path d="M60 20 C 48 30, 34 34, 18 30" strokeWidth="1.8" opacity="0.75" />
        <path d="M60 20 C 50 34, 46 42, 30 46" strokeWidth="1.8" opacity="0.75" />
        <path d="M58 32 C 48 44, 42 52, 26 58" strokeWidth="1.8" opacity="0.7" />
        <path d="M56 46 C 46 56, 40 64, 24 72" strokeWidth="1.8" opacity="0.65" />
        <path d="M54 60 C 46 70, 40 78, 28 88" strokeWidth="1.8" opacity="0.6" />
        <path d="M60 20 C 68 32, 74 40, 90 44" strokeWidth="1.8" opacity="0.75" />
        <path d="M58 32 C 66 44, 72 52, 88 58" strokeWidth="1.8" opacity="0.7" />
        <path d="M56 46 C 64 56, 70 64, 86 72" strokeWidth="1.8" opacity="0.65" />
        <path d="M54 60 C 62 70, 68 78, 82 88" strokeWidth="1.8" opacity="0.6" />
      </g>
    </svg>
  );
}

function Sparkle({ className }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="currentColor" aria-hidden="true">
      <path d="M20 2 C 21 12, 23 17, 34 20 C 23 23, 21 28, 20 38 C 19 28, 17 23, 6 20 C 17 17, 19 12, 20 2 Z" />
    </svg>
  );
}

export default function PageBackdrop({ children }) {
  return (
    <div
      className="-m-3 sm:-m-6 p-3 sm:p-6 rounded-b-[28px] relative overflow-hidden"
      style={{
        background:
          "repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 34px)," +
          "linear-gradient(135deg, #86A0D8 0%, #9BB1E2 45%, #C4D2EC 100%)",
      }}
    >
      <PalmFrond className="pointer-events-none absolute bottom-6 right-4 w-32 h-32 text-[#EFDBA0] rotate-[3deg] opacity-90" />
      <Sparkle className="pointer-events-none absolute bottom-24 right-32 w-6 h-6 text-white/70" />
      <div className="relative">{children}</div>
    </div>
  );
}
