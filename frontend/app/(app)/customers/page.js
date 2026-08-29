"use client";

import { useState } from "react";
import { Plus, Pencil, Paperclip } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { CUSTOMER_STATUSES, CUSTOMER_STATUS_COLORS } from "@/lib/status";
import { Btn, Field, inputCls, Modal, PageHeader, ErrorBanner, LoadingBlock, EmptyState, Th, Td } from "@/components/ui";
import DocumentsPanel from "@/components/DocumentsPanel";

const emptyForm = {
  name: "", phone: "", email: "", nid: "", interested_project_id: "", interested_flat_id: "",
  assigned_employee_id: "", status: "New", follow_up_date: "", notes: "",
};

export default function CustomersPage() {
  const { user } = useAuth();
  const canEdit = user.role === "owner" || user.role === "admin";

  const { data: customers, loading, error, refetch } = useApi("/customers");
  const { data: projects } = useApi("/projects");
  const { data: usersRes } = useApi(canEdit ? "/users" : null, { skip: !canEdit });
  const employees = (usersRes || []).filter((u) => u.role === "employee");

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saveError, setSaveError] = useState("");
  const [docsCustomer, setDocsCustomer] = useState(null);

  const openNew = () => {
    setForm({ ...emptyForm, interested_project_id: projects?.[0]?.id || "", assigned_employee_id: user.role === "employee" ? user.id : employees[0]?.id || "" });
    setSaveError("");
    setModal("new");
  };
  const openEdit = (c) => {
    setForm({
      name: c.name, phone: c.phone || "", email: c.email || "", nid: c.nid || "",
      interested_project_id: c.interested_project_id || "", interested_flat_id: c.interested_flat_id || "",
      assigned_employee_id: c.assigned_employee_id || "", status: c.status,
      follow_up_date: c.follow_up_date ? c.follow_up_date.slice(0, 10) : "", notes: c.notes || "",
    });
    setSaveError("");
    setModal(c.id);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    const payload = {
      ...form,
      interested_project_id: form.interested_project_id || null,
      interested_flat_id: form.interested_flat_id || null,
      assigned_employee_id: form.assigned_employee_id || null,
      follow_up_date: form.follow_up_date || null,
    };
    try {
      if (modal === "new") await api.post("/customers", payload);
      else await api.put(`/customers/${modal}`, payload);
      setModal(null);
      refetch();
    } catch (e) {
      setSaveError(e.message || "Save failed.");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Customers">
        <Btn onClick={openNew}><Plus size={15} /> Add Customer</Btn>
      </PageHeader>

      <ErrorBanner message={error} />
      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr><Th>Name</Th><Th>Phone</Th><Th>Interested In</Th><Th>Assigned To</Th><Th>Status</Th><Th></Th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-slate-800">{c.name}</Td>
                  <Td>{c.phone}</Td>
                  <Td>{c.interested_project?.name || "—"}</Td>
                  <Td>{c.assigned_employee?.name || "—"}</Td>
                  <Td><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CUSTOMER_STATUS_COLORS[c.status] || "bg-slate-100 text-slate-600"}`}>{c.status}</span></Td>
                  <Td>
                    <div className="flex gap-2">
                      <button onClick={() => setDocsCustomer(c)} className="text-slate-400 hover:text-slate-600" title="Documents"><Paperclip size={14} /></button>
                      <button onClick={() => openEdit(c)} className="text-slate-400 hover:text-slate-600"><Pencil size={14} /></button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
          {customers.length === 0 && <EmptyState text="No customers yet" />}
        </div>
      )}

      {modal && (
        <Modal title={modal === "new" ? "Add Customer" : "Edit Customer"} onClose={() => setModal(null)} wide>
          <ErrorBanner message={saveError} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Field label="Name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Phone"><input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Email"><input className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Status">
              <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {CUSTOMER_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Follow-up Date">
              <input type="date" className={inputCls} value={form.follow_up_date} onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })} />
            </Field>
            <Field label="Interested Project">
              <select className={inputCls} value={form.interested_project_id} onChange={(e) => setForm({ ...form, interested_project_id: e.target.value })}>
                <option value="">—</option>
                {(projects || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            {canEdit && (
              <Field label="Assigned Employee">
                <select className={inputCls} value={form.assigned_employee_id} onChange={(e) => setForm({ ...form, assigned_employee_id: e.target.value })}>
                  <option value="">—</option>
                  {employees.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </Field>
            )}
          </div>
          <Field label="Notes"><textarea className={inputCls} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 mt-2">
            <Btn variant="outline" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={save}>Save</Btn>
          </div>
        </Modal>
      )}

      {docsCustomer && (
        <Modal title={`Documents — ${docsCustomer.name}`} onClose={() => setDocsCustomer(null)} wide>
          <DocumentsPanel documentableType="customer" documentableId={docsCustomer.id} />
        </Modal>
      )}
    </div>
  );
}
