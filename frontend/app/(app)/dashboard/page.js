"use client";

import { useEffect, useState } from "react";
import {
  MapPin, Building2, Home, ClipboardList, Handshake, Wallet, AlertTriangle, BarChart3, Coins, CheckCircle2,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import { api } from "@/lib/api";
import { fmtBDT, fmtDateTime, calcFlatPrice } from "@/lib/format";
import { STATUS, STATUS_ORDER } from "@/lib/status";
import { StatCard, EmptyState, ErrorBanner, LoadingBlock } from "@/components/ui";
import PageBackdrop from "@/components/PageBackdrop";

export default function DashboardPage() {
  const [state, setState] = useState({ loading: true, error: "" });
  const [zones, setZones] = useState([]);
  const [projects, setProjects] = useState([]);
  const [flats, setFlats] = useState([]);
  const [sales, setSales] = useState([]);
  const [payments, setPayments] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [z, p, f, s, pay, book, act] = await Promise.all([
          api.get("/zones"),
          api.get("/projects"),
          api.get("/flats"),
          api.get("/sales"),
          api.get("/payments"),
          api.get("/bookings"),
          api.get("/activity-logs"),
        ]);
        setZones(z);
        setProjects(p);
        setFlats(f.data || []);
        setSales(s);
        setPayments(pay);
        setBookings(book);
        setActivity(act);
        setState({ loading: false, error: "" });
      } catch (e) {
        setState({ loading: false, error: e.message || "Failed to load dashboard." });
      }
    })();
  }, []);

  if (state.loading) return <LoadingBlock />;
  if (state.error) return <ErrorBanner message={state.error} />;

  const byStatus = STATUS_ORDER.map((code) => ({
    code,
    label: STATUS[code].label,
    count: flats.filter((f) => f.status_code === code).length,
    fill: STATUS[code].border,
  }));

  const confirmedSales = sales.filter((s) => s.status === "confirmed");
  const totalPaid = payments.reduce((a, p) => a + Number(p.amount), 0);
  const totalSaleValue = confirmedSales.reduce((a, s) => a + Number(s.sale_price), 0);
  const totalDue = totalSaleValue - totalPaid;
  const pendingSales = sales.filter((s) => s.status === "pending").length;

  // A flat's status_code goes to SOLD_CR/SOLD_OS_SS the instant booking
  // money is taken (BookingController::store) — before any Sale exists —
  // per the owner's request: booking money already commits the unit, so the
  // dashboard should read it as sold immediately, not only once the Booking
  // is converted into a confirmed Sale. That means the flats list ALREADY
  // carries every actively-booked unit under a SOLD_* status_code, so
  // counting it here too would double it — soldApartmentCount is just the
  // flat count, full stop.
  //
  // "Total Sold Amount" is the full committed value of every such unit
  // (confirmed sales' actual sale_price, which already reflects any
  // sold-price/sft discount, plus the full listing price of units still in
  // an active booking) — distinct from "Total Booking Money", which is only
  // the cash actually collected so far on those still-active bookings (an
  // active booking's target Booking Money can be paid in installments; see
  // Booking::paid_amount).
  const activeBookings = bookings.filter((b) => b.status === "active");
  const soldApartmentCount = flats.filter((f) => ["SOLD_CR", "SOLD_OS_SS"].includes(f.status_code)).length;
  const activeBookingsFullValue = activeBookings.reduce((a, b) => a + (b.flat ? calcFlatPrice(b.flat).total : 0), 0);
  const totalBookingMoney = activeBookings.reduce((a, b) => a + Number(b.paid_amount || 0), 0);
  const totalSoldAmount = totalSaleValue + activeBookingsFullValue;
  const availableCount = flats.filter((f) => f.status_code === "AVAILABLE").length;

  return (
    <PageBackdrop>
    <div className="space-y-5">
      <h2 className="text-[32px] font-extrabold text-[#101F3D] tracking-tight">Dashboard</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <StatCard icon={MapPin} label="Zones" value={zones.length} from="#2c4a7c" to="#16233f" caption={`${projects.length} projects total`} />
        <StatCard icon={Building2} label="Projects" value={projects.length} from="#4f46e5" to="#3730a3" caption={`${flats.length} units total`} />
        <StatCard icon={Home} label="Total Flats" value={flats.length} from="#2563eb" to="#1d4ed8" caption={`${availableCount} available`} />
        <StatCard icon={ClipboardList} label="Available" value={availableCount} from="#0ea5e9" to="#0369a1" caption={flats.length ? `${Math.round((availableCount / flats.length) * 100)}% of inventory` : "—"} />
        <StatCard icon={CheckCircle2} label="Total Sold Apartment" value={soldApartmentCount} from="#10b981" to="#047857" caption={`${confirmedSales.length} confirmed + ${activeBookings.length} booked`} />
        <StatCard icon={Handshake} label="Confirmed Sales" value={confirmedSales.length} from="#e0ac2b" to="#B7860B" caption={`${pendingSales} pending approval`} />
        <StatCard icon={AlertTriangle} label="Pending Approval" value={pendingSales} from="#f97316" to="#c2410c" caption="Needs owner/admin review" />
        <StatCard icon={Wallet} label="Total Sold Amount" value={fmtBDT(totalSoldAmount)} from="#22c55e" to="#15803d" caption="Confirmed sales + booked units" />
        <StatCard icon={Coins} label="Total Booking Money" value={fmtBDT(totalBookingMoney)} from="#f59e0b" to="#b45309" caption={`${activeBookings.length} active booking${activeBookings.length === 1 ? "" : "s"}`} />
        <StatCard icon={Wallet} label="Total Due" value={fmtBDT(totalDue)} from="#f43f5e" to="#be123c" caption={`of ${fmtBDT(totalSaleValue)} sold`} />
      </div>

      <div className="bg-[#FBF7EC] border border-[#EAE0C4] rounded-[22px] shadow-lg shadow-black/5 p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1F3864]/10 to-[#1F3864]/5 flex items-center justify-center text-[#1F3864]">
            <BarChart3 size={16} />
          </div>
          <h3 className="text-sm font-extrabold text-[#122347]">Flat Status Breakdown</h3>
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
        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 pt-3 border-t border-[#EAE0C4]">
          {byStatus.map((d) => (
            <div key={d.code} className="flex items-center gap-1.5 text-xs font-medium text-[#122347]/60">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
              {d.label} <span className="text-[#122347]/40">({d.count})</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#FBF7EC] border border-[#EAE0C4] rounded-[22px] shadow-lg shadow-black/5 p-5">
        <h3 className="text-sm font-extrabold text-[#122347] mb-4">Recent Activity</h3>
        <div className="space-y-0">
          {activity.slice(0, 6).map((a, i) => (
            <div key={a.id} className="relative flex items-start gap-3.5 text-sm pb-4 last:pb-0">
              {i < Math.min(activity.length, 6) - 1 && (
                <span className="absolute left-[5px] top-4 bottom-0 w-px bg-[#EAE0C4]" />
              )}
              <span className="mt-1.5 w-[11px] h-[11px] rounded-full bg-[#1F3864]/10 border-2 border-[#1F3864]/30 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-[#122347]/80">
                  <b className="text-[#122347]">{a.user_name}</b> — {a.action}: {a.details}
                </span>
                <div className="text-xs text-[#122347]/40 mt-0.5">{fmtDateTime(a.created_at)}</div>
              </div>
            </div>
          ))}
          {activity.length === 0 && <EmptyState text="No activity yet" />}
        </div>
      </div>
    </div>
    </PageBackdrop>
  );
}
