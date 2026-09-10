"use client";

import {
  MapPin, Building2, Home, ClipboardList, Wallet, BarChart3, Coins, CheckCircle2, XCircle,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import { fmtBDT, fmtDateTime } from "@/lib/format";
import { StatCard, EmptyState, ErrorBanner, LoadingBlock } from "@/components/ui";
import TeamRevenueBookingPies from "@/components/TeamPieCharts";
import { useDashboardData } from "@/lib/useDashboardData";

// Owner's request: each stat card opens its details in a new browser tab
// (not an in-page modal) — a plain new-tab link to the shared
// dashboard-detail page, keyed by which card was clicked.
const openDetail = (key) => window.open(`/dashboard-detail/?key=${key}`, "_blank");

export default function DashboardPage() {
  const d = useDashboardData();

  if (d.loading) return <LoadingBlock />;
  if (d.error) return <ErrorBanner message={d.error} />;

  const {
    zones, projects, flats, activity, byStatus, confirmedSales, activeBookings,
    soldApartmentCount, totalBookingMoney, totalSoldAmount, availableCount, cancelledApartmentCount,
  } = d;

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-slate-800">Dashboard</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <StatCard icon={MapPin} label="Zones" value={zones.length} from="#2c4a7c" to="#16233f" caption={`${projects.length} projects total`} onClick={() => openDetail("zones")} />
        <StatCard icon={Building2} label="Projects" value={projects.length} from="#4f46e5" to="#3730a3" caption={`${flats.length} units total`} onClick={() => openDetail("projects")} />
        <StatCard icon={Home} label="All Apartment" value={flats.length} from="#2563eb" to="#1d4ed8" caption={`${availableCount} available`} onClick={() => openDetail("flats")} />
        <StatCard icon={ClipboardList} label="Product Available For Sale" value={availableCount} from="#0ea5e9" to="#0369a1" caption={flats.length ? `${Math.round((availableCount / flats.length) * 100)}% of inventory` : "—"} onClick={() => openDetail("available")} />
        <StatCard icon={CheckCircle2} label="Total sold out" value={soldApartmentCount} from="#10b981" to="#047857" caption={`${confirmedSales.length} confirmed + ${activeBookings.length} booked`} onClick={() => openDetail("sold")} />
        <StatCard icon={Wallet} label="Total Sold Amount" value={fmtBDT(totalSoldAmount)} from="#22c55e" to="#15803d" caption="Confirmed sales + booked units" onClick={() => openDetail("soldAmount")} />
        <StatCard icon={Coins} label="Total Booking Money" value={fmtBDT(totalBookingMoney)} from="#f59e0b" to="#b45309" caption={`${activeBookings.length} active booking${activeBookings.length === 1 ? "" : "s"}`} onClick={() => openDetail("bookingMoney")} />
        <StatCard icon={XCircle} label="Number of Cancelled Apartment" value={cancelledApartmentCount} from="#64748b" to="#334155" caption="Cancelled bookings" onClick={() => openDetail("cancelled")} />
      </div>

      <div className="shadow-premium bg-white rounded-2xl p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1F3864]/10 to-[#1F3864]/5 flex items-center justify-center text-[#1F3864]">
            <BarChart3 size={16} />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Flat Status Breakdown</h3>
        </div>
        <div style={{ width: "100%", height: 250 }}>
          <ResponsiveContainer>
            <BarChart data={byStatus} margin={{ left: -10, right: 10 }} barCategoryGap="28%">
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F6" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94A3B8" }} interval={0} angle={-20} textAnchor="end" height={60} axisLine={{ stroke: "#E2E8F0" }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} allowDecimals={false} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: "#F8FAFC" }}
                contentStyle={{ borderRadius: 12, border: "1px solid #EEF1F6", boxShadow: "0 8px 24px -8px rgba(15,23,42,0.15)", fontSize: 12.5, padding: "8px 12px" }}
                labelStyle={{ fontWeight: 700, color: "#1e2532", marginBottom: 2 }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={52}>
                {byStatus.map((d, i) => (
                  <Cell key={i} fill={d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 pt-3 border-t border-slate-100">
          {byStatus.map((s) => (
            <div key={s.code} className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.fill }} />
              {s.label} <span className="text-slate-400">({s.count})</span>
            </div>
          ))}
        </div>
      </div>

      <TeamRevenueBookingPies />

      <div className="shadow-premium bg-white rounded-2xl p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-4">Recent Activity</h3>
        <div className="space-y-0">
          {activity.slice(0, 6).map((a, i) => (
            <div key={a.id} className="relative flex items-start gap-3.5 text-sm pb-4 last:pb-0">
              {i < Math.min(activity.length, 6) - 1 && (
                <span className="absolute left-[5px] top-4 bottom-0 w-px bg-slate-100" />
              )}
              <span className="mt-1.5 w-[11px] h-[11px] rounded-full bg-[#1F3864]/10 border-2 border-[#1F3864]/30 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-slate-700">
                  <b className="text-slate-800">{a.user_name}</b> — {a.action}: {a.details}
                </span>
                <div className="text-xs text-slate-400 mt-0.5">{fmtDateTime(a.created_at)}</div>
              </div>
            </div>
          ))}
          {activity.length === 0 && <EmptyState text="No activity yet" />}
        </div>
      </div>
    </div>
  );
}
