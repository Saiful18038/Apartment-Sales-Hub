"use client";

import { useEffect, useState } from "react";
import {
  MapPin, Building2, Home, ClipboardList, Handshake, Wallet, AlertTriangle, BarChart3,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import { api } from "@/lib/api";
import { fmtBDT, fmtDateTime } from "@/lib/format";
import { STATUS, STATUS_ORDER } from "@/lib/status";
import { StatCard, EmptyState, ErrorBanner, LoadingBlock } from "@/components/ui";

export default function DashboardPage() {
  const [state, setState] = useState({ loading: true, error: "" });
  const [zones, setZones] = useState([]);
  const [projects, setProjects] = useState([]);
  const [flats, setFlats] = useState([]);
  const [sales, setSales] = useState([]);
  const [payments, setPayments] = useState([]);
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [z, p, f, s, pay, act] = await Promise.all([
          api.get("/zones"),
          api.get("/projects"),
          api.get("/flats"),
          api.get("/sales"),
          api.get("/payments"),
          api.get("/activity-logs"),
        ]);
        setZones(z);
        setProjects(p);
        setFlats(f.data || []);
        setSales(s);
        setPayments(pay);
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

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <StatCard icon={MapPin} label="Zones" value={zones.length} accent="#1F3864" />
        <StatCard icon={Building2} label="Projects" value={projects.length} accent="#1F3864" />
        <StatCard icon={Home} label="Total Flats" value={flats.length} accent="#1F3864" />
        <StatCard icon={ClipboardList} label="Available" value={flats.filter((f) => f.status_code === "AVAILABLE").length} accent="#64748B" />
        <StatCard icon={Handshake} label="Confirmed Sales" value={confirmedSales.length} accent="#B7860B" />
        <StatCard icon={AlertTriangle} label="Pending Approval" value={pendingSales} accent="#D97706" />
        <StatCard icon={Wallet} label="Total Collected" value={fmtBDT(totalPaid)} accent="#15803D" />
        <StatCard icon={Wallet} label="Total Due" value={fmtBDT(totalDue)} accent="#DC2626" />
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
          {byStatus.map((d) => (
            <div key={d.code} className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
              {d.label} <span className="text-slate-400">({d.count})</span>
            </div>
          ))}
        </div>
      </div>

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
