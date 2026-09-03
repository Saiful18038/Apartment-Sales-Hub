"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Pencil, Paperclip, MoreVertical, Eye, Search, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { CUSTOMER_STATUSES, CUSTOMER_STATUS_COLORS, CLIENT_REFERENCE_OPTIONS } from "@/lib/status";
import { Btn, Field, inputCls, Modal, PageHeader, ErrorBanner, LoadingBlock, EmptyState, Th, Td } from "@/components/ui";
import DocumentsPanel from "@/components/DocumentsPanel";

const emptyForm = {
  name: "", phone: "", email: "", nid: "", reference_source: "", interested_project_id: "", interested_flat_id: "",
  assigned_employee_id: "", status: "New", follow_up_date: "", notes: "",
};

/** "CUST-00001" — same formatting FlatResource uses for a Sold flat's Customer Id. */
const clientId = (id) => "CUST-" + String(id).padStart(5, "0");

function RowMenu({ onView, onEdit, onDocuments }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const pick = (fn) => { setOpen(false); fn(); };

  return (
    <div className="relative inline-block" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100">
        <MoreVertical size={15} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 text-sm">
          <button onClick={() => pick(onView)} className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50">
            <Eye size={13} /> View Details
          </button>
          {onEdit && (
            <button onClick={() => pick(onEdit)} className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50">
              <Pencil size={13} /> Edit
            </button>
          )}
          <button onClick={() => pick(onDocuments)} className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50">
            <Paperclip size={13} /> Documents
          </button>
        </div>
      )}
    </div>
  );
}

