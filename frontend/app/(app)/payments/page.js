"use client";

import { useState } from "react";
import { Plus, Paperclip, ClipboardList, FileSpreadsheet } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { fmtBDT, fmtDate } from "@/lib/format";
import { Btn, Field, inputCls, Modal, PageHeader, ErrorBanner, LoadingBlock, EmptyState, Th, Td } from "@/components/ui";
import DocumentsPanel from "@/components/DocumentsPanel";

const METHODS = ["Bank Transfer", "Cheque", "Cash", "Mobile Banking"];

/** "CUST-00001" — same formatting used on Customers/Bookings/Sales/FlatResource. */
const clientId = (id) => "CUST-" + String(id).padStart(5, "0");

/**
 * Owner's request: instead of a flat Total/Paid/Due row plus a separate
 * page-wide Payment History list, each sale gets one "Payment Schedule"
 * — every installment, oldest to newest ("A to Z"), with a running
 * paid/due balance — plus a one-click Excel (CSV) export of that same
 * ledger. escapeCsv guards against a name/method containing a comma or
 * quote breaking the file.
 */
function escapeCsv(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

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
  const csv = rows.map((r) => r.map(escapeCsv).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Payment-Schedule-${sale.flat?.flat_no || sale.id}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function PaymentsPage() {
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

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ sale_id: "", amount: "", date: new Date().toISOString().slice(0, 10), method: "Bank Transfer" });
  const [saveError, setSaveError] = useState("");

  const openNew = () => {
    setForm({ sale_id: confirmedSales[0]?.id || "", amount: "", date: new Date().toISOString().slice(0, 10), method: "Bank Transfer" });
    setSaveError("");
    setModal(true);
  };

  const save = async () => {
    const amt = parseFloat(form.amount) || 0;
    if (!form.sale_id || amt <= 0) return;
    if (amt > dueFor(Number(form.sale_id))) {
      setSaveError("Payment exceeds due amount.");
      return;
    }
    try {
      await api.post("/payments", { sale_id: Number(form.sale_id), amount: amt, date: form.date, method: form.method });
      setModal(false);
      refetch();
      refetchSales();
    } catch (e) {
      setSaveError(e.message || "Payment failed.");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Payments">
        <span className="text-xs text-slate-400 mr-1">{confirmedSales.length} confirmed sale{confirmedSales.length === 1 ? "" : "s"}</span>
        <Btn onClick={openNew} disabled={confirmedSales.length === 0}><Plus size={15} /> Record Payment</Btn>
      </PageHeader>

      <ErrorBanner message={error} />
      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr><Th>Project</Th><Th>Flat</Th><Th>Client Id</Th><Th>Payment Schedule + Excel Sheet</Th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {confirmedSales.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <Td>{s.flat?.project?.name || "—"}</Td>
                  <Td className="font-medium text-slate-800">{s.flat?.flat_no}</Td>
                  <Td>{clientId(s.customer_id)}</Td>
                  <Td>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setScheduleSale(s)} className="flex items-center gap-1.5 text-xs font-medium text-[#1F3864] hover:underline">
                        <ClipboardList size={14} /> Payment Schedule
                      </button>
                      <button
                        onClick={() => downloadSchedule(s, paymentsFor(s.id))}
                        className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:underline"
                        title="Download this sale's payment schedule as Excel (CSV)"
                      >
                        <FileSpreadsheet size={14} /> Excel Sheet
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
          {confirmedSales.length === 0 && <EmptyState text="No confirmed sales to pay against" />}
        </div>
      )}

      {modal && (
        <Modal title="Record Payment" onClose={() => setModal(false)}>
          <ErrorBanner message={saveError} />
          <Field label="Sale">
            <select className={inputCls} value={form.sale_id} onChange={(e) => setForm({ ...form, sale_id: e.target.value })}>
              {confirmedSales.map((s) => (
                <option key={s.id} value={s.id}>{s.flat?.flat_no} — Due {fmtBDT(dueFor(s.id))}</option>
              ))}
            </select>
          </Field>
          <Field label="Amount"><input type="number" className={inputCls} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
          <Field label="Date"><input type="date" className={inputCls} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Method">
            <select className={inputCls} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              {METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>
          <div className="flex justify-end gap-2 mt-2">
            <Btn variant="outline" onClick={() => setModal(false)}>Cancel</Btn>
            <Btn onClick={save}>Save</Btn>
          </div>
        </Modal>
      )}

      {scheduleSale && (() => {
        const rows = paymentsFor(scheduleSale.id);
        let running = 0;
        return (
          <Modal title={`Payment Schedule — ${scheduleSale.flat?.flat_no}`} onClose={() => setScheduleSale(null)} wide>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between"><span className="text-slate-500">Project</span><span>{scheduleSale.flat?.project?.name || "—"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Flat</span><span className="font-medium">{scheduleSale.flat?.flat_no}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Client Id</span><span>{clientId(scheduleSale.customer_id)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Sold By</span><span>{scheduleSale.employee?.name || "—"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Total Sold Amount</span><span className="font-semibold">{fmtBDT(scheduleSale.sale_price)}</span></div>
            </div>

            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Full Payment History (oldest → newest)</h4>
              <button
                onClick={() => downloadSchedule(scheduleSale, rows)}
                className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:underline"
              >
                <FileSpreadsheet size={14} /> Export Excel
              </button>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr><Th>Date</Th><Th>Method</Th><Th>Amount</Th><Th>Recorded By</Th><Th>Running Paid</Th><Th>Running Due</Th><Th></Th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((p) => {
                    running += Number(p.amount);
                    return (
                      <tr key={p.id}>
                        <Td>{fmtDate(p.date)}</Td>
                        <Td>{p.method}</Td>
                        <Td className="text-green-600">{fmtBDT(p.amount)}</Td>
                        <Td>{p.recordedBy?.name || "—"}</Td>
                        <Td>{fmtBDT(running)}</Td>
                        <Td className="text-red-600">{fmtBDT(scheduleSale.sale_price - running)}</Td>
                        <Td>
                          <button onClick={() => setDocsPayment(p)} className="text-slate-400 hover:text-slate-600" title="Documents">
                            <Paperclip size={14} />
                          </button>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {rows.length === 0 && <EmptyState text="No payments recorded yet" />}
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
