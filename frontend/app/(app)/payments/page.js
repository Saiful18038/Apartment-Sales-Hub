"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Plus, Paperclip, FileSpreadsheet, Building2, Upload, Trash2, Check, Pencil, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { fmtBDT, fmtDate } from "@/lib/format";
import { inputCls, Modal, PageHeader, ErrorBanner, LoadingBlock, EmptyState, Th, Td } from "@/components/ui";
import DocumentsPanel from "@/components/DocumentsPanel";

const METHODS = ["Bank Transfer", "Cheque", "Cash", "Mobile Banking"];

/** "CUST-00001" — same formatting used on Customers/Bookings/Sales/FlatResource. */
const clientId = (id) => "CUST-" + String(id).padStart(5, "0");

/**
 * Owner's request: instead of a flat Total/Paid/Due row plus a separate
 * page-wide Payment History list, each sale gets one "Excel Sheet" — the
 * single entry point for that sale's whole payment ledger (there used to
 * be a separate "Payment Schedule" button too; the owner asked for just
 * one). Opening it shows every installment, oldest to newest ("A to Z"),
 * with a running paid/due balance, full Add/Edit/View/Delete on each row,
 * and a real, round-trippable .xlsx file: one click downloads it
 * (downloadSchedule), and the same shape of file can be uploaded back in
 * (parseSpreadsheet) to bulk-add payments. Uses SheetJS (xlsx) for genuine
 * Excel read/write rather than a hand-rolled CSV, so a file opened and
 * edited in real Excel round-trips correctly.
 */
