"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, MapPin, Building2, Home, Users, ClipboardList, Handshake,
  Wallet, ScrollText, LogOut, UserCog, AlertTriangle, ShieldAlert, Building, BarChart3, Menu, X,
  Users2, CheckSquare,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { LICENSE_META } from "@/lib/status";
import NotificationBell from "@/components/NotificationBell";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/zones", label: "Zones", icon: MapPin },
  { href: "/projects", label: "Projects", icon: Building2 },
  { href: "/flats", label: "Flats", icon: Home },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/bookings", label: "Bookings", icon: ClipboardList },
  { href: "/sales", label: "Sales", icon: Handshake },
  { href: "/payments", label: "Payments", icon: Wallet },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/activity", label: "Activity Log", icon: ScrollText },
  { href: "/teams", label: "Teams", icon: Users2, ownerAdminOnly: true },
  { href: "/users", label: "Employees", icon: UserCog, ownerAdminOnly: true },
];

function LicenseRestrictedScreen({ status, message }) {
  const meta = LICENSE_META[status] || { label: status };
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-sm w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert size={26} />
        </div>
        <h2 className="text-lg font-semibold text-slate-800 mb-1">License {meta.label}</h2>
        <p className="text-sm text-slate-500">
          {message || "Please contact your software provider to restore access. Your data is safe and has not been deleted."}
        </p>
      </div>
    </div>
  );
}

function LicenseBadge({ status }) {
  const meta = LICENSE_META[status] || { label: status, warn: false };
  const color = status === "ACTIVE" ? "#15803D" : meta.warn ? "#D97706" : "#64748B";
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full border border-slate-200 bg-slate-50">
      <span className="relative flex w-2 h-2">
        {status === "ACTIVE" && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ backgroundColor: color }} />
        )}
        <span className="relative inline-flex rounded-full w-2 h-2" style={{ backgroundColor: color }} />
      </span>
      <span style={{ color }}>{meta.label}</span>
    </span>
  );
}

export default function AppShell({ children }) {
  const { user, logout, licenseStatus, licenseBlocked } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);

  const canEdit = user?.role === "owner" || user?.role === "admin";
  const currentLabel = NAV.find((n) => pathname?.startsWith(n.href))?.label || "";

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  if (licenseBlocked) {
    return <LicenseRestrictedScreen status={licenseBlocked.status} message={licenseBlocked.message} />;
  }

  const navLinks = (
    <>
      <div className="px-5 py-5 flex items-center gap-3">
        <div className="gold-gradient w-9 h-9 rounded-xl text-white flex items-center justify-center shadow-lg shadow-black/20 shrink-0">
          <Building size={18} />
        </div>
        <div className="text-sm font-bold text-white leading-tight tracking-wide">
          Apartment
          <br />
          <span className="font-normal text-[11px] text-white/40">Sales Hub</span>
        </div>
        <button onClick={() => setNavOpen(false)} className="ml-auto md:hidden text-white/60 hover:text-white p-1">
          <X size={18} />
        </button>
      </div>
      <div className="mx-5 h-px bg-white/10" />
      <nav className="sidebar-scroll flex-1 py-3 px-2.5 overflow-y-auto space-y-0.5">
        {NAV.filter((n) => !n.ownerAdminOnly || canEdit).map((n) => {
          const active = pathname?.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setNavOpen(false)}
              className={`group relative w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-colors ${
                active ? "bg-white/10 text-white" : "text-white/50 hover:text-white/90 hover:bg-white/[0.06]"
              }`}
            >
              {active && (
                <span className="gold-gradient absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full" />
              )}
              <n.icon size={16} className={active ? "text-[#e0ac2b]" : ""} /> {n.label}
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-800">
      {/* Desktop sidebar — always visible from md breakpoint up */}
      <aside className="sidebar-gradient w-60 shrink-0 hidden md:flex md:flex-col">
        {navLinks}
      </aside>

      {/* Mobile sidebar — slide-in drawer + backdrop, only rendered/interactive below md */}
      {navOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setNavOpen(false)} />
          <aside className="sidebar-gradient absolute inset-y-0 left-0 w-72 max-w-[80vw] flex flex-col shadow-2xl">
            {navLinks}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white/90 backdrop-blur-sm border-b border-slate-200/70 flex items-center justify-between px-3 sm:px-6 shrink-0 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => setNavOpen(true)} className="md:hidden text-slate-500 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 shrink-0">
              <Menu size={20} />
            </button>
            <div className="text-sm font-medium text-slate-400 truncate">{currentLabel}</div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {LICENSE_META[licenseStatus]?.warn && (
              <span className="hidden lg:flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                <AlertTriangle size={12} /> License {LICENSE_META[licenseStatus].label}
              </span>
            )}
            <span className="hidden sm:block"><LicenseBadge status={licenseStatus} /></span>
            <NotificationBell />
            <div className="flex items-center gap-2.5 pl-1.5 sm:pl-3 sm:border-l border-slate-200">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1F3864] to-[#0d1930] flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0">
                {user?.name?.charAt(0)}
              </div>
              <div className="hidden lg:block leading-tight">
                <div className="text-xs font-semibold text-slate-700">{user?.name}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wide">{user?.role?.replace("_", " ")}</div>
              </div>
              <button onClick={handleLogout} className="text-slate-400 hover:text-slate-600 ml-1 p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
