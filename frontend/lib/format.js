export function fmtBDT(n) {
  if (n === null || n === undefined || isNaN(n)) return "৳0";
  let neg = n < 0;
  n = Math.round(Math.abs(n));
  let s = String(n);
  let last3 = s.slice(-3);
  let rest = s.slice(0, -3);
  if (rest) {
    rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
    s = rest + "," + last3;
  }
  return (neg ? "-" : "") + "৳" + s;
}

export function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** BDT in Lac (lakh) notation, e.g. 500000 -> "5", 650000 -> "6.5". */
export function fmtLac(n) {
  if (n === null || n === undefined || isNaN(n)) return "0";
  const lac = Number(n) / 100000;
  return Number.isInteger(lac) ? String(lac) : lac.toFixed(1);
}

/** Roadmap Phase 5 — Price Formula (mirrors Flat::calcSubTotal() on the API). */
export function calcFlatPrice(flat) {
  const basic = (Number(flat.price_per_sft) || 0) * (Number(flat.size_sft) || 0);
  const parking = (Number(flat.parking_charge) || 0) * (Number(flat.parking_count) || 0);
  const utility = Number(flat.utility_charge) || 0;
  const reserve = Number(flat.reserve_fund) || 0;
  return { basic, parking, utility, reserve, total: basic + parking + utility + reserve };
}
