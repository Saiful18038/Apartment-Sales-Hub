"use client";

import { useState } from "react";
import { Plus, Paperclip } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { fmtBDT, fmtDate } from "@/lib/format";
import { Btn, Field, inputCls, Modal, PageHeader, ErrorBanner, LoadingBlock, EmptyState, Th, Td } from "@/components/ui";
import DocumentsPanel from "@/components/DocumentsPanel";

const METHODS = ["Bank Transfer", "Cheque", "Cash", "Mobile Banking"];

export default function PaymentsPage() {
  const { data: sales, refetch: refetchSales } = useApi("/sales");
  const { data: payments, loading, error, refetch } = useApi("/payments");
  const [docsPayment, setDocsPayment] = useState(null);

  const confirmedSales = (sales || []).filter((s) => s.status === "confirmed");
  const dueFor = (saleId) => {
    const s = (sales || []).find((x) => x.id === saleId);
    if (!s) return 0;
    const paid = (payments || []).filter((p) => p.sale_id === saleId).reduce((a, p) => a + Number(p.amount), 0);
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
        <Btn onClick={openNew} disabled={confirmedSales.length === 0}><Plus size={15} /> Record Payment</Btn>
      </PageHeader>

      <ErrorBanner message={error} />
      {loading ? (
        <LoadingBlock />
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200"><tr><Th>Flat</Th><Th>Customer</Th><Th>Total</Th><Th>Paid</Th><Th>Due</Th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {confirmedSales.map((s) => {
                  const paid = (payments || []).filter((p) => p.sale_id === s.id).reduce((a, p) => a + Number(p.amount), 0);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <Td className="font-medium text-slate-800">{s.flat?.flat_no}</Td>
                      <Td>{s.customer?.name}</Td>
                      <Td>{fmtBDT(s.sale_price)}</Td>
                      <Td className="text-green-600">{fmtBDT(paid)}</Td>
                      <Td className="text-red-600">{fmtBDT(s.sale_price - paid)}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {confirmedSales.length === 0 && <EmptyState text="No confirmed sales to pay against" />}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Payment History</h3>
            <div className="space-y-1">
              {(payments || []).slice().reverse().map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm border-b border-slate-100 last:border-0 py-1.5">
                  <span>{p.sale?.flat?.flat_no} — {p.method}</span>
                  <span className="text-slate-500">{fmtDate(p.date)}</span>
                  <span className="font-medium">{fmtBDT(p.amount)}</span>
                  <button onClick={() => setDocsPayment(p)} className="text-slate-400 hover:text-slate-600 ml-2" title="Documents"><Paperclip size={14} /></button>
                </div>
              ))}
              {(payments || []).length === 0 && <EmptyState text="No payments recorded" />}
            </div>
          </div>
        </>
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

      {docsPayment && (
        <Modal title={`Documents — Payment #${docsPayment.id}`} onClose={() => setDocsPayment(null)} wide>
          <DocumentsPanel documentableType="payment" documentableId={docsPayment.id} />
        </Modal>
      )}
    </div>
  );
}
