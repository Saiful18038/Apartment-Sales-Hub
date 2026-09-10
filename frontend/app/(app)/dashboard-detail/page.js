"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { ErrorBanner, LoadingBlock, inputCls } from "@/components/ui";
import { useDashboardData } from "@/lib/useDashboardData";
import DashboardDetailBody, { DETAIL_TITLES } from "@/components/DashboardDetailBody";

function DashboardDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const detailKey = searchParams.get("key");
  const data = useDashboardData();

  // Owner's request: every tab that lists flats/sales/bookings gets the
  // same Search + Location filter bar as /flats (Zones/Projects are
  // summary tables, not lists of units, so they're left out).
  const [filterSearch, setFilterSearch] = useState("");
  const [filterZoneId, setFilterZoneId] = useState("");
  const showFlatFilters = ["flats", "available", "sold", "soldAmount", "bookingMoney", "cancelled"].includes(detailKey);

  if (data.loading) return <LoadingBlock />;
  if (data.error) return <ErrorBanner message={data.error} />;

  const title = DETAIL_TITLES[detailKey];
  if (!title) return <ErrorBanner message="Unknown dashboard detail." />;

  const projectZoneId = (projectId) => {
    const p = data.projects.find((pr) => pr.id === projectId);
    return p ? String(p.zone_id ?? p.zone?.id ?? "") : "";
  };

  const applyFlatFilters = (rows) => rows.filter((f) => {
    if (filterZoneId && projectZoneId(f.project_id) !== filterZoneId) return false;
    if (filterSearch) {
      const project = data.projects.find((p) => p.id === f.project_id);
      const haystack = `${f.flat_no} ${project?.name || ""}`.toLowerCase();
      if (!haystack.includes(filterSearch.toLowerCase())) return false;
    }
    return true;
  });

  // Total Sold Amount's two tables (Confirmed Sales, Active Bookings) are
  // Sale/Booking rows, not Flat rows — same Search + Location filter, just
  // reading the flat/customer through the nested relation instead.
  const applySaleBookingFilters = (rows) => rows.filter((r) => {
    if (filterZoneId && projectZoneId(r.flat?.project_id) !== filterZoneId) return false;
    if (filterSearch) {
      const project = data.projects.find((p) => p.id === r.flat?.project_id);
      const haystack = `${r.flat?.flat_no || ""} ${project?.name || ""} ${r.customer?.name || ""}`.toLowerCase();
      if (!haystack.includes(filterSearch.toLowerCase())) return false;
    }
    return true;
  });

  let bodyData = data;
  if (detailKey === "flats") {
    bodyData = { ...data, flats: applyFlatFilters(data.flats) };
  } else if (detailKey === "available") {
    bodyData = { ...data, availableFlats: applyFlatFilters(data.availableFlats) };
  } else if (detailKey === "sold") {
    bodyData = { ...data, soldFlats: applyFlatFilters(data.soldFlats) };
  } else if (detailKey === "soldAmount") {
    bodyData = { ...data, confirmedSales: applySaleBookingFilters(data.confirmedSales), activeBookings: applySaleBookingFilters(data.activeBookings) };
  } else if (detailKey === "bookingMoney") {
    bodyData = { ...data, activeBookings: applySaleBookingFilters(data.activeBookings) };
  } else if (detailKey === "cancelled") {
    bodyData = { ...data, cancelledBookings: applySaleBookingFilters(data.cancelledBookings) };
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href="/dashboard/" className="inline-flex items-center gap-1.5 text-sm text-[#1F3864] hover:underline mb-2">
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          {/* Owner's request: switch between any of the cards' details
              right here in the same tab, instead of going back to the
              Dashboard and clicking a different card each time. */}
          <select
            className={inputCls}
            style={{ width: 240 }}
            value={detailKey}
            onChange={(e) => router.push(`/dashboard-detail/?key=${e.target.value}`)}
          >
            {Object.entries(DETAIL_TITLES).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {showFlatFilters && (
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
              {(data.zones || []).map((z) => <option key={z.id} value={String(z.id)}>{z.name}</option>)}
            </select>
          </label>
        </div>
      )}

      <div className="shadow-premium bg-white rounded-2xl p-5">
        <DashboardDetailBody detailKey={detailKey} data={bodyData} />
      </div>
    </div>
  );
}

export default function DashboardDetailPage() {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <DashboardDetailContent />
    </Suspense>
  );
}
