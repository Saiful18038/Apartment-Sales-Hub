"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { TASK_STATUSES, TASK_STATUS_LABELS, TASK_STATUS_COLORS, TASK_PRIORITY_COLORS } from "@/lib/status";
import { Btn, Field, inputCls, Modal, PageHeader, ErrorBanner, LoadingBlock, EmptyState } from "@/components/ui";

const emptyForm = { team_id: "", assigned_to: "", title: "", description: "", priority: "medium", due_date: "" };

/**
 * Owner's Team hierarchy request — Task management.
 *   - Owner/Admin: every task, any team; can create/edit/delete anything.
 *   - Team Leader: create/edit/delete tasks for their own team only.
 *   - Employee: sees their team's tasks (shared visibility), but can only
 *     change the status of their own — matches TaskController's inline
 *     permission checks, which are the actual enforcement; this UI just
 *     hides actions the API would reject anyway.
 */
export default function TasksPage() {
  const { user } = useAuth();
  const canManage = user.role === "owner" || user.role === "admin";
  const isTeamLeader = user.role === "team_leader";
  const canCreate = canManage || isTeamLeader;

  const { data: tasks, loading, error, refetch } = useApi("/tasks");
  const { data: teams } = useApi("/teams");

  const myTeam = (teams || []).find((t) => t.id === user.team_id);

  const [modal, setModal] = useState(null); // "new" | task.id | null
  const [form, setForm] = useState(emptyForm);
  const [saveError, setSaveError] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const filtered = (tasks || []).filter((t) => !filterStatus || t.status === filterStatus);

  const teamForForm = canManage ? (teams || []).find((t) => t.id === Number(form.team_id)) : myTeam;

  const openNew = () => {
    setForm({
      team_id: canManage ? (teams?.[0]?.id || "") : (user.team_id || ""),
      assigned_to: "", title: "", description: "", priority: "medium", due_date: "",
    });
    setSaveError("");
    setModal("new");
  };

  const openEdit = (t) => {
    setForm({
      team_id: t.team_id, assigned_to: t.assigned_to, title: t.title,
      description: t.description || "", priority: t.priority, due_date: t.due_date || "",
    });
    setSaveError("");
    setModal(t.id);
  };

  const save = async () => {
    if (!form.title.trim() || !form.assigned_to) return;
    try {
      if (modal === "new") {
        await api.post("/tasks", { ...form, team_id: Number(form.team_id), assigned_to: Number(form.assigned_to) });
      } else {
        await api.put(`/tasks/${modal}`, { ...form, assigned_to: Number(form.assigned_to) });
      }
      setModal(null);
      refetch();
    } catch (e) {
      setSaveError(e.message || "Save failed.");
    }
  };

  const changeStatus = async (task, status) => {
    try {
      await api.put(`/tasks/${task.id}`, { status });
      refetch();
    } catch (e) {
      alert(e.message || "Status change failed.");
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete this task?")) return;
    try {
      await api.del(`/tasks/${id}`);
      refetch();
    } catch (e) {
      alert(e.message || "Delete failed.");
    }
  };

  const canEditTask = (t) => canManage || (isTeamLeader && t.team_id === user.team_id);
  const canChangeStatus = (t) => canEditTask(t) || t.assigned_to === user.id;

  return (
    <div className="space-y-4">
      <PageHeader title="Tasks">
        {canCreate && <Btn onClick={openNew}><Plus size={15} /> Add Task</Btn>}
      </PageHeader>

      <ErrorBanner message={error} />

      <div className="shadow-premium bg-white rounded-xl p-3.5 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-500 mb-1">Status</span>
          <select className={`${inputCls} w-[160px]`} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All Status</option>
            {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
          </select>
        </label>
        <span className="text-xs text-slate-400 ml-auto pb-2.5">{filtered.length} of {(tasks || []).length} tasks</span>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : filtered.length === 0 ? (
        <EmptyState text="No tasks yet" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TASK_STATUSES.map((statusCol) => (
            <div key={statusCol} className="space-y-2.5">
              <div className="flex items-center gap-2 px-1">
                <span className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full ${TASK_STATUS_COLORS[statusCol]}`}>
                  {TASK_STATUS_LABELS[statusCol]}
                </span>
                <span className="text-xs text-slate-400">{filtered.filter((t) => t.status === statusCol).length}</span>
              </div>
              {filtered.filter((t) => t.status === statusCol).map((t) => (
                <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-slate-800 text-sm">{t.title}</div>
                    {canEditTask(t) && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => openEdit(t)} className="text-slate-400 hover:text-slate-600"><Pencil size={13} /></button>
                        <button onClick={() => remove(t.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={13} /></button>
                      </div>
                    )}
                  </div>
                  {t.description && <div className="text-xs text-slate-500 mt-1">{t.description}</div>}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase ${TASK_PRIORITY_COLORS[t.priority]}`}>{t.priority}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">{t.team?.name}</span>
                    {t.due_date && <span className="text-[10px] text-slate-400">Due {fmtDate(t.due_date)}</span>}
                  </div>
                  <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-slate-100">
                    <span className="text-xs text-slate-500">{t.assignee?.name}</span>
                    {canChangeStatus(t) ? (
                      <select
                        className="text-xs border border-slate-200 rounded-lg px-1.5 py-1"
                        value={t.status}
                        onChange={(e) => changeStatus(t, e.target.value)}
                      >
                        {TASK_STATUSES.map((s) => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
                      </select>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic">view only</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal title={modal === "new" ? "Add Task" : "Edit Task"} onClose={() => setModal(null)}>
          <ErrorBanner message={saveError} />
          {canManage && (
            <Field label="Team">
              <select className={inputCls} value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value, assigned_to: "" })} disabled={modal !== "new"}>
                {(teams || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Assign To">
            <select className={inputCls} value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
              <option value="">Select a member…</option>
              {(teamForForm?.members || []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="Title"><input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Description"><textarea className={inputCls} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-x-4">
            <Field label="Priority">
              <select className={inputCls} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </Field>
            <Field label="Due Date"><input type="date" className={inputCls} value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></Field>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Btn variant="outline" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={save}>Save</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
