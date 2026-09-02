"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Paperclip, Search, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { STATUS, STATUS_ORDER, PROJECT_STATUSES } from "@/lib/status";
import { Btn, Field, inputCls, Modal, ErrorBanner, LoadingBlock, EmptyState } from "@/components/ui";
import DocumentsPanel from "@/components/DocumentsPanel";
import PageBackdrop, { PalmFrond } from "@/components/PageBackdrop";

const emptyForm = {
  zone_id: "", type: "regular", name: "", code: "", address: "", road_facing: "",
  land_katha: "", total_floors: "", status: "Ongoing", handover: "", launch_date: "",
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
      status: p.status, handover: p.handover || "", launch_date: p.launch_date || "",
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
    <PageBackdrop>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[32px] font-extrabold text-[#101F3D] tracking-tight">Projects</h2>
          {canEdit && (
            <Btn onClick={openNew} className="!rounded-full !px-6 !py-3 !shadow-lg !shadow-[#101F3D]/30">
              <Plus size={16} /> Add Project
            </Btn>
          )}
        </div>

        <ErrorBanner message={error} />

        <div className="bg-white/50 backdrop-blur-md border border-white/60 rounded-[24px] shadow-lg shadow-black/5 p-5 flex flex-wrap items-end gap-4 relative overflow-hidden">
          <PalmFrond className="pointer-events-none absolute -top-2 right-6 w-14 h-14 text-[#D9B87A] rotate-[10deg] opacity-80" />
          <PalmFrond className="pointer-events-none absolute -bottom-3 -left-3 w-12 h-12 text-[#D9B87A] rotate-[195deg] opacity-70" />
          <label className="block w-full sm:w-auto">
            <span className="block text-xs font-semibold text-[#2c3e63]/70 mb-1">Search</span>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className={`${inputCls} pl-8 w-full sm:w-[200px] !bg-white/80 !border-white/70`}
                placeholder="Name, code, address…"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
              />
            </div>
          </label>
          <label className="block w-[calc(50%-0.375rem)] sm:w-auto">
            <span className="block text-xs font-semibold text-[#2c3e63]/70 mb-1">Location</span>
            <select className={`${inputCls} w-full sm:w-[160px] !bg-white/80 !border-white/70`} value={filterZoneId} onChange={(e) => setFilterZoneId(e.target.value)}>
              <option value="">All Locations</option>
              {(zones || []).map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </label>
          <label className="block w-[calc(50%-0.375rem)] sm:w-auto">
            <span className="block text-xs font-semibold text-[#2c3e63]/70 mb-1">Status</span>
            <select className={`${inputCls} w-full sm:w-[150px] !bg-white/80 !border-white/70`} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All Status</option>
              {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="block w-[calc(50%-0.375rem)] sm:w-auto">
            <span className="block text-xs font-semibold text-[#2c3e63]/70 mb-1">Type</span>
            <select className={`${inputCls} w-full sm:w-[140px] !bg-white/80 !border-white/70`} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">All Types</option>
              <option value="regular">Regular</option>
              <option value="rr">Re-Sale (RR)</option>
            </select>
          </label>
          {filtersActive && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs font-medium text-[#2c3e63]/70 hover:text-[#122347] pb-2.5">
              <X size={13} /> Clear filters
            </button>
          )}
          <span className="text-xs font-medium text-[#2c3e63]/60 ml-auto pb-2.5">
            {filteredProjects.length} of {(projects || []).length} project{(projects || []).length === 1 ? "" : "s"}
          </span>
        </div>

        {loading ? (
          <LoadingBlock />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredProjects.map((p) => {
              const counts = p.status_counts || {};
              return (
                <div key={p.id} className="bg-[#FBF7EC] rounded-[22px] border border-[#EAE0C4] p-5 shadow-lg shadow-black/5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[17px] font-extrabold tracking-wide text-[#101F3D]">{p.name}</div>
                      <div className="text-[13px] text-[#101F3D]/55 mt-1">{p.zone?.name} · {p.address}</div>
                      <div className="text-[13px] text-[#101F3D]/55">{p.road_facing} · {p.land_katha ?? "—"} Katha · {p.total_floors} Floors</div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => setDocsProject(p)} className="text-[#101F3D]/45 hover:text-[#101F3D]" title="Documents">
                        <Paperclip size={15} />
                      </button>
                      {canEdit && (
                        <>
                          <button onClick={() => openEdit(p)} className="text-[#101F3D]/45 hover:text-[#101F3D]">
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => remove(p.id)} className="text-[#101F3D]/45 hover:text-red-500">
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-4">
                    <span className={`text-xs px-3 py-1.5 rounded-full font-bold tracking-wide ${p.type === "rr" ? "bg-[#F6E3E8] text-[#9D3E5C]" : "bg-[#EFE6C8] text-[#8A6D1E]"}`}>
                      {p.type === "rr" ? "RE-SALE" : "REGULAR"}
                    </span>
                    <span className="text-xs px-3 py-1.5 rounded-full font-bold bg-[#DCEAFB] text-[#1D4ED8]">{p.status}</span>
                    <span className="text-xs px-3 py-1.5 rounded-full font-bold bg-[#E7ECF5] text-[#475569]">Total {p.flats_count ?? 0}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2.5">
                    {STATUS_ORDER.filter((c) => counts[c] > 0).map((c) => (
                      <span
                        key={c}
                        className="text-xs px-3 py-1.5 rounded-full font-semibold border"
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
              <Field label="Launch Date">
                <input className={inputCls} value={form.launch_date} onChange={(e) => setForm({ ...form, launch_date: e.target.value })} placeholder="e.g. Jan-25" />
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
    </PageBackdrop>
  );
}
