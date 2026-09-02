"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Crown } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { Btn, Field, inputCls, Modal, PageHeader, ErrorBanner, LoadingBlock, EmptyState } from "@/components/ui";

const emptyForm = {
  name: "", leader_id: "", leader_designation: "", leader_department: "", leader_employee_code: "", member_ids: [],
};

/**
 * Owner's Team hierarchy request — Owner/Admin only (see AppShell's NAV
 * ownerAdminOnly flag and the route's role:owner,admin group in
 * routes/api.php). Add/Edit here does everything in one place: creates or
 * promotes the Team Leader (with Designation/Department/Employee ID) and
 * assigns the Team Employee roster — no separate trip to Employees needed.
 */
export default function TeamsPage() {
  const { data: teams, loading, error, refetch } = useApi("/teams");
  const { data: users } = useApi("/users");

  const [modal, setModal] = useState(null); // "new" | team.id | null
  const [form, setForm] = useState(emptyForm);
  const [saveError, setSaveError] = useState("");

  const editingTeam = modal && modal !== "new" ? (teams || []).find((t) => t.id === modal) : null;

  // A leader can be an existing employee/team_leader not already leading a
  // DIFFERENT team — owner/admin don't lead teams. Editing a team keeps its
  // own current leader in the list.
  const leaderCandidates = (users || []).filter((u) => {
    if (u.role !== "employee" && u.role !== "team_leader") return false;
    const ledTeam = (teams || []).find((t) => t.leader_id === u.id);
    return !ledTeam || ledTeam.id === editingTeam?.id;
  });

  // Team Employees (Assign) checklist — plain employees only; someone
  // already leading their own team stays out of another team's roster.
  const memberCandidates = (users || []).filter((u) => u.role === "employee" && String(u.id) !== String(form.leader_id));

  const fillLeaderProfile = (leaderId) => {
    const u = (users || []).find((x) => String(x.id) === String(leaderId));
    return {
      leader_designation: u?.designation || "",
      leader_department: u?.department || "",
      leader_employee_code: u?.employee_code || "",
    };
  };

  const openNew = () => {
    const firstLeader = leaderCandidates[0]?.id || "";
    setForm({ name: "", leader_id: firstLeader, member_ids: [], ...fillLeaderProfile(firstLeader) });
    setSaveError("");
    setModal("new");
  };

  const openEdit = (t) => {
    setForm({
      name: t.name,
      leader_id: t.leader_id || "",
      member_ids: (t.members || []).filter((m) => m.id !== t.leader_id).map((m) => m.id),
      leader_designation: t.leader?.designation || "",
      leader_department: t.leader?.department || "",
      leader_employee_code: t.leader?.employee_code || "",
    });
    setSaveError("");
    setModal(t.id);
  };

  const pickLeader = (leaderId) => {
    setForm({ ...form, leader_id: leaderId, ...fillLeaderProfile(leaderId) });
  };

  const toggleMember = (userId) => {
    setForm((f) => ({
      ...f,
      member_ids: f.member_ids.includes(userId) ? f.member_ids.filter((id) => id !== userId) : [...f.member_ids, userId],
    }));
  };

  const save = async () => {
    if (!form.name.trim() || !form.leader_id) return;
    const payload = { ...form, leader_id: Number(form.leader_id), member_ids: form.member_ids.map(Number) };
    try {
      if (modal === "new") await api.post("/teams", payload);
      else await api.put(`/teams/${modal}`, payload);
      setModal(null);
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
                  {t.leader && (t.leader.designation || t.leader.department || t.leader.employee_code) && (
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {[t.leader.designation, t.leader.department, t.leader.employee_code].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(t)} className="text-slate-400 hover:text-slate-600"><Pencil size={14} /></button>
                  <button onClick={() => remove(t.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="text-[11px] font-medium text-slate-400 uppercase mb-1.5">
                  Team Employees ({(t.members || []).filter((m) => m.id !== t.leader_id).length})
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
                  <div className="text-xs text-slate-400 italic">No team employees assigned yet.</div>
                )}
              </div>
            </div>
          ))}
          {(teams || []).length === 0 && <EmptyState text="No teams yet" />}
        </div>
      )}

      {modal && (
        <Modal title={modal === "new" ? "Add Team" : "Edit Team"} onClose={() => setModal(null)} wide>
          <ErrorBanner message={saveError} />
          <Field label="Team Name">
            <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sales Squad A" />
          </Field>

          <Field label="Team Leader Name">
            <select className={inputCls} value={form.leader_id} onChange={(e) => pickLeader(e.target.value)}>
              <option value="">Select a leader…</option>
              {leaderCandidates.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
          </Field>
          {leaderCandidates.length === 0 && (
            <div className="text-xs text-slate-400 italic mb-2">
              No available employee to lead — everyone already leads a team. Add a user from Employees first.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4">
            <Field label="Designation">
              <input className={inputCls} value={form.leader_designation} onChange={(e) => setForm({ ...form, leader_designation: e.target.value })} placeholder="e.g. Senior Manager" />
            </Field>
            <Field label="Department">
              <input className={inputCls} value={form.leader_department} onChange={(e) => setForm({ ...form, leader_department: e.target.value })} placeholder="e.g. CR" />
            </Field>
            <Field label="Employee ID">
              <input className={inputCls} value={form.leader_employee_code} onChange={(e) => setForm({ ...form, leader_employee_code: e.target.value })} placeholder="e.g. 1111" />
            </Field>
          </div>

          <Field label="Team Employees (Assign)">
            <div className="border border-slate-300 rounded-lg max-h-40 overflow-y-auto divide-y divide-slate-100">
              {memberCandidates.length === 0 && <div className="text-xs text-slate-400 italic px-3 py-2">No employees available.</div>}
              {memberCandidates.map((u) => (
                <label key={u.id} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={form.member_ids.includes(u.id)} onChange={() => toggleMember(u.id)} />
                  <span>{u.name}</span>
                  {u.team_id && u.team_id !== Number(modal) && <span className="text-[10px] text-amber-600 ml-auto">moves from another team</span>}
                </label>
              ))}
            </div>
          </Field>

          <div className="flex justify-end gap-2 mt-2">
            <Btn variant="outline" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={save}>Save</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
