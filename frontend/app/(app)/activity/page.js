"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { fmtDateTime } from "@/lib/format";
import { ErrorBanner, LoadingBlock, EmptyState, Th, Td, inputCls } from "@/components/ui";

/** "2h 15m" / "45m" / "3d 4h" — never both a huge unit and seconds together. */
function fmtDuration(ms) {
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 1) return "<1m";
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Owner's request: "koto somoy login chilo" — how long each session lasted.
 * AuthController::logout() now logs a paired 'Logout' entry (it didn't
 * before), so a Login can be matched to the next Logout for that same user.
 * Pairing is a per-user stack over ascending time — a Logout closes the
 * MOST RECENTLY opened still-open Login for that user (clicking "Log Out"
 * always ends the session you're currently in, never some older one left
 * open by a stale tab or a device that was never explicitly logged out
 * of), so this pops rather than shifts. A Login with no matching Logout
 * yet is reported as "Active" rather than a duration.
 */
function computeSessionDurations(activity) {
  const ascending = [...activity].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const openLogins = new Map(); // user_id -> stack of login entries
  const durationMsById = {};
  for (const a of ascending) {
    if (a.action === "Login") {
      if (!openLogins.has(a.user_id)) openLogins.set(a.user_id, []);
      openLogins.get(a.user_id).push(a);
    } else if (a.action === "Logout") {
      const stack = openLogins.get(a.user_id);
      const loginEvent = stack?.pop();
      if (loginEvent) {
        durationMsById[loginEvent.id] = new Date(a.created_at) - new Date(loginEvent.created_at);
      }
    }
  }
  return durationMsById;
}

export default function ActivityPage() {
  const { data: activity, loading, error } = useApi("/activity-logs");

  const rows = useMemo(() => activity || [], [activity]);
  const durationMsById = useMemo(() => computeSessionDurations(rows), [rows]);

  const [filterSearch, setFilterSearch] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [filterAction, setFilterAction] = useState("");

  const users = useMemo(() => Array.from(new Set(rows.map((a) => a.user_name))).sort(), [rows]);
  const actions = useMemo(() => Array.from(new Set(rows.map((a) => a.action))).sort(), [rows]);

  const filtered = rows.filter((a) => {
    if (filterUser && a.user_name !== filterUser) return false;
    if (filterAction && a.action !== filterAction) return false;
    if (filterSearch && !`${a.details || ""}`.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    return true;
  });

  const filtersActive = filterSearch || filterUser || filterAction;
  const clearFilters = () => { setFilterSearch(""); setFilterUser(""); setFilterAction(""); };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">Activity &amp; Audit Log</h2>
      <ErrorBanner message={error} />

      <div className="shadow-premium bg-white rounded-xl p-3.5 flex flex-wrap items-end gap-3">
        <label className="block w-full sm:w-auto">
          <span className="block text-xs font-medium text-slate-500 mb-1">Search</span>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className={`${inputCls} pl-8 w-full sm:w-[200px]`}
              placeholder="Search details…"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
            />
          </div>
        </label>
        <label className="block w-[calc(50%-0.375rem)] sm:w-auto">
          <span className="block text-xs font-medium text-slate-500 mb-1">User</span>
          <select className={`${inputCls} w-full sm:w-[180px]`} value={filterUser} onChange={(e) => setFilterUser(e.target.value)}>
            <option value="">All Users</option>
            {users.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
        <label className="block w-[calc(50%-0.375rem)] sm:w-auto">
          <span className="block text-xs font-medium text-slate-500 mb-1">Action</span>
          <select className={`${inputCls} w-full sm:w-[160px]`} value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
            <option value="">All Actions</option>
            {actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        {filtersActive && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 pb-2.5">
            <X size={13} /> Clear filters
          </button>
        )}
        <span className="text-xs text-slate-400 ml-auto pb-2.5">
          {filtered.length} of {rows.length} entries
        </span>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr><Th>Date/Time</Th><Th>User</Th><Th>Action</Th><Th>Details</Th><Th>Session Duration</Th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <Td className="whitespace-nowrap text-slate-500">{fmtDateTime(a.created_at)}</Td>
                  <Td className="font-medium text-slate-800">{a.user_name}</Td>
                  <Td>{a.action}</Td>
                  <Td>{a.details}</Td>
                  <Td>
                    {a.action === "Login" && (
                      durationMsById[a.id] !== undefined
                        ? <span className="text-slate-600">{fmtDuration(durationMsById[a.id])}</span>
                        : <span className="text-emerald-600 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50">Active</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <EmptyState text={filtersActive ? "No activity matches these filters" : "No activity recorded yet"} />
          )}
        </div>
      )}
    </div>
  );
}
