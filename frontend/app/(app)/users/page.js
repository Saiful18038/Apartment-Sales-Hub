"use client";

import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { Btn, Field, inputCls, Modal, PageHeader, ErrorBanner, LoadingBlock, EmptyState } from "@/components/ui";

const emptyForm = { name: "", email: "", department: "", designation: "", role: "employee", employee_code: "" };
const roleBadge = {
  owner: "bg-[#B7860B]/10 text-[#B7860B]",
  admin: "bg-[#1F3864]/10 text-[#1F3864]",
  team_leader: "bg-emerald-50 text-emerald-700",
  employee: "bg-slate-100 text-slate-600",
};

export default function UsersPage() {
  const { user } = useAuth();
  const { data: users, loading, error, refetch } = useApi("/users");
  const { data: teams } = useApi("/teams");

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saveError, setSaveError] = useState("");
  const [created, setCreated] = useState(null); // { user, temp_password }

  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ role: "employee", team_id: "", designation: "" });
  const [editError, setEditError] = useState("");

  const openNew = () => { setForm(emptyForm); setSaveError(""); setCreated(null); setModal(true); };

  const save = async () => {
    if (!form.name.trim() || !form.email.trim()) return;
    try {
      const res = await api.post("/users", form);
      setCreated(res);
      refetch();
    } catch (e) {
      setSaveError(e.message || "Save failed.");
    }
  };

  const openEdit = (u) => {
    setEditUser(u);
    setEditForm({ role: u.role, team_id: u.team_id ?? "", designation: u.designation || "" });
    setEditError("");
  };

  const saveEdit = async () => {
    try {
      await api.put(`/users/${editUser.id}`, {
        role: editForm.role,
        team_id: editForm.team_id === "" ? null : Number(editForm.team_id),
        designation: editForm.designation,
      });
      setEditUser(null);
      refetch();
    } catch (e) {
      setEditError(e.message || "Update failed.");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Employees & Users">
        <Btn onClick={openNew}><Plus size={15} /> Add User</Btn>
      </PageHeader>

      <ErrorBanner message={error} />
      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {users.map((u) => {
            const team = (teams || []).find((t) => t.id === u.team_id);
            return (
              <div key={u.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-semibold shrink-0">
                      {u.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium text-slate-800">{u.name}</div>
                      <div className="text-xs text-slate-400">{u.email}</div>
                    </div>
                  </div>
                  {u.id !== user.id && u.role !== "owner" && (
                    <button onClick={() => openEdit(u)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100" title="Edit role / team">
                      <Pencil size={14} />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${roleBadge[u.role]}`}>{u.role.replace("_", " ")}</span>
                  {u.employee_code && <span className="text-[10px] text-slate-400">{u.employee_code}</span>}
                  {u.designation && <span className="text-[10px] text-slate-400">· {u.designation}</span>}
                  {u.department && <span className="text-[10px] text-slate-400">· {u.department}</span>}
                  {team && <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{team.name}</span>}
                </div>
              </div>
            );
          })}
          {users.length === 0 && <EmptyState text="No users yet" />}
        </div>
      )}

      {modal && (
        <Modal title="Add User" onClose={() => setModal(false)}>
          <ErrorBanner message={saveError} />
          {created ? (
            <div className="space-y-3">
              <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                {created.user.name} created. Share this temporary password with them — in production this would be
                emailed instead of shown here.
              </div>
              <div className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-mono">{created.temp_password}</div>
              <div className="flex justify-end"><Btn onClick={() => setModal(false)}>Done</Btn></div>
            </div>
          ) : (
            <>
              <Field label="Name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Email"><input className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="Department"><input className={inputCls} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></Field>
              <Field label="Designation"><input className={inputCls} value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="e.g. Senior Manager" /></Field>
              <Field label="Role">
                <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="employee">Employee</option>
                  <option value="team_leader">Team Leader</option>
                  {user.role === "owner" && <option value="admin">Admin</option>}
                </select>
              </Field>
              {form.role === "employee" && (
                <Field label="Employee Code">
                  <input className={inputCls} value={form.employee_code} onChange={(e) => setForm({ ...form, employee_code: e.target.value })} placeholder="e.g. EMP-050" />
                </Field>
              )}
              <div className="flex justify-end gap-2 mt-2">
                <Btn variant="outline" onClick={() => setModal(false)}>Cancel</Btn>
                <Btn onClick={save}>Save</Btn>
              </div>
            </>
          )}
        </Modal>
      )}

      {editUser && (
        <Modal title={`Edit — ${editUser.name}`} onClose={() => setEditUser(null)}>
          <ErrorBanner message={editError} />
          <Field label="Role">
            <select className={inputCls} value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
              <option value="employee">Employee</option>
              <option value="team_leader">Team Leader</option>
              {user.role === "owner" && <option value="admin">Admin</option>}
            </select>
          </Field>
          <Field label="Designation">
            <input className={inputCls} value={editForm.designation} onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })} placeholder="e.g. Senior Manager" />
          </Field>
          {editForm.role !== "admin" && (
            <Field label="Team">
              <select className={inputCls} value={editForm.team_id} onChange={(e) => setEditForm({ ...editForm, team_id: e.target.value })}>
                <option value="">No team</option>
                {(teams || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
          )}
          <div className="flex justify-end gap-2 mt-2">
            <Btn variant="outline" onClick={() => setEditUser(null)}>Cancel</Btn>
            <Btn onClick={saveEdit}>Save</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