function downloadSchedule(sale, schedulePayments) {
  const rows = [["Date", "Method", "Amount", "Recorded By", "Running Paid", "Running Due"]];
  let running = 0;
  for (const p of schedulePayments) {
    running += Number(p.amount);
    rows.push([
      fmtDate(p.date), p.method, Number(p.amount), p.recordedBy?.name || "—",
      running, Number(sale.sale_price) - running,
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Payment Schedule");
  XLSX.writeFile(wb, `Payment-Schedule-${sale.flat?.flat_no || sale.id}.xlsx`);
}

/**
 * Reads the same 3 columns back out of an uploaded .xlsx/.xls/.csv file
 * (Date, Method, Amount — a header row is optional, matched by name if
 * present). Anything else in the file (Recorded By, Running Paid, Running
 * Due from an exported schedule) is ignored — those are derived, not
 * entered. `cellDates: true` + `raw: false` gives back plain "YYYY-MM-DD"
 * strings for real Excel date cells instead of serial numbers.
 */
async function parseSpreadsheet(file) {
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  let rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: "yyyy-mm-dd" });
  rows = rows.filter((r) => r.some((cell) => String(cell ?? "").trim() !== ""));
  if (rows.length === 0) return [];

  const header = rows[0].map((h) => String(h ?? "").trim().toLowerCase());
  let dateIdx = header.indexOf("date"), methodIdx = header.indexOf("method"), amountIdx = header.indexOf("amount");
  if (dateIdx === -1 && methodIdx === -1 && amountIdx === -1) {
    // No recognizable header — assume the file is bare Date,Method,Amount columns.
    dateIdx = 0; methodIdx = 1; amountIdx = 2;
  } else {
    rows = rows.slice(1);
  }
  return rows
    .map((r) => ({
      date: String(r[dateIdx] ?? "").trim(),
      method: String(r[methodIdx] ?? "").trim() || "Bank Transfer",
      amount: String(r[amountIdx] ?? "").trim(),
    }))
    .filter((r) => r.date || r.amount);
}

export default function PaymentsPage() {
  const { user } = useAuth();
  const canManage = user.role === "owner" || user.role === "admin";
  const { data: projects } = useApi("/projects");
  const { data: sales, refetch: refetchSales } = useApi("/sales");
  const { data: payments, loading, error, refetch } = useApi("/payments");
  const [docsPayment, setDocsPayment] = useState(null);
  const [scheduleSale, setScheduleSale] = useState(null);

  const confirmedSales = (sales || []).filter((s) => s.status === "confirmed");
  const paymentsFor = (saleId) =>
    (payments || []).filter((p) => p.sale_id === saleId).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  const dueFor = (saleId) => {
    const s = (sales || []).find((x) => x.id === saleId);
    if (!s) return 0;
    const paid = paymentsFor(saleId).reduce((a, p) => a + Number(p.amount), 0);
    return Number(s.sale_price) - paid;
  };

  // A new installment is now typed in directly at the bottom of a sale's own
  // Payment Schedule ledger (see the add-row below the table) instead of a
  // separate global "Record Payment" form — the owner's request to drop that
  // button in favor of an inline, per-sale entry row.
  const [addRow, setAddRow] = useState({ amount: "", date: new Date().toISOString().slice(0, 10), method: "Bank Transfer" });
  const [addError, setAddError] = useState("");

  // Bulk import: upload an Excel/CSV file of Date,Method,Amount rows for the
  // open sale, review/edit them right in the page (still "typeable" — the
  // owner's request — before anything is saved), then submit them all.
  const fileInputRef = useRef(null);
  const [uploadRows, setUploadRows] = useState([]);
  const [uploadError, setUploadError] = useState("");
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState("");

  const openSchedule = (sale) => {
    setAddRow({ amount: "", date: new Date().toISOString().slice(0, 10), method: "Bank Transfer" });
    setAddError("");
    setUploadRows([]);
    setUploadError("");
    setImportSummary("");
    setEditingId(null);
    setEditError("");
    setScheduleSale(sale);
  };

  const handleFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    try {
      const parsed = await parseSpreadsheet(file);
      if (parsed.length === 0) {
        setUploadError("Couldn't find any Date/Method/Amount rows in that file.");
        return;
      }
      setUploadRows(parsed);
      setUploadError("");
      setImportSummary("");
    } catch (e2) {
      setUploadError(e2.message || "Couldn't read that file.");
    }
  };

  const updateUploadRow = (i, field, value) => {
    setUploadRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  };
  const removeUploadRow = (i) => setUploadRows((rows) => rows.filter((_, idx) => idx !== i));

  const importUploadRows = async (sale) => {
    setImporting(true);
    setUploadError("");
    let ok = 0, failed = 0, firstError = "";
    for (const row of uploadRows) {
      const amt = parseFloat(row.amount) || 0;
      if (amt <= 0) { failed++; continue; }
      try {
        await api.post("/payments", { sale_id: sale.id, amount: amt, date: row.date, method: row.method || "Bank Transfer" });
        ok++;
      } catch (e) {
        failed++;
        firstError = firstError || e.message || "Import failed.";
      }
    }
    setImporting(false);
    setUploadRows([]);
    setImportSummary(`${ok} payment${ok === 1 ? "" : "s"} imported${failed ? `, ${failed} skipped (${firstError})` : "."}`);
    refetch();
    refetchSales();
  };

  const addPayment = async (sale) => {
    const amt = parseFloat(addRow.amount) || 0;
    if (amt <= 0) return;
    if (amt > dueFor(sale.id)) {
      setAddError("Payment exceeds due amount.");
      return;
    }
    try {
      await api.post("/payments", { sale_id: sale.id, amount: amt, date: addRow.date, method: addRow.method });
      setAddRow({ amount: "", date: new Date().toISOString().slice(0, 10), method: "Bank Transfer" });
      setAddError("");
      refetch();
      refetchSales();
    } catch (e) {
      setAddError(e.message || "Payment failed.");
    }
  };

  // Correcting or removing an already-recorded row (Edit — owner/admin only,
  // see PaymentController::update/destroy) — separate from typing in a new
  // one above.
  const [editingId, setEditingId] = useState(null);
  const [editRow, setEditRow] = useState({ amount: "", date: "", method: "Bank Transfer" });
  const [editError, setEditError] = useState("");

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditRow({ amount: String(p.amount), date: p.date?.slice(0, 10) || "", method: p.method });
    setEditError("");
  };
  const cancelEdit = () => { setEditingId(null); setEditError(""); };

  const saveEdit = async (id) => {
    const amt = parseFloat(editRow.amount) || 0;
    if (amt <= 0) return;
    try {
      await api.put(`/payments/${id}`, { amount: amt, date: editRow.date, method: editRow.method });
      setEditingId(null);
      refetch();
      refetchSales();
    } catch (e) {
      setEditError(e.message || "Update failed.");
    }
  };

  const deletePayment = async (p) => {
    if (!confirm(`Delete this ${fmtBDT(p.amount)} payment?`)) return;
    try {
      await api.del(`/payments/${p.id}`);
      refetch();
      refetchSales();
    } catch (e) {
      alert(e.message || "Delete failed.");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Payments">
        <div className="flex items-center gap-1.5 border border-slate-300 rounded-lg px-3 py-1.5">
          <Building2 size={14} className="text-slate-400" />
          <span className="text-sm font-semibold text-slate-800">Total Project</span>
          <span className="text-sm font-bold text-slate-800">{(projects || []).length}</span>
        </div>
      </PageHeader>

      <ErrorBanner message={error} />
      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr><Th>Project</Th><Th>Flat</Th><Th>Client Id</Th><Th>Excel Sheet</Th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {confirmedSales.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <Td>{s.flat?.project?.name || "—"}</Td>
                  <Td className="font-medium text-slate-800">{s.flat?.flat_no}</Td>
                  <Td>{clientId(s.customer_id)}</Td>
                  <Td>
                    <button onClick={() => openSchedule(s)} className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:underline">
                      <FileSpreadsheet size={14} /> Excel Sheet
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
          {confirmedSales.length === 0 && <EmptyState text="No confirmed sales to pay against" />}
        </div>
      )}

      {scheduleSale && (() => {
        const rows = paymentsFor(scheduleSale.id);
        let running = 0;
        return (
          <Modal title={`Excel Sheet — ${scheduleSale.flat?.flat_no}`} onClose={() => setScheduleSale(null)} wide>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between"><span className="text-slate-500">Project</span><span>{scheduleSale.flat?.project?.name || "—"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Flat</span><span className="font-medium">{scheduleSale.flat?.flat_no}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Client Id</span><span>{clientId(scheduleSale.customer_id)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Sold By</span><span>{scheduleSale.employee?.name || "—"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Total Sold Amount</span><span className="font-semibold">{fmtBDT(scheduleSale.sale_price)}</span></div>
            </div>

            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Full Payment History (oldest → newest)</h4>
              <div className="flex items-center gap-3">
                <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls,text/csv" className="hidden" onChange={handleFileSelected} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#1F3864] hover:underline"
                  title="Upload a CSV/Excel file of Date, Method, Amount rows for this sale"
                >
                  <Upload size={14} /> Upload Excel
                </button>
                <button
                  onClick={() => downloadSchedule(scheduleSale, rows)}
                  className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:underline"
                >
                  <FileSpreadsheet size={14} /> Export Excel
                </button>
              </div>
            </div>

            {importSummary && (
              <div className="mb-2 text-xs px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700">{importSummary}</div>
            )}
            <ErrorBanner message={uploadError} />

            {uploadRows.length > 0 && (
              <div className="mb-3 border border-amber-200 bg-amber-50/50 rounded-lg overflow-hidden">
                <div className="px-3 py-2 text-xs font-semibold text-amber-800 uppercase tracking-wide">
                  Review before importing — type over any value, then confirm
                </div>
                <table className="w-full">
                  <thead className="bg-amber-50 border-y border-amber-200">
                    <tr><Th>Date</Th><Th>Method</Th><Th>Amount</Th><Th></Th></tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100">
                    {uploadRows.map((r, i) => (
                      <tr key={i}>
                        <Td><input type="text" className={`${inputCls} !py-1 text-xs`} value={r.date} onChange={(e) => updateUploadRow(i, "date", e.target.value)} placeholder="e.g. 2026-08-05" /></Td>
                        <Td>
                          <select className={`${inputCls} !py-1 text-xs`} value={r.method} onChange={(e) => updateUploadRow(i, "method", e.target.value)}>
                            {METHODS.map((m) => <option key={m}>{m}</option>)}
                          </select>
                        </Td>
                        <Td><input type="number" className={`${inputCls} !py-1 text-xs w-28`} value={r.amount} onChange={(e) => updateUploadRow(i, "amount", e.target.value)} /></Td>
                        <Td>
                          <button onClick={() => removeUploadRow(i)} className="text-slate-400 hover:text-red-500" title="Remove this row">
                            <Trash2 size={13} />
                          </button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex justify-end gap-2 px-3 py-2 bg-amber-50/50">
                  <button onClick={() => setUploadRows([])} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1">Discard</button>
                  <button
                    onClick={() => importUploadRows(scheduleSale)}
                    disabled={importing}
                    className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#1F3864] hover:brightness-110 disabled:opacity-50 rounded-lg px-3 py-1.5"
                  >
                    <Check size={13} /> {importing ? "Importing…" : `Import ${uploadRows.length} Payment${uploadRows.length === 1 ? "" : "s"}`}
                  </button>
                </div>
              </div>
            )}

            <ErrorBanner message={addError} />
            <div className="border border-slate-200 rounded-lg overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr><Th>Date</Th><Th>Method</Th><Th>Amount</Th><Th>Recorded By</Th><Th>Running Paid</Th><Th>Running Due</Th><Th></Th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((p) => {
                    running += Number(p.amount);
                    if (editingId === p.id) {
                      return (
                        <tr key={p.id} className="bg-blue-50/40">
                          <Td><input type="date" className={`${inputCls} !py-1 text-xs`} value={editRow.date} onChange={(e) => setEditRow({ ...editRow, date: e.target.value })} /></Td>
                          <Td>
                            <select className={`${inputCls} !py-1 text-xs`} value={editRow.method} onChange={(e) => setEditRow({ ...editRow, method: e.target.value })}>
                              {METHODS.map((m) => <option key={m}>{m}</option>)}
                            </select>
                          </Td>
                          <Td><input type="number" className={`${inputCls} !py-1 text-xs w-28`} value={editRow.amount} onChange={(e) => setEditRow({ ...editRow, amount: e.target.value })} /></Td>
                          <td colSpan={3} className="px-3 py-2 text-xs text-red-600">{editError || " "}</td>
                          <Td>
                            <div className="flex items-center gap-1">
                              <button onClick={() => saveEdit(p.id)} className="p-1 rounded text-emerald-700 hover:bg-emerald-50" title="Save"><Check size={14} /></button>
                              <button onClick={cancelEdit} className="p-1 rounded text-slate-400 hover:bg-slate-100" title="Cancel"><X size={14} /></button>
                            </div>
                          </Td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={p.id}>
                        <Td>{fmtDate(p.date)}</Td>
                        <Td>{p.method}</Td>
                        <Td className="text-green-600">{fmtBDT(p.amount)}</Td>
                        <Td>{p.recordedBy?.name || "—"}</Td>
                        <Td>{fmtBDT(running)}</Td>
                        <Td className="text-red-600">{fmtBDT(scheduleSale.sale_price - running)}</Td>
                        <Td>
                          <div className="flex items-center gap-2">
                            {canManage && (
                              <>
                                <button onClick={() => startEdit(p)} className="text-slate-400 hover:text-[#1F3864]" title="Edit"><Pencil size={13} /></button>
                                <button onClick={() => deletePayment(p)} className="text-slate-400 hover:text-red-500" title="Delete"><Trash2 size={13} /></button>
                              </>
                            )}
                            <button onClick={() => setDocsPayment(p)} className="text-slate-400 hover:text-slate-600" title="Documents">
                              <Paperclip size={14} />
                            </button>
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                  {/* Type a new installment directly into the sheet — the
                      owner's "Record Payment" button now lives here, scoped
                      to this one sale, instead of a separate global modal. */}
                  {scheduleSale.sale_price - running > 0 && (
                    <tr className="bg-slate-50/60">
                      <Td>
                        <input type="date" className={`${inputCls} !py-1 text-xs`} value={addRow.date} onChange={(e) => setAddRow({ ...addRow, date: e.target.value })} />
                      </Td>
                      <Td>
                        <select className={`${inputCls} !py-1 text-xs`} value={addRow.method} onChange={(e) => setAddRow({ ...addRow, method: e.target.value })}>
                          {METHODS.map((m) => <option key={m}>{m}</option>)}
                        </select>
                      </Td>
                      <Td>
                        <input
                          type="number" placeholder="Type amount…" className={`${inputCls} !py-1 text-xs w-28`}
                          value={addRow.amount} onChange={(e) => setAddRow({ ...addRow, amount: e.target.value })}
                        />
                      </Td>
                      <td colSpan={3} className="px-3 py-2 text-xs text-slate-400">Due {fmtBDT(scheduleSale.sale_price - running)}</td>
                      <Td>
                        <button onClick={() => addPayment(scheduleSale)} className="p-1.5 rounded-lg bg-[#1F3864] text-white hover:brightness-110" title="Add this payment">
                          <Plus size={13} />
                        </button>
                      </Td>
                    </tr>
                  )}
                </tbody>
              </table>
              {rows.length === 0 && <div className="text-center text-xs text-slate-400 py-2 border-t border-slate-100">No payments recorded yet — type the first one above</div>}
            </div>
          </Modal>
        );
      })()}

      {docsPayment && (
        <Modal title={`Documents — Payment #${docsPayment.id}`} onClose={() => setDocsPayment(null)} wide>
          <DocumentsPanel documentableType="payment" documentableId={docsPayment.id} />
        </Modal>
      )}
    </div>
  );
}
