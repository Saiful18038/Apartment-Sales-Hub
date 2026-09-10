"use client";

import { useState } from "react";
import { FileSpreadsheet, Building2, Search } from "lucide-react";
import { useApi } from "@/lib/useApi";
import { inputCls, PageHeader, ErrorBanner, LoadingBlock, EmptyState, Th, Td } from "@/components/ui";

/** "CUST-00001" — same formatting used on Customers/Bookings/Sales/FlatResource. */
const clientId = (id) => "CUST-" + String(id).padStart(5, "0");

// Owner's request: each confirmed sale gets one "Final Price & Payment
// Schedule" — the price breakdown + instalment plan, with PDF/Excel export
// and per-instalment Paid/Pending tracking. Opens in a new browser tab
// (/payment-sheet/?sale=<id>) instead of an in-page modal.
const openSheet = (saleId) => window.open(`/payment-sheet/?sale=${saleId}`, "_blank");

export default function PaymentsPage() {
  const { data: projects } = useApi("/projects");
  const { data: sales, loading, error } = useApi("/sales");

  const confirmedSales = (sales || []).filter((s) => s.status === "confirmed");

  // Owner's request: a search bar over the list. Matches project, flat no,
  // client id (raw or "CUST-00001"), and customer name.
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const visibleSales = q
    ? confirmedSales.filter((s) => [
        s.flat?.project?.name, s.flat?.flat_no, String(s.customer_id), clientId(s.customer_id), s.customer?.name,
      ].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
    : confirmedSales;

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
        <>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3.5">
            <label className="block">
              <span className="block text-xs font-medium text-slate-500 mb-1">Search</span>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className={`${inputCls} pl-8 w-full sm:w-[280px]`}
                  placeholder="Project, flat, client id…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </label>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr><Th>Project</Th><Th>Flat</Th><Th>Client Id</Th><Th>Price &amp; Schedule</Th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleSales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <Td>{s.flat?.project?.name || "—"}</Td>
                    <Td className="font-medium text-slate-800">{s.flat?.flat_no}</Td>
                    <Td>{clientId(s.customer_id)}</Td>
                    <Td>
                      <button onClick={() => openSheet(s.id)} className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:underline">
                        <FileSpreadsheet size={14} /> Open
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
            {confirmedSales.length === 0
              ? <EmptyState text="No confirmed sales to pay against" />
              : visibleSales.length === 0 && <EmptyState text={`No sales match “${search.trim()}”`} />}
          </div>
        </>
      )}
    </div>
  );
}