export default function CustomersPage() {
  const { user } = useAuth();
  const canEdit = user.role === "owner" || user.role === "admin";

  const { data: customers, loading, error, refetch } = useApi("/customers");
  const { data: projects } = useApi("/projects");
  const { data: flatsRes } = useApi("/flats");
  const { data: usersRes } = useApi(canEdit ? "/users" : null, { skip: !canEdit });
  const employees = (usersRes || []).filter((u) => u.role === "employee");
  const allFlats = flatsRes?.data || [];

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saveError, setSaveError] = useState("");
  const [docsCustomer, setDocsCustomer] = useState(null);
  const [detailCustomer, setDetailCustomer] = useState(null);

  const flatsInForm = allFlats.filter((f) => String(f.project_id) === String(form.interested_project_id));

  // Dropdown filter bar — Search / Project / Team Leader / Status, same
  // pattern as the Projects and Flats pages' filter bar.
  const [filterSearch, setFilterSearch] = useState("");
  const [filterProjectId, setFilterProjectId] = useState("");
  const [filterLeaderId, setFilterLeaderId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const leaders = useMemo(() => {
    const map = new Map();
    for (const c of customers || []) {
      const leader = c.assigned_employee?.team?.leader;
      if (leader) map.set(leader.id, leader.name);
    }
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [customers]);

  const filteredCustomers = (customers || []).filter((c) => {
    if (filterProjectId && String(c.interested_project_id) !== filterProjectId) return false;
    if (filterLeaderId && String(c.assigned_employee?.team?.leader?.id) !== filterLeaderId) return false;
    if (filterStatus && c.status !== filterStatus) return false;
    if (filterSearch) {
      const haystack = `${c.name} ${clientId(c.id)} ${c.interested_flat?.flat_no || ""}`.toLowerCase();
      if (!haystack.includes(filterSearch.toLowerCase())) return false;
    }
    return true;
  });

  const filtersActive = filterSearch || filterProjectId || filterLeaderId || filterStatus;
  const clearFilters = () => { setFilterSearch(""); setFilterProjectId(""); setFilterLeaderId(""); setFilterStatus(""); };

  const openNew = () => {
    setForm({ ...emptyForm, interested_project_id: projects?.[0]?.id || "", assigned_employee_id: user.role === "employee" ? user.id : employees[0]?.id || "" });
    setSaveError("");
    setModal("new");
  };
  const openEdit = (c) => {
    setForm({
      name: c.name, phone: c.phone || "", email: c.email || "", nid: c.nid || "", reference_source: c.reference_source || "",
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

      <div className="shadow-premium bg-white rounded-xl p-3.5 flex flex-wrap items-end gap-3">
        <label className="block w-full sm:w-auto">
          <span className="block text-xs font-medium text-slate-500 mb-1">Search</span>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className={`${inputCls} pl-8 w-full sm:w-[200px]`}
              placeholder="Name, client id, flat…"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
            />
          </div>
        </label>
        <label className="block w-[calc(50%-0.375rem)] sm:w-auto">
          <span className="block text-xs font-medium text-slate-500 mb-1">Project</span>
          <select className={`${inputCls} w-full sm:w-[160px]`} value={filterProjectId} onChange={(e) => setFilterProjectId(e.target.value)}>
            <option value="">All Projects</option>
            {(projects || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="block w-[calc(50%-0.375rem)] sm:w-auto">
          <span className="block text-xs font-medium text-slate-500 mb-1">Team Leader</span>
          <select className={`${inputCls} w-full sm:w-[160px]`} value={filterLeaderId} onChange={(e) => setFilterLeaderId(e.target.value)}>
            <option value="">All Team Leaders</option>
            {leaders.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label className="block w-[calc(50%-0.375rem)] sm:w-auto">
          <span className="block text-xs font-medium text-slate-500 mb-1">Status</span>
          <select className={`${inputCls} w-full sm:w-[150px]`} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All Status</option>
            {CUSTOMER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        {filtersActive && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 pb-2.5">
            <X size={13} /> Clear filters
          </button>
        )}
        <span className="text-xs text-slate-400 ml-auto pb-2.5">
          {filteredCustomers.length} of {(customers || []).length} customer{(customers || []).length === 1 ? "" : "s"}
        </span>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <Th>Client Name</Th><Th>Client Id</Th><Th>Project Name</Th><Th>Flat Number</Th><Th>Team Leader</Th><Th>Status</Th><Th></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-slate-800">{c.name}</Td>
                  <Td>{clientId(c.id)}</Td>
                  <Td>{c.interested_project?.name || "—"}</Td>
                  <Td>{c.interested_flat?.flat_no || "—"}</Td>
                  <Td>{c.assigned_employee?.team?.leader?.name || "—"}</Td>
                  <Td><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CUSTOMER_STATUS_COLORS[c.status] || "bg-slate-100 text-slate-600"}`}>{c.status}</span></Td>
                  <Td>
                    <RowMenu
                      onView={() => setDetailCustomer(c)}
                      onEdit={canEdit || c.assigned_employee_id === user.id ? () => openEdit(c) : null}
                      onDocuments={() => setDocsCustomer(c)}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredCustomers.length === 0 && (
            <EmptyState text={filtersActive ? "No customers match these filters" : "No customers yet"} />
          )}
        </div>
      )}

      {modal && (
        <Modal title={modal === "new" ? "Add Customer" : "Edit Customer"} onClose={() => setModal(null)} wide>
          <ErrorBanner message={saveError} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Field label="Name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Phone"><input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Email"><input className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Client Reference">
              <select className={inputCls} value={form.reference_source} onChange={(e) => setForm({ ...form, reference_source: e.target.value })}>
                <option value="">—</option>
                {CLIENT_REFERENCE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {CUSTOMER_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Follow-up Date">
              <input type="date" className={inputCls} value={form.follow_up_date} onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })} />
            </Field>
            <Field label="Project Name">
              <select
                className={inputCls} value={form.interested_project_id}
                onChange={(e) => setForm({ ...form, interested_project_id: e.target.value, interested_flat_id: "" })}
              >
                <option value="">—</option>
                {(projects || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Flat Number">
              <select
                className={inputCls} value={form.interested_flat_id}
                onChange={(e) => setForm({ ...form, interested_flat_id: e.target.value })}
                disabled={!form.interested_project_id}
              >
                <option value="">—</option>
                {flatsInForm.map((f) => <option key={f.id} value={f.id}>{f.flat_no}</option>)}
              </select>
            </Field>
            {canEdit && (
              <Field label="Assigned To Team Member">
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

      {detailCustomer && (
        <Modal title={detailCustomer.name} onClose={() => setDetailCustomer(null)}>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Name</span><span>{detailCustomer.name}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Phone</span><span>{detailCustomer.phone || "—"}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Client Id</span><span>{clientId(detailCustomer.id)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Client Reference</span><span>{detailCustomer.reference_source || "—"}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Project Name</span><span>{detailCustomer.interested_project?.name || "—"}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Flat Number</span><span>{detailCustomer.interested_flat?.flat_no || "—"}</span></div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Status</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CUSTOMER_STATUS_COLORS[detailCustomer.status] || "bg-slate-100 text-slate-600"}`}>{detailCustomer.status}</span>
            </div>
            <hr className="my-2 border-slate-100" />
            <div className="flex justify-between"><span className="text-slate-500">Team Leader</span><span>{detailCustomer.assigned_employee?.team?.leader?.name || "—"}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Assigned To Team Member</span><span>{detailCustomer.assigned_employee?.name || "—"}</span></div>
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
