"use client";

import { ShieldCheck } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { ErrorBanner, LoadingBlock, Th, Td } from "@/components/ui";

export default function ReportsPage() {
  const { data, loading, error } = useApi("/reports/floor-stock-summary");
  const rows = data?.zones || [];
  const grand = data?.grand_total;

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-slate-800">Reports — Floor &amp; Stock Summary</h2>
      <div className="text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex items-center gap-2">
        <ShieldCheck size={14} className="text-blue-600 shrink-0" />
        These tables are computed live from the same flat records on the server — Zone totals, Project totals and
        Stock totals can never drift out of sync the way they did in the manual spreadsheet (roadmap §2.3).
      </div>

      <ErrorBanner message={error} />
      {loading ? (
        <LoadingBlock />
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200"><tr><Th>Zone</Th><Th>First Floor</Th><Th>Middle</Th><Th>Top Floor</Th><Th>Total</Th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.zone}>
                    <Td className="font-medium text-slate-800">{r.zone}</Td>
                    <Td>{r.first_floor}</Td><Td>{r.middle}</Td><Td>{r.top_floor}</Td><Td>{r.total}</Td>
                  </tr>
                ))}
                {grand && (
                  <tr className="bg-slate-50 font-semibold">
                    <Td>Grand Total</Td><Td>{grand.first_floor}</Td><Td>{grand.middle}</Td><Td>{grand.top_floor}</Td><Td>{grand.total}</Td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr><Th>Zone</Th><Th>Project (Regular)</Th><Th>Project (RR)</Th><Th>Apt. (Regular)</Th><Th>Apt. (RR)</Th><Th>Ready</Th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.zone}>
                    <Td className="font-medium text-slate-800">{r.zone}</Td>
                    <Td>{r.project_regular}</Td><Td>{r.project_rr}</Td><Td>{r.apt_regular}</Td><Td>{r.apt_rr}</Td><Td>{r.ready}</Td>
                  </tr>
                ))}
                {grand && (
                  <tr className="bg-slate-50 font-semibold">
                    <Td>Grand Total</Td><Td>{grand.project_regular}</Td><Td>{grand.project_rr}</Td><Td>{grand.apt_regular}</Td><Td>{grand.apt_rr}</Td><Td>{grand.ready}</Td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
