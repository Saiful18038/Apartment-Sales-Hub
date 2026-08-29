"use client";

import { useApi } from "@/lib/useApi";
import { fmtDateTime } from "@/lib/format";
import { ErrorBanner, LoadingBlock, EmptyState, Th, Td } from "@/components/ui";

export default function ActivityPage() {
  const { data: activity, loading, error } = useApi("/activity-logs");

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">Activity &amp; Audit Log</h2>
      <ErrorBanner message={error} />
      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200"><tr><Th>Date/Time</Th><Th>User</Th><Th>Action</Th><Th>Details</Th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {activity.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <Td className="whitespace-nowrap text-slate-500">{fmtDateTime(a.created_at)}</Td>
                  <Td className="font-medium text-slate-800">{a.user_name}</Td>
                  <Td>{a.action}</Td>
                  <Td>{a.details}</Td>
                </tr>
              ))}
            </tbody>
          </table>
          {activity.length === 0 && <EmptyState text="No activity recorded yet" />}
        </div>
      )}
    </div>
  );
}
