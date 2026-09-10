"use client";

import { useState } from "react";
import { ShieldCheck, Users } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { fmtBDT } from "@/lib/format";
import { ErrorBanner, LoadingBlock, Th, Td } from "@/components/ui";
import TeamRevenueBookingPies, { PIE_COLORS } from "@/components/TeamPieCharts";
import ReportPeriodPicker, { periodLabel } from "@/components/ReportPeriodPicker";

/** Reuses fmtBDT's lakh-style comma grouping for a plain (non-currency) count, e.g. sft. */
const fmtNum = (n) => fmtBDT(n).replace("৳", "");

export default function ReportsPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(0); // 0 = whole year

  const { data: teamData, loading: teamLoading, error: teamError } =
    useApi(`/reports/team-summary?year=${year}&month=${month}`);
  const teamRows = teamData?.teams || [];
  const teamGrand = teamData?.grand_total;
  const years = teamData?.years || [];

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-slate-800">Reports — Team Performance Summary</h2>
      <div className="text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex items-center gap-2">
        <ShieldCheck size={14} className="text-blue-600 shrink-0" />
        This table is computed live from the same Sale/Booking records on the server — Team totals can never drift
        out of sync the way they did in the manual spreadsheet (roadmap §2.3).
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5">
        <ReportPeriodPicker year={year} month={month} years={years} onYear={setYear} onMonth={setMonth} />
      </div>

      <ErrorBanner message={teamError} />
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="flex items-center gap-2 px-4 pt-4">
          <Users size={15} className="text-[#1F3864]" />
          <h3 className="text-sm font-bold text-slate-800">Team Performance Summary</h3>
          <span className="text-xs text-slate-400">· {periodLabel(year, month)}</span>
        </div>
        {teamLoading ? (
          <LoadingBlock />
        ) : (
          <table className="w-full mt-3">
            <thead className="bg-slate-50 border-y border-slate-200">
              <tr>
                <Th>Team Name</Th><Th>Total Apt</Th><Th>Total sft</Th><Th>Total Revenue</Th>
                <Th>Total Booking</Th><Th>Total Cancelled Apt</Th><Th>Remarks</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {teamRows.map((r, i) => {
                // Owner's request: each team gets its own color so the row
                // is visually traceable down to its slice in the pie
                // charts below — same PIE_COLORS palette, same index order.
                const color = PIE_COLORS[i % PIE_COLORS.length];
                return (
                  <tr key={r.team}>
                    <Td className="font-medium text-slate-800">
                      <button
                        onClick={() => window.open(`/reports/team/?id=${r.id}&year=${year}&month=${month}`, "_blank")}
                        className="inline-flex items-center px-2.5 py-1 rounded-full font-semibold hover:opacity-80 transition-opacity"
                        style={{ backgroundColor: `${color}1a`, color, border: `1px solid ${color}55` }}
                      >
                        {r.team}
                      </button>
                      {" "}<span className="text-slate-400 font-normal">({r.leader || "—"})</span>
                    </Td>
                    <Td>{r.total_apt}</Td>
                    <Td>{fmtNum(r.total_sft)}</Td>
                    <Td>{fmtBDT(r.total_revenue)}</Td>
                    <Td>{r.total_booking}</Td>
                    <Td className={r.total_cancelled_apt > 0 ? "text-red-600" : ""}>{r.total_cancelled_apt}</Td>
                    <Td className="text-slate-400">{r.remarks || "—"}</Td>
                  </tr>
                );
              })}
              {teamGrand && (
                <tr className="bg-slate-50 font-semibold">
                  <Td>Grand Total</Td>
                  <Td>{teamGrand.total_apt}</Td>
                  <Td>{fmtNum(teamGrand.total_sft)}</Td>
                  <Td>{fmtBDT(teamGrand.total_revenue)}</Td>
                  <Td>{teamGrand.total_booking}</Td>
                  <Td>{teamGrand.total_cancelled_apt}</Td>
                  <Td></Td>
                </tr>
              )}
              {teamRows.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-2 text-sm text-slate-400 italic">No teams yet</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <TeamRevenueBookingPies year={year} month={month} />
    </div>
  );
}
