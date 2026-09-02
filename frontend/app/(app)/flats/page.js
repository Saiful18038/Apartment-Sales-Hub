"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Lock, Search, X, ArrowLeftRight } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { fmtBDT, fmtLac, calcFlatPrice } from "@/lib/format";
import { STATUS, STATUS_ORDER, PROJECT_STATUSES, statusMeta } from "@/lib/status";
import { Btn, Field, inputCls, Modal, ErrorBanner, LoadingBlock, EmptyState, StatusPill } from "@/components/ui";

const emptyForm = {
  flat_no: "", floor: "", size_sft: "", price_per_sft: "", parking_charge: 500000, parking_count: 1,
  parking_number: "", utility_charge: 600000, reserve_fund: 25000, facing: "", bedroom: 3, bathroom: 3, balcony: 1, status_code: "AVAILABLE", notes: "",
};

/** One row of a floor-map card: a fixed-width label + a flex-grow box area. */
function FloorRow({ label, children }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-[68px] text-xs font-medium text-slate-500 shrink-0">{label}</div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

/**
 * Non-status info box (Address / financials / facing-handover) — "Premium
 * Color System" pass: every one of these is pure neutral slate, never a
 * decorative accent color, so color on the card means exactly one thing
 * (a flat's status, from lib/status.js) and nothing here can be mistaken
 * for one. `emphasis` carries visual weight via a darker border/text, not
 * hue, for the box that shows money (Parking/Utility).
 */
function InfoBox({ tone = "slate", title, subtitle }) {
  const tones = {
    slate: "bg-slate-50 border-slate-200 text-slate-500",
    emphasis: "bg-slate-100 border-slate-300 text-slate-700",
  };
  return (
    <div className={`rounded-[10px] border px-2.5 py-2 text-center ${tones[tone]}`}>
      {title && <div className="text-[12px] font-bold leading-[1.3] text-slate-700">{title}</div>}
      {subtitle && <div className={`text-[11px] leading-[1.3] ${title ? "mt-0.5 opacity-80" : ""}`}>{subtitle}</div>}
    </div>
  );
}

/** One project's full floor-map card — one "grid part" in the 4-column layout. */
function ProjectFloorCard({ project, flats, canEdit, onAddFlat, onSelectFlat, onShowInfo }) {
  const sorted = flats.slice().sort((a, b) => b.floor - a.floor);
  const floors = [...new Set(sorted.map((f) => f.floor))].sort((a, b) => b - a);

  return (
    <div className="shadow-premium bg-white rounded-xl p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-800 truncate">{project.name}</h3>
        {canEdit && (
          <button onClick={onAddFlat} className="text-slate-400 hover:text-[#1F3864] p-1 rounded-lg hover:bg-slate-100 transition-colors shrink-0" title="Add Flat">
            <Plus size={15} />
          </button>
        )}
      </div>

      <div className="space-y-2 flex-1">
        {floors.map((fl) => (
          <FloorRow key={fl} label={`Floor ${fl}`}>
            <div className="flex flex-col gap-1.5">
              {sorted.filter((f) => f.floor === fl).map((f) => {
                const s = statusMeta(f.status_code);
                // Roadmap Phase 11 — Employee Privacy, extended for the Team
                // hierarchy (FlatResource::canViewSale): a Sold flat's
                // customer/price/who-sold-it is withheld from anyone who
                // isn't Owner/Admin, that flat's Team Leader, or the
                // employee who made the sale — but the status itself
                // ("Sold (CR)"/"Sold (OS/SS)") is inventory classification,
                // not sensitive, so the card still names it instead of a
                // generic "(Sold Out)" that threw the CR/OS-SS distinction away.
                const isSold = ["SOLD_CR", "SOLD_OS_SS"].includes(f.status_code);
                const privacyHidden = isSold && !f.sale;

                if (privacyHidden) {
                  return (
                    <button
                      key={f.id}
                      onClick={() => onSelectFlat(f)}
                      className="w-full px-2.5 py-1.5 rounded-[10px] border text-[12px] leading-[1.3] text-center hover:shadow-md transition"
                      style={{ backgroundColor: s.fill, borderColor: s.border, color: s.text }}
                    >
                      <div className="font-bold opacity-70">{s.label}</div>
                    </button>
                  );
                }

                // Roadmap Phase 5 — a sellable flat (Available / Re-Sale /
                // Ready) shows price/size inline since that's exactly what
                // a buyer needs to see at a glance; a flat that's already
                // spoken for (Sold/Land Owner/Booked) just needs its status.
                return (
                  <button
                    key={f.id}
                    onClick={() => onSelectFlat(f)}
                    className="w-full px-2.5 py-1.5 rounded-[10px] border text-[12px] leading-[1.3] text-center hover:shadow-md transition"
                    style={{ backgroundColor: s.fill, borderColor: s.border, color: s.text }}
                  >
                    {s.sellable ? (
                      <>
                        <div className="font-bold">{f.flat_no} {f.facing ? `(${f.facing})` : ""} {fmtBDT(f.price_per_sft).replace("৳", "")}</div>
                        <div className="text-[11px] opacity-80 mt-0.5">[{Math.round(f.size_sft)} sft] {s.label}</div>
                      </>
                    ) : (
                      <>
                        <div className="font-bold">{f.flat_no}</div>
                        <div className="text-[11px] opacity-80 mt-0.5">{s.label}</div>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </FloorRow>
        ))}
        {sorted.length === 0 && <EmptyState text="No flats yet" />}

        {/* Hand-over Date / Launch Date / Facing — visible to every role
            (owner, admin, employee); only edited via the Add/Edit Project
            form, which stays owner/admin-only. */}
        <FloorRow label="">
          <Btn
            variant="primary"
            size="sm"
            onClick={() => onShowInfo(project)}
            className="w-full !justify-center rounded-[10px] py-1.5 text-[12px]"
          >
            Basic Information
          </Btn>
        </FloorRow>

        <div className="pt-1">
          <FloorRow label="Addr">
            <InfoBox tone="slate" title={project.address || "—"} />
          </FloorRow>
        </div>
        <FloorRow label="">
          <div className="rounded-[10px] border border-slate-300 bg-slate-100 text-slate-700 px-2.5 py-2 text-center">
            <div className="text-[11px] text-slate-400 leading-[1.3]">{project.name}</div>
            {sorted[0] && (
              <>
                <div className="text-[12px] font-bold leading-[1.3] mt-0.5">Parking {fmtLac(sorted[0].parking_charge)} Lac</div>
                <div className="text-[12px] font-bold leading-[1.3]">Utility {fmtLac(sorted[0].utility_charge)} Lac</div>
              </>
            )}
          </div>
        </FloorRow>
        <FloorRow label="">
          <InfoBox tone="slate" subtitle={`${project.road_facing || "—"}/Handover ${project.handover || "—"}`} />
        </FloorRow>
      </div>

      <div className="text-center text-sm font-bold text-slate-800 pt-3">
        {project.land_katha ?? "—"} Katha
      </div>
    </div>
  );
}

export default function FlatsPage() {
  const { user } = useAuth();
  const canEdit = user.role === "owner" || user.role === "admin";

  const { data: projects, loading: projectsLoading } = useApi("/projects");
  const { data: zones } = useApi("/zones");
  const { data: flatsRes, loading: flatsLoading, error, refetch } = useApi("/flats");
  const allFlats = flatsRes?.data || [];

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [addProjectId, setAddProjectId] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [detail, setDetail] = useState(null);
  const [infoProject, setInfoProject] = useState(null);
  const [exchangeFlat, setExchangeFlat] = useState(null); // flat whose parking number we're exchanging
  const [exchangeWithId, setExchangeWithId] = useState("");
  const [exchangeError, setExchangeError] = useState("");

  // Filtering system — same Location/Status/Type/Search filter bar as /projects,
  // filtering which project cards show in the grid.
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

  const openNew = (projectId) => { setAddProjectId(projectId); setForm(emptyForm); setSaveError(""); setModal("new"); };
  const openEdit = (f) => {
    setAddProjectId(f.project_id);
    setForm({
      flat_no: f.flat_no, floor: f.floor, size_sft: f.size_sft, price_per_sft: f.price_per_sft,
      parking_charge: f.parking_charge, parking_count: f.parking_count, parking_number: f.parking_number || "",
      utility_charge: f.utility_charge, reserve_fund: f.reserve_fund ?? 0,
      facing: f.facing || "", bedroom: f.bedroom ?? "", bathroom: f.bathroom ?? "", balcony: f.balcony ?? "",
      status_code: f.status_code, notes: f.notes || "",
    });
    setSaveError("");
    setModal(f.id);
  };

  const save = async () => {
    if (!form.flat_no.trim()) return;
    const payload = {
      ...form,
      project_id: Number(addProjectId),
      floor: parseInt(form.floor, 10) || 0,
      size_sft: parseFloat(form.size_sft) || 0,
      price_per_sft: parseFloat(form.price_per_sft) || 0,
      parking_charge: parseFloat(form.parking_charge) || 0,
      parking_count: parseInt(form.parking_count, 10) || 0,
      utility_charge: parseFloat(form.utility_charge) || 0,
      reserve_fund: parseFloat(form.reserve_fund) || 0,
      bedroom: form.bedroom === "" ? null : parseInt(form.bedroom, 10) || 0,
      bathroom: form.bathroom === "" ? null : parseInt(form.bathroom, 10) || 0,
      balcony: form.balcony === "" ? null : parseInt(form.balcony, 10) || 0,
    };
    try {
      if (modal === "new") await api.post("/flats", payload);
      else await api.put(`/flats/${modal}`, payload);
      setModal(null);
      refetch();
    } catch (e) {
      setSaveError(e.message || "Save failed.");
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete this flat?")) return;
    try {
      await api.del(`/flats/${id}`);
      setDetail(null);
      refetch();
    } catch (e) {
      alert(e.message || "Delete failed.");
    }
  };

  const changeStatus = async (id, status_code) => {
    try {
      await api.patch(`/flats/${id}/status`, { status_code });
      setDetail((d) => (d ? { ...d, status_code } : d));
      refetch();
    } catch (e) {
      alert(e.message || "Status change failed.");
    }
  };

  const openExchange = (flat) => {
    setExchangeFlat(flat);
    setExchangeWithId("");
    setExchangeError("");
  };

  const confirmExchange = async () => {
    if (!exchangeWithId) return;
    try {
      await api.post(`/flats/${exchangeFlat.id}/exchange-parking`, { with_flat_id: Number(exchangeWithId) });
      setExchangeFlat(null);
      setDetail(null);
      refetch();
    } catch (e) {
      setExchangeError(e.message || "Exchange failed.");
    }
  };

  const loading = projectsLoading || flatsLoading;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">Flats / Visual Floor Map</h2>

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
      ) : !projects?.length ? (
        <EmptyState text="No projects yet" />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {filteredProjects.length === 0 && (
              <div className="sm:col-span-2 xl:col-span-4">
                <EmptyState text="No projects match these filters" />
              </div>
            )}
            {filteredProjects.map((project) => (
              <ProjectFloorCard
                key={project.id}
                project={project}
                flats={allFlats.filter((f) => f.project_id === project.id)}
                canEdit={canEdit}
                onAddFlat={() => openNew(project.id)}
                onSelectFlat={setDetail}
                onShowInfo={setInfoProject}
              />
            ))}
          </div>

          <div className="shadow-premium bg-white rounded-xl p-4 flex flex-wrap gap-3">
            {STATUS_ORDER.map((c) => (
              <div key={c} className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="w-3 h-3 rounded border" style={{ backgroundColor: STATUS[c].fill, borderColor: STATUS[c].border }} />
                {STATUS[c].label}
              </div>
            ))}
          </div>
        </>
      )}

      {detail && (() => {
        // Roadmap Phase 11 — Employee Privacy. Mirrors the same check used
        // on the floor-map card: a Sold flat with no `sale` block means the
        // API withheld it because it belongs to another employee. The
        // modal must not leak anything beyond that either.
        const isSold = ["SOLD_CR", "SOLD_OS_SS"].includes(detail.status_code);
        const privacyHidden = isSold && !detail.sale;

        if (privacyHidden) {
          return (
            <Modal title={statusMeta(detail.status_code).label} onClose={() => setDetail(null)}>
              <div className="flex items-center gap-2 text-sm text-slate-500 italic py-2">
                <Lock size={14} /> This flat has been sold. Details are only visible to Owner/Admin, that flat's Team Leader, and the employee who made the sale.
              </div>
            </Modal>
          );
        }

        return (
          <Modal title={detail.flat_no} onClose={() => setDetail(null)}>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Status</span><StatusPill code={detail.status_code} /></div>
              <div className="flex justify-between"><span className="text-slate-500">Floor</span><span>{detail.floor}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Size</span><span>{detail.size_sft} sft</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Facing</span><span>{detail.facing || "—"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Bed / Bath / Balcony</span><span>{detail.bedroom}/{detail.bathroom}/{detail.balcony}</span></div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Parking Number</span>
                <span className="flex items-center gap-2">
                  {detail.parking_number || "—"}
                  {canEdit && (
                    <button
                      onClick={() => openExchange(detail)}
                      className="flex items-center gap-1 text-[11px] text-[#1F3864] hover:underline"
                      title="Exchange with another flat's parking number"
                    >
                      <ArrowLeftRight size={12} /> Exchange
                    </button>
                  )}
                </span>
              </div>
              <div className="flex justify-between"><span className="text-slate-500">Price / sft</span><span>{fmtBDT(detail.price_per_sft)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Parking Cost</span><span>{fmtBDT(calcFlatPrice(detail).parking)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Utility Cost</span><span>{fmtBDT(calcFlatPrice(detail).utility)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Reserves Fund</span><span>{fmtBDT(calcFlatPrice(detail).reserve)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Sub-Total</span><span className="font-semibold">{fmtBDT(detail.sub_total ?? calcFlatPrice(detail).total)}</span></div>
              <hr className="my-2 border-slate-100" />
              {isSold ? (
                <>
                  <div className="flex justify-between"><span className="text-slate-500">Price / sft</span><span>{fmtBDT(detail.sale.price_per_sft)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Sold Price / sft</span><span>{detail.sale.sold_price_per_sft ? fmtBDT(detail.sale.sold_price_per_sft) : "—"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Total Sold Amount</span><span className="font-semibold">{fmtBDT(detail.sale.sale_price)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Customer</span><span>{detail.sale.customer}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Customer Id</span><span>{detail.sale.customer_id}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Client Reference</span><span>{detail.sale.client_reference || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Sale Date</span><span>{detail.sale.date}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Team Leader</span><span>{detail.sale.team_leader || "—"}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Team Member</span><span>{detail.sale.team_member}</span></div>
                </>
              ) : (
                <div className="text-xs text-slate-400 italic">No sale recorded.</div>
              )}
              {canEdit && (
                <div className="pt-3 flex flex-wrap gap-2">
                  <select
                    className={inputCls}
                    style={{ width: 180 }}
                    value={detail.status_code}
                    onChange={(e) => changeStatus(detail.id, e.target.value)}
                  >
                    {STATUS_ORDER.map((c) => <option key={c} value={c}>{STATUS[c].label}</option>)}
                  </select>
                  <Btn size="sm" variant="outline" onClick={() => { openEdit(detail); setDetail(null); }}><Pencil size={13} /> Edit Details</Btn>
                  <Btn size="sm" variant="danger" onClick={() => remove(detail.id)}><Trash2 size={13} /> Delete</Btn>
                </div>
              )}
            </div>
          </Modal>
        );
      })()}

      {infoProject && (
        <Modal title={`${infoProject.name} — Basic Information`} onClose={() => setInfoProject(null)}>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Hand-over Date</span><span>{infoProject.handover || "—"}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Launch Date</span><span>{infoProject.launch_date || "—"}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Facing</span><span>{infoProject.road_facing || "—"}</span></div>
          </div>
        </Modal>
      )}

      {exchangeFlat && (() => {
        // Same project only — parking is physically tied to one building's
        // garage (see FlatController::exchangeParking).
        const candidates = allFlats.filter((f) => f.project_id === exchangeFlat.project_id && f.id !== exchangeFlat.id);
        return (
          <Modal title={`Exchange Parking — ${exchangeFlat.flat_no}`} onClose={() => setExchangeFlat(null)}>
            <ErrorBanner message={exchangeError} />
            <div className="text-sm text-slate-500 mb-3">
              Current parking number: <span className="font-semibold text-slate-700">{exchangeFlat.parking_number || "—"}</span>
            </div>
            <Field label="Exchange with">
              <select className={inputCls} value={exchangeWithId} onChange={(e) => setExchangeWithId(e.target.value)}>
                <option value="">Select a flat…</option>
                {candidates.map((f) => (
                  <option key={f.id} value={f.id}>{f.flat_no} — parking {f.parking_number || "—"}</option>
                ))}
              </select>
            </Field>
            {candidates.length === 0 && <div className="text-xs text-slate-400 italic">No other flats in this project.</div>}
            <div className="flex justify-end gap-2 mt-2">
              <Btn variant="outline" onClick={() => setExchangeFlat(null)}>Cancel</Btn>
              <Btn onClick={confirmExchange} disabled={!exchangeWithId}><ArrowLeftRight size={14} /> Exchange</Btn>
            </div>
          </Modal>
        );
      })()}

      {modal && (
        <Modal title={modal === "new" ? "Add Flat" : "Edit Flat"} onClose={() => setModal(null)} wide>
          <ErrorBanner message={saveError} />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4">
            <Field label="Flat No"><input className={inputCls} value={form.flat_no} onChange={(e) => setForm({ ...form, flat_no: e.target.value })} /></Field>
            <Field label="Floor"><input type="number" className={inputCls} value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} /></Field>
            <Field label="Size (sft)"><input type="number" className={inputCls} value={form.size_sft} onChange={(e) => setForm({ ...form, size_sft: e.target.value })} /></Field>
            <Field label="Price / sft"><input type="number" className={inputCls} value={form.price_per_sft} onChange={(e) => setForm({ ...form, price_per_sft: e.target.value })} /></Field>
            <Field label="Parking Charge"><input type="number" className={inputCls} value={form.parking_charge} onChange={(e) => setForm({ ...form, parking_charge: e.target.value })} /></Field>
            <Field label="Parking Count"><input type="number" className={inputCls} value={form.parking_count} onChange={(e) => setForm({ ...form, parking_count: e.target.value })} /></Field>
            <Field label="Parking Number"><input className={inputCls} value={form.parking_number} onChange={(e) => setForm({ ...form, parking_number: e.target.value })} placeholder="e.g. A9" /></Field>
            <Field label="Utility Charge"><input type="number" className={inputCls} value={form.utility_charge} onChange={(e) => setForm({ ...form, utility_charge: e.target.value })} /></Field>
            <Field label="Reserves Fund"><input type="number" className={inputCls} value={form.reserve_fund} onChange={(e) => setForm({ ...form, reserve_fund: e.target.value })} /></Field>
            <Field label="Facing"><input className={inputCls} value={form.facing} onChange={(e) => setForm({ ...form, facing: e.target.value })} /></Field>
            <Field label="Bedroom"><input type="number" min="0" className={inputCls} value={form.bedroom} onChange={(e) => setForm({ ...form, bedroom: e.target.value })} /></Field>
            <Field label="Bathroom"><input type="number" min="0" className={inputCls} value={form.bathroom} onChange={(e) => setForm({ ...form, bathroom: e.target.value })} /></Field>
            <Field label="Balcony"><input type="number" min="0" className={inputCls} value={form.balcony} onChange={(e) => setForm({ ...form, balcony: e.target.value })} /></Field>
            <Field label="Status">
              <select className={inputCls} value={form.status_code} onChange={(e) => setForm({ ...form, status_code: e.target.value })}>
                {STATUS_ORDER.map((c) => <option key={c} value={c}>{STATUS[c].label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Notes"><textarea className={inputCls} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 mt-2">
            <Btn variant="outline" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={save}>Save</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
