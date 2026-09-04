"use client";

import { useState } from "react";
import { ShieldCheck, Users } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { fmtBDT } from "@/lib/format";
import { ErrorBanner, LoadingBlock, Modal, Th, Td } from "@/components/ui";
import TeamRevenueBookingPies, { TeamPieChart, toPieSlices } from "@/components/TeamPieCharts";

/** Reuses fmtBDT's lakh-style comma grouping for a plain (non-currency) count, e.g. sft. */
const fmtNum = (n) => fmtBDT(n).replace("৳", "");

export default function ReportsPage() {
  const { data: teamData, loading: teamLoading, error: teamError } = useApi("/reports/team-summary");
  const teamRows = teamData?.teams || [];
  const teamGrand = teamData?.grand_total;
  const [detailTeam, setDetailTeam] = useState(null);

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-slate-800">Reports — Team Performance Summary</h2>
      <div className="text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex items-center gap-2">
        <ShieldCheck size={14} className="text-blue-600 shrink-0" />
        This table is computed live from the same Sale/Booking records on the server — Team totals can never drift
        out of sync the way they did in the manual spreadsheet (roadmap §2.3).
      </div>

      <ErrorBanner message={teamError} />
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="flex items-center gap-2 px-4 pt-4">
          <Users size={15} className="text-[#1F3864]" />
          <h3 className="text-sm font-bold text-slate-800">Team Performance Summary</h3>
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
              {teamRows.map((r) => (
                <tr key={r.team}>
                  <Td className="font-medium text-slate-800">
                    <button onClick={() => setDetailTeam(r)} className="text-[#1F3864] hover:underline font-medium">{r.team}</button>
                    {" "}<span className="text-slate-400 font-normal">({r.leader || "—"})</span>
                  </Td>
                  <Td>{r.total_apt}</Td>
                  <Td>{fmtNum(r.total_sft)}</Td>
                  <Td>{fmtBDT(r.total_revenue)}</Td>
                  <Td>{r.total_booking}</Td>
                  <Td className={r.total_cancelled_apt > 0 ? "text-red-600" : ""}>{r.total_cancelled_apt}</Td>
                  <Td className="text-slate-400">{r.remarks || "—"}</Td>
                </tr>
              ))}
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

      <TeamRevenueBookingPies />

      {detailTeam && (
        <Modal title={`Individual Team Performance — ${detailTeam.team}`} onClose={() => setDetailTeam(null)} wide>
          <div className="text-sm text-slate-500 mb-3">Team Leader: <span className="font-medium text-slate-800">{detailTeam.leader || "—"}</span></div>
          <div className="border border-slate-200 rounded-lg overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <Th>Member</Th><Th>Designation</Th><Th>Total Apt</Th><Th>Total sft</Th>
                  <Th>Total Revenue</Th><Th>Total Booking</Th><Th>Total Cancelled Apt</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(detailTeam.members || []).map((m) => (
                  <tr key={m.id}>
                    <Td className="font-medium text-slate-800">
                      {m.name}
                      {m.id === detailTeam.leader_id && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-[#1F3864]/10 text-[#1F3864] font-semibold">LEADER</span>}
                    </Td>
                    <Td className="text-slate-500">{m.designation || "—"}</Td>
                    <Td>{m.total_apt}</Td>
                    <Td>{fmtNum(m.total_sft)}</Td>
                    <Td>{fmtBDT(m.total_revenue)}</Td>
                    <Td>{m.total_booking}</Td>
                    <Td className={m.total_cancelled_apt > 0 ? "text-red-600" : ""}>{m.total_cancelled_apt}</Td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-semibold">
                  <td colSpan={2} className="px-3 py-2 text-sm text-slate-700">Team Total</td>
                  <Td>{detailTeam.total_apt}</Td>
                  <Td>{fmtNum(detailTeam.total_sft)}</Td>
                  <Td>{fmtBDT(detailTeam.total_revenue)}</Td>
                  <Td>{detailTeam.total_booking}</Td>
                  <Td>{detailTeam.total_cancelled_apt}</Td>
                </tr>
                {(detailTeam.members || []).length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-2 text-sm text-slate-400 italic">No members in this team yet</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {(detailTeam.members || []).some((m) => m.total_revenue > 0 || m.total_booking > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <TeamPieChart
                title="Revenue Share within Team"
                slices={toPieSlices(detailTeam.members || [], "name", "total_revenue")}
                formatValue={fmtBDT}
              />
              <TeamPieChart
                title="Booking Share within Team"
                slices={toPieSlices(detailTeam.members || [], "name", "total_booking")}
                formatValue={(v) => `${v} booking${v === 1 ? "" : "s"}`}
              />
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
