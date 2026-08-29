"use client";

import { useState } from "react";
import { Plus, Paperclip } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { fmtBDT, fmtDate } from "@/lib/format";
import { Btn, Field, inputCls, Modal, PageHeader, ErrorBanner, LoadingBlock, EmptyState, Th, Td } from "@/components/ui";
import DocumentsPanel from "@/components/DocumentsPanel";

export default function BookingsPage() {
  useAuth();
  const { data: bookings, loading, error, refetch } = useApi("/bookings");
  const { data: flatsRes } = useApi("/flats");
  const { data: customers } = useApi("/customers");

  const allFlats = flatsRes?.data || [];
  const availableFlats = allFlats.filter((f) => f.status_code === "AVAILABLE");

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ flat_id: "", customer_id: "", amount: "", date: new Date().toISOString().slice(0, 10) });
  const [saveError, setSaveError] = useState("");
  const [docsBooking, setDocsBooking] = useState(null);

  const openNew = () => {
    setForm({ flat_id: availableFlats[0]?.id || "", customer_id: customers?.[0]?.id || "", amount: "", date: new Date().toISOString().slice(0, 10) });
    setSaveError("");
    setModal(true);
  };

  const save = async () => {
    if (!form.flat_id || !form.customer_id || !form.amount) return;
    try {
      await api.post("/bookings", { ...form, flat_id: Number(form.flat_id), customer_id: Number(form.customer_id), amount: parseFloat(form.amount) });
      setModal(false);
      refetch();
    } catch (e) {
      setSaveError(e.message || "Booking failed.");
    }
  };

  const cancel = async (id) => {
    if (!confirm("Cancel this booking?")) return;
    try {
      await api.post(`/bookings/${id}/cancel`);
      refetch();
    } catch (e) {
      alert(e.message || "Cancel failed.");
    }
  };

  const convert = async (id) => {
    if (!confirm("Convert this booking to a sale?")) return;
    try {
      await api.post(`/bookings/${id}/convert-to-sale`);
      refetch();
    } catch (e) {
      alert(e.message || "Conversion failed.");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Bookings">
        <Btn onClick={openNew} disabled={availableFlats.length === 0}><Plus size={15} /> New Booking</Btn>
      </PageHeader>

      <ErrorBanner message={error} />
      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr><Th>Flat</Th><Th>Customer</Th><Th>Employee</Th><Th>Amount</Th><Th>Date</Th><Th>Status</Th><Th></Th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <Td className="font-medium text-slate-800">{b.flat?.flat_no}</Td>
                  <Td>{b.customer?.name}</Td>
                  <Td>{b.employee?.name}</Td>
                  <Td>{fmtBDT(b.amount)}</Td>
                  <Td>{fmtDate(b.date)}</Td>
                  <Td>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.status === "active" ? "bg-orange-50 text-orange-700" : b.status === "converted" ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                      {b.status}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setDocsBooking(b)} className="text-slate-400 hover:text-slate-600" title="Documents"><Paperclip size={14} /></button>
                      {b.status === "active" && (
                        <>
                          <button className="text-xs text-[#1F3864] hover:underline" onClick={() => convert(b.id)}>Convert to Sale</button>
                          <button className="text-xs text-red-500 hover:underline" onClick={() => cancel(b.id)}>Cancel</button>
                        </>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
          {bookings.length === 0 && <EmptyState text="No bookings yet" />}
        </div>
      )}

      {modal && (
        <Modal title="New Booking" onClose={() => setModal(false)}>
          <ErrorBanner message={saveError} />
          <Field label="Flat">
            <select className={inputCls} value={form.flat_id} onChange={(e) => setForm({ ...form, flat_id: e.target.value })}>
              {availableFlats.map((f) => <option key={f.id} value={f.id}>{f.flat_no}</option>)}
            </select>
          </Field>
          <Field label="Customer">
            <select className={inputCls} value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
              {(customers || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Booking Amount"><input type="number" className={inputCls} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
          <Field label="Date"><input type="date" className={inputCls} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 mt-2">
            <Btn variant="outline" onClick={() => setModal(false)}>Cancel</Btn>
            <Btn onClick={save}>Save</Btn>
          </div>
        </Modal>
      )}

      {docsBooking && (
        <Modal title={`Documents — ${docsBooking.flat?.flat_no}`} onClose={() => setDocsBooking(null)} wide>
          <DocumentsPanel documentableType="booking" documentableId={docsBooking.id} />
        </Modal>
      )}
    </div>
  );
}
