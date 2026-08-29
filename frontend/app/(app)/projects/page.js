"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Paperclip, Search, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { STATUS, STATUS_ORDER, PROJECT_STATUSES } from "@/lib/status";
import { Btn, Field, inputCls, Modal, PageHeader, ErrorBanner, LoadingBlock, EmptyState } from "@/components/ui";
import DocumentsPanel from "@/components/DocumentsPanel";

const emptyForm = {
  zone_id: "", type: "regular", name: "", code: "", address: "", road_facing: "",
  land_katha: "", total_floors: "", status: "Ongoing", handover: "",
};

export default function ProjectsPage() {
  const { user } = useAuth();
  const canEdit = user.role === "owner" || user.role === "admin";
  const { data: projects, loading, error, refetch } = useApi("/projects");
  const { data: zones } = useApi("/zones");

  const [modal, setModal] = useState(null); // "new" | project.id | null
  const [form, setForm] = useState(emptyForm);
  const [saveError, setSaveError] = useState("");
  const [docsProject, setDocsProject] = useState(null);

  // Filtering system — Location (Zone), Status, Type, and free-text search.
  const [filterZoneId, setFilterZoneId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterSearch, setFilterSearch] = useState("");

  const filteredProjects = (projects || []).filter((p) => {
    if (filterZoneId && String(p.zone_id) !== filterZoneId) return false;
    if (filterStatus && p.status !== filterStatus) return false;
    if (filterType && p.type !== filterType) return false;
    if (filterSearch && !`${p.name} ${p.code || ""} ${p.address || ""}`.toLowerCase().includes(filterSearch.toLowerCase())) return false;
    return true;
  });

  const filtersActive = filterZoneId || filterStatus || filterType || filterSearch;
  const clearFilters = () => { setFilterZoneId(""); setFilterStatus(""); setFilterType(""); setFilterSearch(""); };

  const openNew = () => {
    setForm({ ...emptyForm, zone_id: zones?.[0]?.id || "" });
    setSaveError("");
    setModal("new");
  };
  const openEdit = (p) => {
    setForm({
      zone_id: p.zone_id, type: p.type, name: p.name, code: p.code || "", address: p.address || "",
      road_facing: p.road_facing || "", land_katha: p.land_katha ?? "", total_floors: p.total_floors ?? "",
      status: p.status, handover: p.handover || "",
    });
    setSaveError("");
    setModal(p.id);
  };

  const save = async () => {
    if (!form.name.trim() || !form.zone_id) return;
    const payload = {
      ...form,
      zone_id: Number(form.zone_id),
      land_katha: form.land_katha === "" ? null : parseFloat(form.land_katha),
      total_floors: form.total_floors === "" ? 0 : parseInt(form.total_floors, 10),
    };
    try {
      if (modal === "new") await api.post("/projects", payload);
      else await api.put(`/projects/${modal}`, payload);
      setModal(null);
      refetch();
    } catch (e) {
      setSaveError(e.message || "Save failed.");
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete this project? Its flats will also be removed.")) return;
    try {
      await api.del(`/projects/${id}`);
      refetch();
    } catch (e) {
      alert(e.message || "Delete failed.");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Projects">
        {canEdit && <Btn onClick={openNew}><Plus size={15} /> Add Project</Btn>}
      </PageHeader>

      <ErrorBanner message={error} />

      <div className="shadow-premium bg-white rounded-xl p-3.5 flex flex-wrap items-end gap-3">
        <label className="block w-full sm:w-auto">
          <span className="block text-xs font-medium text-slate-500 mb-1">Search</span>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className={`${inputCls} pl-8 w-full sm:w-[200px]`}
              placeholder="Name, code, address…"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
            />
          </div>
        </label>
        <label className="block w-[calc(50%-0.375rem)] sm:w-auto">
          <span className="block text-xs font-medium text-slate-500 mb-1">Location</span>
          <select className={`${inputCls} w-full sm:w-[160px]`} value={filterZoneId} onChange={(e) => setFilterZoneId(e.target.value)}>
            <option value="">All Locations</option>
            {(zones || []).map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </label>
        <label className="block w-[calc(50%-0.375rem)] sm:w-auto">
          <span className="block text-xs font-medium text-slate-500 mb-1">Status</span>
          <select className={`${inputCls} w-full sm:w-[150px]`} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All Status</option>
            {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="block w-[calc(50%-0.375rem)] sm:w-auto">
          <span className="block text-xs font-medium text-slate-500 mb-1">Type</span>
          <select className={`${inputCls} w-full sm:w-[140px]`} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">All Types</option>
            <option value="regular">Regular</option>
            <option value="rr">Re-Sale (RR)</option>
          </select>
        </label>
        {filtersActive && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 pb-2.5">
            <X size={13} /> Clear filters
          </button>
        )}
        <span className="text-xs text-slate-400 ml-auto pb-2.5">
          {filteredProjects.length} of {(projects || []).length} project{(projects || []).length === 1 ? "" : "s"}
        </span>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredProjects.map((p) => {
            const counts = p.status_counts || {};
            return (
              <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-slate-800">{p.name}</div>
                    <div className="text-xs text-slate-400">{p.zone?.name} · {p.address}</div>
                    <div className="text-xs text-slate-400">{p.road_facing} · {p.land_katha ?? "—"} Katha · {p.total_floors} Floors</div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setDocsProject(p)} className="text-slate-400 hover:text-slate-600" title="Documents">
                      <Paperclip size={14} />
                    </button>
                    {canEdit && (
                      <>
                        <button onClick={() => openEdit(p)} className="text-slate-400 hover:text-slate-600">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => remove(p.id)} className="text-slate-400 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${p.type === "rr" ? "bg-pink-100 text-pink-700" : "bg-slate-100 text-slate-600"}`}>
                    {p.type === "rr" ? "RE-SALE" : "REGULAR"}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700">{p.status}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">Total {p.flats_count ?? 0}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {STATUS_ORDER.filter((c) => counts[c] > 0).map((c) => (
                    <span
                      key={c}
                      className="text-[10px] px-1.5 py-0.5 rounded border"
                      style={{ backgroundColor: STATUS[c].fill, borderColor: STATUS[c].border, color: STATUS[c].text }}
                    >
                      {STATUS[c].label} {counts[c]}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          {filteredProjects.length === 0 && (
            <EmptyState text={filtersActive ? "No projects match these filters" : "No projects yet"} />
          )}
        </div>
      )}

      {modal && (
        <Modal title={modal === "new" ? "Add Project" : "Edit Project"} onClose={() => setModal(null)} wide>
          <ErrorBanner message={saveError} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Field label="Project Name">
              <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Project Code">
              <input className={inputCls} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </Field>
            <Field label="Zone">
              <select className={inputCls} value={form.zone_id} onChange={(e) => setForm({ ...form, zone_id: e.target.value })}>
                {(zones || []).map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </Field>
            <Field label="Type">
              <select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="regular">Regular</option>
                <option value="rr">Re-Sale (RR)</option>
              </select>
            </Field>
            <Field label="Address">
              <input className={inputCls} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <Field label="Road Facing">
              <input className={inputCls} value={form.road_facing} onChange={(e) => setForm({ ...form, road_facing: e.target.value })} />
            </Field>
            <Field label="Land (Katha)">
              <input type="number" className={inputCls} value={form.land_katha} onChange={(e) => setForm({ ...form, land_katha: e.target.value })} />
            </Field>
            <Field label="Total Floors">
              <input type="number" className={inputCls} value={form.total_floors} onChange={(e) => setForm({ ...form, total_floors: e.target.value })} />
            </Field>
            <Field label="Status">
              <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {PROJECT_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Handover Date">
              <input className={inputCls} value={form.handover} onChange={(e) => setForm({ ...form, handover: e.target.value })} placeholder="e.g. Nov-28" />
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Btn variant="outline" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={save}>Save</Btn>
          </div>
        </Modal>
      )}

      {docsProject && (
        <Modal title={`Documents — ${docsProject.name}`} onClose={() => setDocsProject(null)} wide>
          <DocumentsPanel documentableType="project" documentableId={docsProject.id} />
        </Modal>
      )}
    </div>
  );
}
