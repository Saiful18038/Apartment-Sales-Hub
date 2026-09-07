"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { fmtBDT } from "@/lib/format";
import { ErrorBanner, LoadingBlock, Th, Td } from "@/components/ui";
import { TeamPieChart, toPieSlices } from "@/components/TeamPieCharts";

/** Reuses fmtBDT's lakh-style comma grouping for a plain (non-currency) count, e.g. sft. */
const fmtNum = (n) => fmtBDT(n).replace("৳", "");

function TeamDetailContent() {
  const searchParams = useSearchParams();
  const teamId = searchParams.get("id");
  const { data: teamData, loading, error } = useApi("/reports/team-summary");

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBanner message={error} />;

  const team = (teamData?.teams || []).find((t) => String(t.id) === teamId);
  if (!team) return <ErrorBanner message="Team not found." />;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/reports/" className="inline-flex items-center gap-1.5 text-sm text-[#1F3864] hover:underline mb-2">
          <ArrowLeft size={14} /> Back to Reports
        </Link>
        <h2 className="text-lg font-semibold text-slate-800">Individual Team Performance — {team.team}</h2>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="text-sm text-slate-500 mb-3">Team Leader: <span className="font-medium text-slate-800">{team.leader || "—"}</span></div>
        <div className="border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <Th>Member</Th><Th>Designation</Th><Th>Total Apt</Th><Th>Total sft</Th>
                <Th>Total Revenue</Th><Th>Total Booking</Th><Th>Booking Money %</Th><Th>Total Cancelled Apt</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(team.members || []).map((m) => (
                <tr key={m.id}>
                  <Td className="font-medium text-slate-800">
                    {m.name}
                    {m.id === team.leader_id && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-[#1F3864]/10 text-[#1F3864] font-semibold">LEADER</span>}
                  </Td>
                  <Td className="text-slate-500">{m.designation || "—"}</Td>
                  <Td>{m.total_apt}</Td>
                  <Td>{fmtNum(m.total_sft)}</Td>
                  <Td>{fmtBDT(m.total_revenue)}</Td>
                  <Td>{m.total_booking}</Td>
                  <Td>{m.booking_money_percent}%</Td>
                  <Td className={m.total_cancelled_apt > 0 ? "text-red-600" : ""}>{m.total_cancelled_apt}</Td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold">
                <td colSpan={2} className="px-3 py-2 text-sm text-slate-700">Team Total</td>
                <Td>{team.total_apt}</Td>
                <Td>{fmtNum(team.total_sft)}</Td>
                <Td>{fmtBDT(team.total_revenue)}</Td>
                <Td>{team.total_booking}</Td>
                <Td>{team.booking_money_percent}%</Td>
                <Td>{team.total_cancelled_apt}</Td>
              </tr>
              {(team.members || []).length === 0 && (
                <tr><td colSpan={8} className="px-3 py-2 text-sm text-slate-400 italic">No members in this team yet</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {(team.members || []).some((m) => m.total_revenue > 0 || m.total_booking > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <TeamPieChart
              title="Revenue Share within Team"
              slices={toPieSlices(team.members || [], "name", "total_revenue")}
              formatValue={fmtBDT}
            />
            <TeamPieChart
              title="Booking Share within Team"
              slices={toPieSlices(team.members || [], "name", "total_booking")}
              formatValue={(v) => `${v} booking${v === 1 ? "" : "s"}`}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function TeamDetailPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <TeamDetailContent />
    </Suspense>
  );
}
