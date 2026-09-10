"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, FileText, FileSpreadsheet, Printer, Save, AlertTriangle } from "lucide-react";
import { api, getToken } from "@/lib/api";
import { fmtBDT } from "@/lib/format";
import { unitLabel } from "@/lib/units";
import { inputCls, ErrorBanner, Th, Td } from "@/components/ui";

const LINE_TYPES = [
  { value: "item", label: "Item" },
  { value: "rebate", label: "Less: Rebate" },
  { value: "subtotal", label: "Sub Total" },
  { value: "revised_subtotal", label: "Revised Sub Total" },
  { value: "total", label: "Total" },
];
const COMPUTED = ["subtotal", "revised_subtotal", "total"];
const METHODS = ["Bank Transfer", "Cheque", "Cash", "Mobile Banking"];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Mirror of PriceSchedule::recalculate() on the API — keeps the figures
 *  live while the owner types, before anything is saved. */
function recompute(lines, sizeSft) {
  const size = Number(sizeSft) || 0;
  let runningItems = 0, rebatesSinceSub = 0, lastSubtotal = null, lastRevised = null;
  return lines.map((l) => {
    let amount = Number(l.amount) || 0;
    switch (l.line_type) {
      case "item":
        if (l.rate_per_sft !== "" && l.rate_per_sft != null && size > 0) amount = round2(Number(l.rate_per_sft) * size);
        runningItems += amount;
        break;
      case "rebate":
        rebatesSinceSub += amount;
        break;
      case "subtotal":
        amount = round2(runningItems);
        lastSubtotal = amount; runningItems = 0; rebatesSinceSub = 0;
        break;
      case "revised_subtotal":
        amount = round2((lastSubtotal ?? runningItems) - rebatesSinceSub);
        lastRevised = amount; runningItems = 0; rebatesSinceSub = 0;
        break;
      case "total":
        amount = round2((lastRevised ?? lastSubtotal ?? 0) + runningItems);
        runningItems = 0;
        break;
      default:
        break;
    }
    return { ...l, amount };
  });
}

const grandTotalOf = (computedLines) => {
  const totals = computedLines.filter((l) => l.line_type === "total");
  if (totals.length) return Number(totals[totals.length - 1].amount) || 0;
  const items = computedLines.filter((l) => l.line_type === "item").reduce((a, l) => a + (Number(l.amount) || 0), 0);
  const rebates = computedLines.filter((l) => l.line_type === "rebate").reduce((a, l) => a + (Number(l.amount) || 0), 0);
  return round2(items - rebates);
};

