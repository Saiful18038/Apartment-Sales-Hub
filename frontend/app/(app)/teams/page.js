"use client";

import { useState } from "react";
import { Plus, Trash2, Crown } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { Btn, Field, inputCls, Modal, PageHeader, ErrorBanner, LoadingBlock, EmptyState } from "@/components/ui";

const emptyForm = { name: "", leader_id: "" };

/**
 * Owner's Team hierarchy request — Owner/Admin only (see AppShell's NAV
 * ownerAdminOnly flag and the route's role:owner,admin group in
 * routes/api.php). Creating a team here promotes the chosen user to
 * team_leader server-side (TeamController::store) — no separate "promote"
 * step needed.
 */
export default function TeamsPage() {
  const { data: teams, loading, error, refetch } = useApi("/teams");
  const { data: users } = useApi("/users");

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saveError, setSaveError] = useState("");

  // A leader can be an existing employee/team_leader not already leading a
  // team — owner/admin don't lead teams, and someone already leading a
  // different team can't be double-booked here.
  const leaderCandidates = (users || []).filter(
    (u) => (u.role === "employee" || u.role === "team_leader") && !(teams || []).some((t) => t.leader_id === u.id)
  );

  const openNew = () => {
    setForm({ name: "", leader_id: leaderCandidates[0]?.id || "" });
    setSaveError("");
    setModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    try {
      await api.post("/teams", { name: form.name, leader_id: form.leader_id || null });
      setModal(false);
      refetch();
    } catch (e) {
      setSaveError(e.message || "Save failed.");
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete this team? Its tasks will also be removed; members become unassigned.")) return;
    try {
      await api.del(`/teams/${id}`);
      refetch();
    } catch (e) {
      alert(e.message || "Delete failed.");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Teams">
        <Btn onClick={openNew}><Plus size={15} /> Add Team</Btn>
      </PageHeader>

      <ErrorBanner message={error} />
      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {(teams || []).map((t) => (
            <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-slate-800">{t.name}</div>
                  <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                    <Crown size={12} className="text-[#B7860B]" />
                    {t.leader?.name || "No leader assigned"}
                  </div>
                </div>
                <button onClick={() => remove(t.id)} className="text-slate-400 hover:text-red-500">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="text-[11px] font-medium text-slate-400 uppercase mb-1.5">
                  Members ({t.members?.length || 0})
                </div>
                {t.members?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {t.members.map((m) => (
                      <span key={m.id} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {m.name}{m.id === t.leader_id ? " (Leader)" : ""}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic">No members yet — assign from Employees.</div>
                )}
              </div>
            </div>
          ))}
          {(teams || []).length === 0 && <EmptyState text="No teams yet" />}
        </div>
      )}

      {modal && (
        <Modal title="Add Team" onClose={() => setModal(false)}>
          <ErrorBanner message={saveError} />
          <Field label="Team Name">
            <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sales Squad A" />
          </Field>
          <Field label="Team Leader">
            <select className={inputCls} value={form.leader_id} onChange={(e) => setForm({ ...form, leader_id: e.target.value })}>
              <option value="">Assign later</option>
              {leaderCandidates.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
          </Field>
          {leaderCandidates.length === 0 && (
            <div className="text-xs text-slate-400 italic mb-2">
              No available employee to lead — everyone already leads a team. Add a user from Employees first.
            </div>
          )}
          <div className="flex justify-end gap-2 mt-2">
            <Btn variant="outline" onClick={() => setModal(false)}>Cancel</Btn>
            <Btn onClick={save}>Save</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
