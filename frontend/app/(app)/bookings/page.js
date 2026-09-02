"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Paperclip, MoreVertical, Eye, Wallet, XCircle, ArrowRightCircle } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { fmtBDT, fmtDateTime, fmtDate, calcFlatPrice } from "@/lib/format";
import { STATUS } from "@/lib/status";
import { Btn, Field, inputCls, Modal, PageHeader, ErrorBanner, LoadingBlock, EmptyState, Th, Td } from "@/components/ui";
import DocumentsPanel from "@/components/DocumentsPanel";

/** "CUST-00001" — same formatting FlatResource/Customers page use. */
const clientId = (id) => "CUST-" + String(id).padStart(5, "0");

const BOOKING_STATUS_COLORS = {
  active: "bg-orange-50 text-orange-700",
  converted: "bg-green-50 text-green-700",
  cancelled: "bg-slate-100 text-slate-500",
};

function RowMenu({ onView, onAddPayment, onConvert, onCancel, onDocuments }) {
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
        <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-20 py-1 text-sm">
          <button onClick={() => pick(onView)} className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50">
            <Eye size={13} /> View Details
          </button>
          {onAddPayment && (
            <button onClick={() => pick(onAddPayment)} className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50">
              <Wallet size={13} /> Add Amount
            </button>
          )}
          {onConvert && (
            <button onClick={() => pick(onConvert)} className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[#1F3864] hover:bg-slate-50">
              <ArrowRightCircle size={13} /> Convert to Sale
            </button>
          )}
          <button onClick={() => pick(onDocuments)} className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50">
            <Paperclip size={13} /> Documents
          </button>
          {onCancel && (
            <button onClick={() => pick(onCancel)} className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-red-600 hover:bg-red-50">
              <XCircle size={13} /> Cancel Booking
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function BookingsPage() {
  const { user } = useAuth();
  const isOwner = user.role === "owner";
  const { data: bookings, loading, error, refetch } = useApi("/bookings");
  const { data: flatsRes } = useApi("/flats");
  const { data: customers } = useApi("/customers");

  const allFlats = flatsRes?.data || [];
  const availableFlats = allFlats.filter((f) => f.status_code === "AVAILABLE");

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ flat_id: "", customer_id: "", sale_type: "SOLD_CR", amount: "", date: new Date().toISOString().slice(0, 10) });
  const [saveError, setSaveError] = useState("");
  const [docsBooking, setDocsBooking] = useState(null);
  const [detailBooking, setDetailBooking] = useState(null);
  const [payBooking, setPayBooking] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payError, setPayError] = useState("");
  const [completeMsg, setCompleteMsg] = useState("");

  const openNew = () => {
    setForm({ flat_id: availableFlats[0]?.id || "", customer_id: customers?.[0]?.id || "", sale_type: "SOLD_CR", amount: "", date: new Date().toISOString().slice(0, 10) });
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

  const cancelBooking = async (id) => {
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

  const openPay = (b) => {
    setPayBooking(b);
    setPayAmount("");
    setPayError("");
  };

  // "যত বার booking money দেবে, তত বার date & time generate হবে" — every
  // click here creates its own auto-timestamped installment row on the API
  // (BookingController::addPayment). The moment the running total reaches
  // the fixed Booking Money target, "completed" comes back true and we
  // surface the owner's exact required message.
  const submitPayment = async () => {
    if (!payAmount || Number(payAmount) <= 0) return;
    try {
      const res = await api.post(`/bookings/${payBooking.id}/payments`, { amount: parseFloat(payAmount) });
      setPayBooking(null);
      refetch();
      if (res.completed) {
        setCompleteMsg("Booking money complete! Payment process successful.");
      }
    } catch (e) {
      setPayError(e.message || "Payment failed.");
    }
  };

  const soldAmountOf = (b) => (b.flat ? calcFlatPrice(b.flat).total : 0);
  const canManage = user.role === "owner" || user.role === "admin";

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
              <tr>
                <Th>Flat</Th><Th>Customer</Th><Th>Employee</Th><Th>Sale Type</Th><Th>Booking Money</Th><Th>Status</Th><Th></Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bookings.map((b) => {
                const canAct = canManage || b.employee_id === user.id;
                const type = STATUS[b.sale_type] || {};
                return (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <Td className="font-medium text-slate-800">{b.flat?.flat_no}</Td>
                    <Td>{b.customer?.name} <span className="text-slate-400 text-xs">({clientId(b.customer_id)})</span></Td>
                    <Td>{b.employee?.name}</Td>
                    <Td>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: type.fill, color: type.text }}>
                        {type.label || b.sale_type}
                      </span>
                    </Td>
                    <Td>
                      {fmtBDT(b.paid_amount)} <span className="text-slate-400">/ {fmtBDT(b.amount)}</span>
                      {b.is_complete && b.status === "active" && <span className="ml-1 text-emerald-600 text-xs font-medium">✓ Complete</span>}
                    </Td>
                    <Td><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BOOKING_STATUS_COLORS[b.status] || "bg-slate-100 text-slate-500"}`}>{b.status}</span></Td>
                    <Td>
                      <RowMenu
                        onView={() => setDetailBooking(b)}
                        onAddPayment={b.status === "active" && canAct ? () => openPay(b) : null}
                        onConvert={b.status === "active" && canAct ? () => convert(b.id) : null}
                        onCancel={b.status === "active" && isOwner ? () => cancelBooking(b.id) : null}
                        onDocuments={() => setDocsBooking(b)}
                      />
                    </Td>
                  </tr>
                );
              })}
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
              {(customers || []).map((c) => <option key={c.id} value={c.id}>{c.name} ({clientId(c.id)})</option>)}
            </select>
          </Field>
          <Field label="Sale Type">
            <select className={inputCls} value={form.sale_type} onChange={(e) => setForm({ ...form, sale_type: e.target.value })}>
              <option value="SOLD_CR">{STATUS.SOLD_CR.label}</option>
              <option value="SOLD_OS_SS">{STATUS.SOLD_OS_SS.label}</option>
            </select>
          </Field>
          <Field label="Employee"><div className="text-sm text-slate-600 py-1.5">{user.name}</div></Field>
          <Field label="Booking Money (Fix Amount)"><input type="number" className={inputCls} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
          <Field label="Date"><input type="date" className={inputCls} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 mt-2">
            <Btn variant="outline" onClick={() => setModal(false)}>Cancel</Btn>
            <Btn onClick={save}>Save</Btn>
          </div>
        </Modal>
      )}

      {detailBooking && (() => {
        const b = detailBooking;
        const soldAmount = soldAmountOf(b);
        const dueAmount = soldAmount - b.paid_amount;
        const remaining = Number(b.amount) - b.paid_amount;
        return (
          <Modal title={`Booking — ${b.flat?.flat_no}`} onClose={() => setDetailBooking(null)}>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Flat</span><span className="font-medium">{b.flat?.flat_no}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Customer Name &amp; Id</span><span>{b.customer?.name} ({clientId(b.customer_id)})</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Employee</span><span>{b.employee?.name}</span></div>
              <hr className="my-2 border-slate-100" />
              <div className="flex justify-between"><span className="text-slate-500">Total Sold Amount</span><span className="font-medium">{fmtBDT(soldAmount)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Total Booking Amount</span><span className="font-medium text-[#1F3864]">{fmtBDT(b.paid_amount)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Due Amount</span><span className="font-medium text-red-600">{fmtBDT(dueAmount)}</span></div>
              <hr className="my-2 border-slate-100" />
              <div className="flex justify-between"><span className="text-slate-500">Booking Money (Fix Amount)</span><span>{fmtBDT(b.amount)}</span></div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Status</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BOOKING_STATUS_COLORS[b.status] || "bg-slate-100 text-slate-500"}`}>{b.status}</span>
              </div>
              {b.is_complete ? (
                <div className="mt-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 text-sm font-medium">
                  Booking money complete! Payment process successful.
                </div>
              ) : (
                <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 text-sm">
                  Due to complete booking money: <span className="font-medium">{fmtBDT(remaining)}</span>
                </div>
              )}
              {b.payments?.length > 0 && (
                <>
                  <hr className="my-2 border-slate-100" />
                  <div className="text-slate-500 mb-1">Payment History</div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {b.payments.map((p) => (
                      <div key={p.id} className="flex justify-between text-xs text-slate-600">
                        <span>{fmtDateTime(p.paid_at)}</span>
                        <span className="font-medium">{fmtBDT(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {b.status === "active" && (canManage || b.employee_id === user.id) && (
                <div className="flex justify-end gap-2 mt-3">
                  <Btn variant="outline" onClick={() => { setDetailBooking(null); openPay(b); }}><Wallet size={14} /> Add Amount</Btn>
                </div>
              )}
            </div>
          </Modal>
        );
      })()}

      {payBooking && (
        <Modal title={`Add Amount — ${payBooking.flat?.flat_no}`} onClose={() => setPayBooking(null)}>
          <ErrorBanner message={payError} />
          <div className="text-sm text-slate-600 mb-2">
            Remaining to complete: <span className="font-medium">{fmtBDT(Number(payBooking.amount) - payBooking.paid_amount)}</span>
          </div>
          <Field label="Amount"><input type="number" autoFocus className={inputCls} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} /></Field>
          <div className="text-xs text-slate-400 mb-2">Date &amp; time will be recorded automatically.</div>
          <div className="flex justify-end gap-2 mt-2">
            <Btn variant="outline" onClick={() => setPayBooking(null)}>Cancel</Btn>
            <Btn onClick={submitPayment}>Add Amount</Btn>
          </div>
        </Modal>
      )}

      {completeMsg && (
        <Modal title="Payment Complete" onClose={() => setCompleteMsg("")}>
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 text-sm font-medium text-center">
            {completeMsg}
          </div>
          <div className="flex justify-end mt-3">
            <Btn onClick={() => setCompleteMsg("")}>OK</Btn>
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