export default function PriceSchedule({ saleId, canManage }) {
  const [schedule, setSchedule] = useState(null);
  const [header, setHeader] = useState({});
  const [lines, setLines] = useState([]);
  const [installments, setInstallments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState("");
  const [allowMismatch, setAllowMismatch] = useState(false);

  const hydrate = (d) => {
    setSchedule(d);
    setHeader({
      agreement_date: d.agreement_date || "",
      project_name: d.project_name || "",
      project_address: d.project_address || "",
      apartment_type: d.apartment_type || "",
      apartment_facing: d.apartment_facing || "",
      floor: d.floor || "",
      size_sft: d.size_sft ?? "",
      rate_per_sft: d.rate_per_sft ?? "",
      terms: d.terms || "",
    });
    setLines((d.lines || []).map((l) => ({
      id: l.id, sort: l.sort, description: l.description, line_type: l.line_type,
      rate_per_sft: l.rate_per_sft ?? "", amount: l.amount ?? 0,
    })));
    setInstallments((d.installments || []).map((i) => ({
      id: i.id, sort: i.sort, milestone: i.milestone, term: i.term || "On / Before",
      due_date: i.due_date || "", amount: i.amount ?? 0, status: i.status,
      paid_on: i.paid_on || "", method: "Bank Transfer", note: i.note || "",
      is_overdue: i.is_overdue, payment_id: i.payment_id,
    })));
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await api.get(`/sales/${saleId}/price-schedule`);
        if (alive) hydrate(d);
      } catch (e) {
        if (alive) setLoadError(e.message || "Failed to load the schedule.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [saleId]);

  const computedLines = useMemo(() => recompute(lines, header.size_sft), [lines, header.size_sft]);
  const grandTotal = useMemo(() => grandTotalOf(computedLines), [computedLines]);
  const installmentsTotal = useMemo(
    () => round2(installments.reduce((a, i) => a + (Number(i.amount) || 0), 0)),
    [installments]
  );
  const totalsMatch = Math.abs(grandTotal - installmentsTotal) < 0.01;
  const salePrice = Number(schedule?.sale?.sale_price) || 0;
  const priceVsSale = round2(grandTotal - salePrice);

  // ---- price lines ----
  const setLine = (idx, patch) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const addLine = (line_type) =>
    setLines((ls) => [...ls, { id: null, sort: ls.length, description: "", line_type, rate_per_sft: "", amount: 0 }]);
  const removeLine = (idx) => setLines((ls) => ls.filter((_, i) => i !== idx).map((l, i) => ({ ...l, sort: i })));

  // ---- installments ----
  const setInst = (idx, patch) => setInstallments((is) => is.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const addInst = () =>
    setInstallments((is) => [
      ...is,
      { id: null, sort: is.length, milestone: "", term: "On / Before", due_date: "", amount: 0, status: "pending", paid_on: "", method: "Bank Transfer", note: "" },
    ]);
  const removeInst = (idx) => setInstallments((is) => is.filter((_, i) => i !== idx).map((r, i) => ({ ...r, sort: i })));

  const save = async () => {
    setSaving(true);
    setSaveError("");
    setSavedNote("");
    try {
      const payload = {
        ...header,
        size_sft: header.size_sft === "" ? null : Number(header.size_sft),
        rate_per_sft: header.rate_per_sft === "" ? null : Number(header.rate_per_sft),
        allow_mismatch: allowMismatch,
        lines: computedLines.map((l, i) => ({
          id: l.id, sort: i, description: l.description, line_type: l.line_type,
          rate_per_sft: l.rate_per_sft === "" ? null : Number(l.rate_per_sft),
          amount: Number(l.amount) || 0,
        })),
        installments: installments.map((r, i) => ({
          id: r.id, sort: i, milestone: r.milestone, term: r.term || "On / Before",
          due_date: r.due_date || null, amount: Number(r.amount) || 0, status: r.status,
          paid_on: r.status === "paid" ? (r.paid_on || null) : null,
          method: r.method || "Bank Transfer", note: r.note || null,
        })),
      };
      const d = await api.put(`/sales/${saleId}/price-schedule`, payload);
      hydrate(d);
      setAllowMismatch(false);
      setSavedNote("Saved.");
    } catch (e) {
      setSaveError(e.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const download = (kind) =>
    api.download(`/sales/${saleId}/price-schedule/${kind}`, `Price-Schedule-${schedule?.sale?.flat_no || saleId}.${kind === "pdf" ? "pdf" : "xlsx"}`);

  const printPdf = async () => {
    const res = await fetch(`/api/sales/${saleId}/price-schedule/pdf?inline=1`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const w = window.open(url);
    if (w) w.onload = () => w.print();
  };

  if (loading) return <div className="text-sm text-slate-400 py-6">Loading schedule…</div>;
  if (loadError) return <ErrorBanner message={loadError} />;

  const hField = (key, props = {}) => (
    <input
      className={`${inputCls} !py-1 text-sm`}
      value={header[key] ?? ""}
      onChange={(e) => setHeader((h) => ({ ...h, [key]: e.target.value }))}
      disabled={!canManage}
      {...props}
    />
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">Final Price &amp; Payment Schedule</h3>
        <div className="flex items-center gap-3">
          <button onClick={() => download("pdf")} className="flex items-center gap-1.5 text-xs font-medium text-[#1F3864] hover:underline">
            <FileText size={14} /> Export PDF
          </button>
          <button onClick={printPdf} className="flex items-center gap-1.5 text-xs font-medium text-[#1F3864] hover:underline">
            <Printer size={14} /> Print
          </button>
          <button onClick={() => download("excel")} className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:underline">
            <FileSpreadsheet size={14} /> Export Excel
          </button>
        </div>
      </div>

      {/* ---- Header / metadata ---- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
        <label className="text-xs text-slate-500">Project name{hField("project_name")}</label>
        <label className="text-xs text-slate-500">Address{hField("project_address")}</label>
        <label className="text-xs text-slate-500">Apartment type{hField("apartment_type")}</label>
        <label className="text-xs text-slate-500">Facing{hField("apartment_facing")}</label>
        <label className="text-xs text-slate-500">Size (SFT){hField("size_sft", { type: "number", step: "0.01" })}</label>
        <label className="text-xs text-slate-500">Floor{hField("floor")}</label>
        {/* Unit — which apartment line of the project this sale's flat sits
            in ("A-1472 (9th)" -> "A-1472"). Read-only, from the flat on
            record; see lib/units.js. */}
        <label className="text-xs text-slate-500">Unit
          <input className={`${inputCls} !py-1 text-sm`} value={unitLabel(schedule?.sale?.flat_no)} disabled readOnly />
        </label>
        <label className="text-xs text-slate-500">Rate / SFT{hField("rate_per_sft", { type: "number", step: "0.01" })}</label>
        <label className="text-xs text-slate-500">Agreement date{hField("agreement_date", { type: "date" })}</label>
      </div>

      {/* ---- Price calculation ---- */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Price</h4>
          {canManage && (
            <div className="flex items-center gap-2">
              <button onClick={() => addLine("item")} className="flex items-center gap-1 text-xs font-medium text-[#1F3864] hover:underline"><Plus size={13} /> Item</button>
              <button onClick={() => addLine("rebate")} className="flex items-center gap-1 text-xs font-medium text-[#1F3864] hover:underline"><Plus size={13} /> Rebate</button>
              <button onClick={() => addLine("subtotal")} className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:underline"><Plus size={13} /> Sub Total</button>
              <button onClick={() => addLine("total")} className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:underline"><Plus size={13} /> Total</button>
            </div>
          )}
        </div>
        <div className="border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr><Th>Description</Th><Th>Type</Th><Th>Rate / SFT</Th><Th>Amount</Th><Th></Th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {computedLines.map((l, idx) => {
                const computed = COMPUTED.includes(l.line_type);
                return (
                  <tr key={l.id ?? `n${idx}`} className={computed ? "bg-slate-50/60 font-medium" : ""}>
                    <Td>
                      <input
                        className={`${inputCls} !py-1 text-xs w-full`}
                        value={l.description}
                        onChange={(e) => setLine(idx, { description: e.target.value })}
                        disabled={!canManage}
                      />
                    </Td>
                    <Td>
                      <select
                        className={`${inputCls} !py-1 text-xs`}
                        value={l.line_type}
                        onChange={(e) => setLine(idx, { line_type: e.target.value })}
                        disabled={!canManage}
                      >
                        {LINE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </Td>
                    <Td>
                      {l.line_type === "item" ? (
                        <input
                          type="number" step="0.01"
                          className={`${inputCls} !py-1 text-xs w-28`}
                          value={l.rate_per_sft}
                          onChange={(e) => setLine(idx, { rate_per_sft: e.target.value })}
                          placeholder="—"
                          disabled={!canManage}
                        />
                      ) : <span className="text-slate-300">—</span>}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {computed || (l.line_type === "item" && l.rate_per_sft !== "" && l.rate_per_sft != null) ? (
                        <span className={l.line_type === "rebate" ? "text-red-600" : ""}>{fmtBDT(l.amount)}</span>
                      ) : (
                        <input
                          type="number" step="0.01"
                          className={`${inputCls} !py-1 text-xs w-36`}
                          value={l.amount}
                          onChange={(e) => setLine(idx, { amount: e.target.value })}
                          disabled={!canManage}
                        />
                      )}
                    </Td>
                    <Td>
                      {canManage && !computed && (
                        <button onClick={() => removeLine(idx)} className="text-slate-400 hover:text-red-500" title="Remove row"><Trash2 size={13} /></button>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end mt-2 text-sm">
          <span className="text-slate-500 mr-3">Total payable</span>
          <span className="font-semibold">{fmtBDT(grandTotal)}</span>
        </div>
        {Math.abs(priceVsSale) >= 1 && (
          <div className="mt-1 text-xs text-amber-700 flex items-center gap-1.5 justify-end">
            <AlertTriangle size={12} /> Total differs from the sale price on record ({fmtBDT(salePrice)}) by {fmtBDT(priceVsSale)}
          </div>
        )}
      </div>

      {/* ---- Payment schedule ---- */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Payment Schedule</h4>
          {canManage && (
            <button onClick={addInst} className="flex items-center gap-1 text-xs font-medium text-[#1F3864] hover:underline"><Plus size={13} /> Add instalment</button>
          )}
        </div>
        <div className="border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr><Th>Milestone</Th><Th>Term</Th><Th>Due date</Th><Th>Amount</Th><Th>Status</Th><Th></Th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {installments.map((r, idx) => (
                <tr key={r.id ?? `n${idx}`} className={r.is_overdue ? "bg-red-50/40" : ""}>
                  <Td>
                    <input className={`${inputCls} !py-1 text-xs w-full`} value={r.milestone} onChange={(e) => setInst(idx, { milestone: e.target.value })} disabled={!canManage} />
                  </Td>
                  <Td>
                    <input className={`${inputCls} !py-1 text-xs w-28`} value={r.term} onChange={(e) => setInst(idx, { term: e.target.value })} disabled={!canManage} />
                  </Td>
                  <Td>
                    <input type="date" className={`${inputCls} !py-1 text-xs`} value={r.due_date} onChange={(e) => setInst(idx, { due_date: e.target.value })} disabled={!canManage} />
                  </Td>
                  <Td>
                    <input type="number" step="0.01" className={`${inputCls} !py-1 text-xs w-36`} value={r.amount} onChange={(e) => setInst(idx, { amount: e.target.value })} disabled={!canManage} />
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <select
                        className={`${inputCls} !py-1 text-xs`}
                        value={r.status}
                        onChange={(e) => setInst(idx, { status: e.target.value })}
                        disabled={!canManage}
                      >
                        <option value="pending">Pending</option>
                        <option value="paid">Paid</option>
                      </select>
                      {r.is_overdue && r.status !== "paid" && <span className="text-[10px] font-semibold text-red-600 uppercase">Overdue</span>}
                    </div>
                    {r.status === "paid" && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <input type="date" className={`${inputCls} !py-1 text-[11px]`} value={r.paid_on} onChange={(e) => setInst(idx, { paid_on: e.target.value })} disabled={!canManage} title="Paid on" />
                        {!r.payment_id && (
                          <select className={`${inputCls} !py-1 text-[11px]`} value={r.method} onChange={(e) => setInst(idx, { method: e.target.value })} disabled={!canManage} title="Method">
                            {METHODS.map((m) => <option key={m}>{m}</option>)}
                          </select>
                        )}
                      </div>
                    )}
                  </Td>
                  <Td>
                    {canManage && (
                      <button onClick={() => removeInst(idx)} className="text-slate-400 hover:text-red-500" title="Remove instalment"><Trash2 size={13} /></button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end mt-2 text-sm">
          <span className="text-slate-500 mr-3">Instalments total</span>
          <span className={`font-semibold ${totalsMatch ? "" : "text-red-600"}`}>{fmtBDT(installmentsTotal)}</span>
        </div>
      </div>

      {/* ---- Terms ---- */}
      <label className="block text-xs text-slate-500">
        Terms / notes
        <textarea
          rows={3}
          className={`${inputCls} !py-1.5 text-sm w-full mt-1`}
          value={header.terms}
          onChange={(e) => setHeader((h) => ({ ...h, terms: e.target.value }))}
          disabled={!canManage}
        />
      </label>

      {/* ---- Save ---- */}
      {canManage && (
        <div className="border-t border-slate-200 pt-4 space-y-2">
          {!totalsMatch && (
            <div className="text-xs px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 flex items-center gap-2">
              <AlertTriangle size={13} />
              Instalments ({fmtBDT(installmentsTotal)}) don’t add up to the Total ({fmtBDT(grandTotal)}).
              <label className="flex items-center gap-1 ml-auto">
                <input type="checkbox" checked={allowMismatch} onChange={(e) => setAllowMismatch(e.target.checked)} />
                Save anyway
              </label>
            </div>
          )}
          <ErrorBanner message={saveError} />
          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving || (!totalsMatch && !allowMismatch)}
              className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#1F3864] hover:brightness-110 disabled:opacity-50 rounded-lg px-4 py-2"
            >
              <Save size={14} /> {saving ? "Saving…" : "Save schedule"}
            </button>
            {savedNote && <span className="text-xs text-emerald-600">{savedNote}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
