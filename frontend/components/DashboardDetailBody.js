"use client";

import { Th, Td, StatusPill } from "@/components/ui";
import { fmtBDT, calcFlatPrice } from "@/lib/format";

export const DETAIL_TITLES = {
  zones: "Zones",
  projects: "Projects",
  flats: "Total Flats",
  available: "Available For Sale",
  sold: "Total Sold Apartment",
  soldAmount: "Total Sold Amount",
  bookingMoney: "Total Booking Money",
  due: "Total Due",
  cancelled: "Number of Cancelled Apartment",
};

function Table({ headers, children }) {
  return (
    <div className="border border-slate-200 rounded-lg overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
          <tr>{headers.map((h) => <Th key={h}>{h}</Th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

function EmptyRow({ colSpan }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-6 text-sm text-slate-400 italic text-center">No records</td>
    </tr>
  );
}

/**
 * Owner's request: clicking a Dashboard stat card opens its details in a new
 * tab (not an in-page modal) — this is the shared table content, rendered
 * standalone by the dashboard-detail page. Built from the same already
 * role-scoped arrays the stat cards themselves sum — Sale/Booking rows come
 * from visibleTo()-scoped endpoints and a Sold flat's `sale` field is
 * withheld per FlatResource::canView, so an Employee opening a card's tab
 * sees exactly the same privacy boundary as everywhere else in the app, not
 * a bypass of it.
 */
export default function DashboardDetailBody({ detailKey, data }) {
  const { projects, flats, availableFlats, soldFlats, confirmedSales, activeBookings, dueRows, cancelledBookings, zones } = data;

  const projectName = (id) => projects.find((p) => p.id === id)?.name || "—";

  if (detailKey === "zones") {
    return (
      <Table headers={["Zone", "Projects"]}>
        {zones.map((z) => (
          <tr key={z.id}>
            <Td className="font-medium text-slate-800">{z.name}</Td>
            <Td>{z.projects_count ?? projects.filter((p) => p.zone_id === z.id).length}</Td>
          </tr>
        ))}
        {zones.length === 0 && <EmptyRow colSpan={2} />}
      </Table>
    );
  }

  if (detailKey === "projects") {
    return (
      <Table headers={["Project", "Zone", "Total Units", "Available"]}>
        {projects.map((p) => (
          <tr key={p.id}>
            <Td className="font-medium text-slate-800">{p.name}</Td>
            <Td>{p.zone?.name || "—"}</Td>
            <Td>{p.flats_count ?? 0}</Td>
            <Td>{p.status_counts?.AVAILABLE ?? 0}</Td>
          </tr>
        ))}
        {projects.length === 0 && <EmptyRow colSpan={4} />}
      </Table>
    );
  }

  if (detailKey === "flats") {
    return (
      <Table headers={["Project", "Flat No", "Floor", "Status"]}>
        {flats.map((f) => (
          <tr key={f.id}>
            <Td>{projectName(f.project_id)}</Td>
            <Td className="font-medium text-slate-800">{f.flat_no}</Td>
            <Td>{f.floor}</Td>
            <Td><StatusPill code={f.status_code} /></Td>
          </tr>
        ))}
        {flats.length === 0 && <EmptyRow colSpan={4} />}
      </Table>
    );
  }

  if (detailKey === "available") {
    return (
      <Table headers={["Project", "Flat No", "Floor", "Price / sft"]}>
        {availableFlats.map((f) => (
          <tr key={f.id}>
            <Td>{projectName(f.project_id)}</Td>
            <Td className="font-medium text-slate-800">{f.flat_no}</Td>
            <Td>{f.floor}</Td>
            <Td>{fmtBDT(f.price_per_sft)}</Td>
          </tr>
        ))}
        {availableFlats.length === 0 && <EmptyRow colSpan={4} />}
      </Table>
    );
  }

  if (detailKey === "sold") {
    return (
      <Table headers={["Project", "Flat No", "Status", "Sold By", "Customer"]}>
        {soldFlats.map((f) => (
          <tr key={f.id}>
            <Td>{projectName(f.project_id)}</Td>
            <Td className="font-medium text-slate-800">{f.flat_no}</Td>
            <Td><StatusPill code={f.status_code} /></Td>
            <Td>{f.sale?.sold_by || "—"}</Td>
            <Td>{f.sale?.customer || "—"}</Td>
          </tr>
        ))}
        {soldFlats.length === 0 && <EmptyRow colSpan={5} />}
      </Table>
    );
  }

  if (detailKey === "soldAmount") {
    return (
      <div className="space-y-5">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Confirmed Sales</h4>
          <Table headers={["Flat", "Customer", "Sold Amount", "Date"]}>
            {confirmedSales.map((s) => (
              <tr key={s.id}>
                <Td className="font-medium text-slate-800">{s.flat?.flat_no || "—"}</Td>
                <Td>{s.customer?.name || "—"}</Td>
                <Td>{fmtBDT(s.sale_price)}</Td>
                <Td>{s.date}</Td>
              </tr>
            ))}
            {confirmedSales.length === 0 && <EmptyRow colSpan={4} />}
          </Table>
        </div>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Active Bookings (full listing value)</h4>
          <Table headers={["Flat", "Customer", "Value"]}>
            {activeBookings.map((b) => (
              <tr key={b.id}>
                <Td className="font-medium text-slate-800">{b.flat?.flat_no || "—"}</Td>
                <Td>{b.customer?.name || "—"}</Td>
                <Td>{fmtBDT(b.flat ? calcFlatPrice(b.flat).total : 0)}</Td>
              </tr>
            ))}
            {activeBookings.length === 0 && <EmptyRow colSpan={3} />}
          </Table>
        </div>
      </div>
    );
  }

  if (detailKey === "bookingMoney") {
    return (
      <Table headers={["Flat", "Customer", "Target", "Paid", "Due"]}>
        {activeBookings.map((b) => (
          <tr key={b.id}>
            <Td className="font-medium text-slate-800">{b.flat?.flat_no || "—"}</Td>
            <Td>{b.customer?.name || "—"}</Td>
            <Td>{fmtBDT(b.amount)}</Td>
            <Td>{fmtBDT(b.paid_amount)}</Td>
            <Td className="text-red-600">{fmtBDT(Number(b.amount) - Number(b.paid_amount || 0))}</Td>
          </tr>
        ))}
        {activeBookings.length === 0 && <EmptyRow colSpan={5} />}
      </Table>
    );
  }

  if (detailKey === "due") {
    return (
      <Table headers={["Flat", "Customer", "Sale Amount", "Paid", "Due"]}>
        {dueRows.map((s) => (
          <tr key={s.id}>
            <Td className="font-medium text-slate-800">{s.flat?.flat_no || "—"}</Td>
            <Td>{s.customer?.name || "—"}</Td>
            <Td>{fmtBDT(s.sale_price)}</Td>
            <Td>{fmtBDT(Number(s.sale_price) - s.due)}</Td>
            <Td className="text-red-600 font-semibold">{fmtBDT(s.due)}</Td>
          </tr>
        ))}
        {dueRows.length === 0 && <EmptyRow colSpan={5} />}
      </Table>
    );
  }

  if (detailKey === "cancelled") {
    return (
      <Table headers={["Flat", "Customer", "Employee", "Date"]}>
        {cancelledBookings.map((b) => (
          <tr key={b.id}>
            <Td className="font-medium text-slate-800">{b.flat?.flat_no || "—"}</Td>
            <Td>{b.customer?.name || "—"}</Td>
            <Td>{b.employee?.name || "—"}</Td>
            <Td>{b.date}</Td>
          </tr>
        ))}
        {cancelledBookings.length === 0 && <EmptyRow colSpan={4} />}
      </Table>
    );
  }

  return null;
}
