"use client";

import { useState } from "react";
import { Plus, Pencil, Check, X, AlertTriangle, Paperclip } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { fmtBDT, fmtDate, calcFlatPrice } from "@/lib/format";
import { Btn, Field, inputCls, Modal, PageHeader, ErrorBanner, LoadingBlock, EmptyState, Th, Td, StatusPill } from "@/components/ui";
import DocumentsPanel from "@/components/DocumentsPanel";

/** "CUST-00001" — same formatting used on Customers/Bookings/FlatResource. */
const clientId = (id) => "CUST-" + String(id).padStart(5, "0");

export default function SalesPage() {
  const { user } = useAuth();
  const canApprove = user.role === "owner" || user.role === "admin";

  const { data: sales, loading, error, refetch } = useApi("/sales");
  const { data: flatsRes } = useApi("/flats");
  const { data: customers } = useApi("/customers");
  const { data: payments } = useApi("/payments");

  const allFlats = flatsRes?.data || [];
  const sellableFlats = allFlats.filter((f) => ["AVAILABLE", "ASSET_BOOKED"].includes(f.status_code));

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ flat_id: "", customer_id: "", sale_type: "SOLD_CR", sale_price: "", sold_price_per_sft: "", date: new Date().toISOString().slice(0, 10) });
  const [saveError, setSaveError] = useState("");
  const [actionError, setActionError] = useState("");
  const [docsSale, setDocsSale] = useState(null);

  const [editSale, setEditSale] = useState(null);
  const [editForm, setEditForm] = useState({ sold_price_per_sft: "", sale_price: "", date: "" });
  const [editError, setEditError] = useState("");

  // The Sale Price field always follows Sold Price/sft x Size + Parking +
  // Utility + Reserve Fund (mirrors Flat::calcSubTotal()'s optional
  // pricePerSft override) — a discount off the listing price must actually
  // reduce the total, not just show next to it. See SaleController::store's
  // matching server-side recompute, which is the actual source of truth.
  const priceForFlat = (flat, soldPricePerSft) => (flat ? calcFlatPrice(flat, soldPricePerSft).total : "");

  const openNew = () => {
    const firstFlat = sellableFlats[0];
    setForm({
      flat_id: firstFlat?.id || "", customer_id: customers?.[0]?.id || "", sale_type: "SOLD_CR",
      sale_price: priceForFlat(firstFlat, firstFlat?.price_per_sft), sold_price_per_sft: firstFlat?.price_per_sft ?? "",
      date: new Date().toISOString().slice(0, 10),
    });
    setSaveError("");
    setModal(true);
  };

  const pickFlat = (flatId) => {
    const f = allFlats.find((x) => String(x.id) === String(flatId));
    setForm({ ...form, flat_id: flatId, sale_price: priceForFlat(f, f?.price_per_sft), sold_price_per_sft: f?.price_per_sft ?? "" });
  };

  const updateSoldPricePerSft = (value) => {
    const f = allFlats.find((x) => String(x.id) === String(form.flat_id));
    setForm({ ...form, sold_price_per_sft: value, sale_price: priceForFlat(f, value) });
  };

  const save = async () => {
    if (!form.flat_id || !form.customer_id) return;
    try {
      await api.post("/sales", {
        ...form, flat_id: Number(form.flat_id), customer_id: Number(form.customer_id),
        sale_price: parseFloat(form.sale_price) || 0,
        sold_price_per_sft: form.sold_price_per_sft === "" ? null : parseFloat(form.sold_price_per_sft),
      });
      setModal(false);
      refetch();
    } catch (e) {
      setSaveError(e.message || "Sale failed.");
    }
  };

  const openEditSale = (s) => {
    setEditSale(s);
    setEditForm({ sold_price_per_sft: s.sold_price_per_sft ?? "", sale_price: s.sale_price, date: s.date?.slice(0, 10) || "" });
    setEditError("");
  };

  const updateEditSoldPricePerSft = (value) => {
    setEditForm({ ...editForm, sold_price_per_sft: value, sale_price: priceForFlat(editSale.flat, value) });
  };

  const saveEditSale = async () => {
    try {
      await api.put(`/sales/${editSale.id}`, {
        sale_price: parseFloat(editForm.sale_price) || 0,
        sold_price_per_sft: editForm.sold_price_per_sft === "" ? null : parseFloat(editForm.sold_price_per_sft),
        date: editForm.date,
      });
      setEditSale(null);
      refetch();
    } catch (e) {
      setEditError(e.message || "Update failed.");
    }
  };

  const approve = async (id) => {
    setActionError("");
    try {
      await api.post(`/sales/${id}/approve`);
      refetch();
    } catch (e) {
      setActionError(e.message || "Approve failed.");
    }
  };
  const reject = async (id) => {
    setActionError("");
    try {
      await api.post(`/sales/${id}/reject`);
      refetch();
    } catch (e) {
      setActionError(e.message || "Reject failed.");
    }
  };

  const pending = (sales || []).filter((s) => s.status === "pending");
  const confirmed = (sales || []).filter((s) => s.status === "confirmed");

  return (
    <div className="space-y-5">
      <PageHeader title="Sales">
        <Btn onClick={openNew} disabled={sellableFlats.length === 0}><Plus size={15} /> New Sale</Btn>
      </PageHeader>

      <ErrorBanner message={error} />
      <ErrorBanner message={actionError} />

      {loading ? (
        <LoadingBlock />
      ) : (
        <>
          {canApprove && pending.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2 text-amber-800 text-sm font-semibold">
                <AlertTriangle size={16} /> Pending Approval ({pending.length})
              </div>
              <div className="space-y-2">
                {pending.map((s) => (
                  <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-lg px-3 py-2 border border-amber-100">
                    <div className="text-sm">
                      <b>{s.flat?.flat_no}</b> → {s.customer?.name} · by {s.employee?.name} · {fmtBDT(s.sale_price)}
                    </div>
                    <div className="flex gap-2">
                      <Btn size="sm" onClick={() => approve(s.id)}><Check size={13} /> Approve</Btn>
                      <Btn size="sm" variant="danger" onClick={() => reject(s.id)}><X size={13} /> Reject</Btn>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <Th>Project</Th><Th>Flat</Th><Th>Client Id</Th>{user.role !== "employee" && <Th>Sold By</Th>}
                  <Th>Type</Th><Th>Total Sold Amount</Th><Th>Booking Money</Th><Th>Date</Th><Th></Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {confirmed.map((s) => (
                  <SaleRow
                    key={s.id} sale={s} payments={payments || []} showEmployee={user.role !== "employee"}
                    onDocuments={() => setDocsSale(s)} onEdit={canApprove ? () => openEditSale(s) : null}
                  />
                ))}
              </tbody>
            </table>
            {confirmed.length === 0 && <EmptyState text="No confirmed sales yet" />}
          </div>
        </>
      )}

      {modal && (
        <Modal title="New Sale" onClose={() => setModal(false)}>
          <ErrorBanner message={saveError} />
          <Field label="Flat">
            <select className={inputCls} value={form.flat_id} onChange={(e) => pickFlat(e.target.value)}>
              {sellableFlats.map((f) => <option key={f.id} value={f.id}>{f.flat_no}</option>)}
            </select>
          </Field>
          <Field label="Customer">
            <select className={inputCls} value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
              {(customers || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Sale Type">
            <select className={inputCls} value={form.sale_type} onChange={(e) => setForm({ ...form, sale_type: e.target.value })}>
              <option value="SOLD_CR">Sold (CR)</option>
              <option value="SOLD_OS_SS">Sold (OS/SS)</option>
            </select>
          </Field>
          <Field label="Sold Price / sft"><input type="number" className={inputCls} value={form.sold_price_per_sft} onChange={(e) => updateSoldPricePerSft(e.target.value)} /></Field>
          <Field label="Sale Price (auto — override if needed)"><input type="number" className={inputCls} value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} /></Field>
          <Field label="Date"><input type="date" className={inputCls} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          {user.role === "employee" && (
            <div className="text-xs text-amber-600 flex items-center gap-1 mb-2">
              <AlertTriangle size={13} /> This sale will require Admin/Owner approval before it&apos;s confirmed.
            </div>
          )}
          <div className="flex justify-end gap-2 mt-2">
            <Btn variant="outline" onClick={() => setModal(false)}>Cancel</Btn>
            <Btn onClick={save}>Save</Btn>
          </div>
        </Modal>
      )}

      {docsSale && (
        <Modal title={`Documents — ${docsSale.flat?.flat_no}`} onClose={() => setDocsSale(null)} wide>
          <DocumentsPanel documentableType="sale" documentableId={docsSale.id} />
        </Modal>
      )}

      {editSale && (
        <Modal title={`Edit Sale — ${editSale.flat?.flat_no}`} onClose={() => setEditSale(null)}>
          <ErrorBanner message={editError} />
          <Field label="Sold Price / sft"><input type="number" className={inputCls} value={editForm.sold_price_per_sft} onChange={(e) => updateEditSoldPricePerSft(e.target.value)} /></Field>
          <Field label="Sale Price (auto — override if needed)"><input type="number" className={inputCls} value={editForm.sale_price} onChange={(e) => setEditForm({ ...editForm, sale_price: e.target.value })} /></Field>
          <Field label="Date"><input type="date" className={inputCls} value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 mt-2">
            <Btn variant="outline" onClick={() => setEditSale(null)}>Cancel</Btn>
            <Btn onClick={saveEditSale}>Save</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SaleRow({ sale, payments, showEmployee, onDocuments, onEdit }) {
  const paid = payments.filter((p) => p.sale_id === sale.id).reduce((a, p) => a + Number(p.amount), 0);
  return (
    <tr className="hover:bg-slate-50">
      <Td>{sale.flat?.project?.name || "—"}</Td>
      <Td className="font-medium text-slate-800">{sale.flat?.flat_no}</Td>
      <Td>{clientId(sale.customer_id)}</Td>
      {showEmployee && <Td>{sale.employee?.name}</Td>}
      <Td><StatusPill code={sale.sale_type} /></Td>
      <Td>{fmtBDT(sale.sale_price)}</Td>
      <Td className="text-green-600">{fmtBDT(paid)}</Td>
      <Td>{fmtDate(sale.date)}</Td>
      <Td>
        <div className="flex items-center gap-2">
          {onEdit && <button onClick={onEdit} className="text-slate-400 hover:text-slate-600" title="Edit"><Pencil size={14} /></button>}
          <button onClick={onDocuments} className="text-slate-400 hover:text-slate-600" title="Documents"><Paperclip size={14} /></button>
        </div>
      </Td>
    </tr>
  );
}
