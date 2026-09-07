"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { calcFlatPrice } from "@/lib/format";
import { STATUS, STATUS_ORDER } from "@/lib/status";

/**
 * All the data-fetching and derived figures behind the Dashboard's stat
 * cards and charts, shared between the Dashboard page itself and the
 * dashboard-detail page each card opens in a new tab — both need the exact
 * same numbers, so this is the one place that computes them.
 */
export function useDashboardData() {
  const [state, setState] = useState({ loading: true, error: "" });
  const [zones, setZones] = useState([]);
  const [projects, setProjects] = useState([]);
  const [flats, setFlats] = useState([]);
  const [sales, setSales] = useState([]);
  const [payments, setPayments] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const [z, p, f, s, pay, book, act] = await Promise.all([
          api.get("/zones"),
          api.get("/projects"),
          api.get("/flats"),
          api.get("/sales"),
          api.get("/payments"),
          api.get("/bookings"),
          api.get("/activity-logs"),
        ]);
        setZones(z);
        setProjects(p);
        setFlats(f.data || []);
        setSales(s);
        setPayments(pay);
        setBookings(book);
        setActivity(act);
        setState({ loading: false, error: "" });
      } catch (e) {
        setState({ loading: false, error: e.message || "Failed to load dashboard." });
      }
    })();
  }, []);

  if (state.loading || state.error) {
    return { loading: state.loading, error: state.error };
  }

  const byStatus = STATUS_ORDER.map((code) => ({
    code,
    label: STATUS[code].label,
    count: flats.filter((f) => f.status_code === code).length,
    fill: STATUS[code].border,
  }));

  const confirmedSales = sales.filter((s) => s.status === "confirmed");
  const totalPaid = payments.reduce((a, p) => a + Number(p.amount), 0);
  const totalSaleValue = confirmedSales.reduce((a, s) => a + Number(s.sale_price), 0);
  const totalDue = totalSaleValue - totalPaid;
  const pendingSales = sales.filter((s) => s.status === "pending").length;

  // A flat's status_code goes to SOLD_CR/SOLD_OS_SS the instant booking
  // money is taken (BookingController::store) — before any Sale exists —
  // per the owner's request: booking money already commits the unit, so the
  // dashboard should read it as sold immediately, not only once the Booking
  // is converted into a confirmed Sale. That means the flats list ALREADY
  // carries every actively-booked unit under a SOLD_* status_code, so
  // counting it here too would double it — soldApartmentCount is just the
  // flat count, full stop.
  //
  // "Total Sold Amount" is the full committed value of every such unit
  // (confirmed sales' actual sale_price, which already reflects any
  // sold-price/sft discount, plus the full listing price of units still in
  // an active booking) — distinct from "Total Booking Money", which is only
  // the cash actually collected so far on those still-active bookings (an
  // active booking's target Booking Money can be paid in installments; see
  // Booking::paid_amount).
  const activeBookings = bookings.filter((b) => b.status === "active");
  const soldApartmentCount = flats.filter((f) => ["SOLD_CR", "SOLD_OS_SS"].includes(f.status_code)).length;
  const activeBookingsFullValue = activeBookings.reduce((a, b) => a + (b.flat ? calcFlatPrice(b.flat).total : 0), 0);
  const totalBookingMoney = activeBookings.reduce((a, b) => a + Number(b.paid_amount || 0), 0);
  const totalSoldAmount = totalSaleValue + activeBookingsFullValue;
  const availableFlats = flats.filter((f) => f.status_code === "AVAILABLE");
  const availableCount = availableFlats.length;
  const soldFlats = flats.filter((f) => ["SOLD_CR", "SOLD_OS_SS"].includes(f.status_code));
  const cancelledBookings = bookings.filter((b) => b.status === "cancelled");
  const cancelledApartmentCount = cancelledBookings.length;

  // Total Due detail: per-sale outstanding balance, only for sales that
  // actually still owe something — the same figures Total Due sums, broken
  // out per confirmed sale instead of as one aggregate.
  const paidBySale = payments.reduce((acc, p) => {
    const id = p.sale_id ?? p.sale?.id;
    acc[id] = (acc[id] || 0) + Number(p.amount);
    return acc;
  }, {});
  const dueRows = confirmedSales
    .map((s) => ({ ...s, due: Number(s.sale_price) - (paidBySale[s.id] || 0) }))
    .filter((s) => s.due > 0)
    .sort((a, b) => b.due - a.due);

  return {
    loading: false,
    error: "",
    zones,
    projects,
    flats,
    sales,
    payments,
    bookings,
    activity,
    byStatus,
    confirmedSales,
    totalPaid,
    totalSaleValue,
    totalDue,
    pendingSales,
    activeBookings,
    soldApartmentCount,
    activeBookingsFullValue,
    totalBookingMoney,
    totalSoldAmount,
    availableFlats,
    availableCount,
    soldFlats,
    cancelledBookings,
    cancelledApartmentCount,
    dueRows,
  };
}
