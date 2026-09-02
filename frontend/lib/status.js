/**
 * Roadmap §2.1 — Corrected Color-Coded Status System. Kept as a static
 * fallback matching the `asset_statuses` table seeded by DemoDataSeeder.php
 * on the API (the actual single source of truth per §2.2), so the UI still
 * renders correctly even before /api/flats' embedded status data loads.
 *
 * "Premium Color System" pass — one deliberate hue per status (Emerald =
 * Available, Indigo = Land Owner, Red = Sold, Violet = Re-Sale, Amber =
 * Asset Booked) instead of the old muted/randomized fills, so status is the
 * only thing color communicates on the floor-map (everything else — Address,
 * Basic Information, financials — stays neutral slate; see InfoBox in
 * app/(app)/flats/page.js). `border` doubles as the chart-series color on
 * the dashboard's bar chart (STATUS[code].border), so this exact 7-color,
 * ordered set (matching STATUS_ORDER below) is validated with
 * dataviz/scripts/validate_palette.js for adjacent colorblind- and
 * normal-vision separation — re-run that validator before changing any hue.
 * Sold (CR) and Sold (OS/SS) are deliberately different hues (red / teal)
 * rather than two shades of one red: they sit next to each other in every
 * legend and chart, and every badge already carries its own text label, so
 * color only needs to signal "which sold sub-type", not fight for the same
 * hue at low-Delta-E — see the validator's normal-vision floor.
 *
 * ASSET_BOOKED's label is "Sold Out", not "Asset Booked" — per the owner's
 * request, the moment a client pays booking money the flat should read as
 * sold to anyone looking at the floor-map, not "still somewhat available".
 * It keeps its own amber color (distinct from the two SOLD_* reds/teal) so
 * owner/admin can still tell at a glance "booked, not yet a confirmed sale"
 * — the underlying status_code, Booking record and approval workflow are
 * unchanged, only this displayed label.
 */
export const STATUS = {
  AVAILABLE: { label: "Available", fill: "#ECFDF5", border: "#059669", text: "#065F46", sellable: true },
  LAND_OWNER: { label: "Land Owner", fill: "#EEF2FF", border: "#4F46E5", text: "#3730A3", sellable: false },
  SOLD_CR: { label: "Sold (CR)", fill: "#FEF2F2", border: "#DC2626", text: "#991B1B", sellable: false },
  SOLD_OS_SS: { label: "Sold (OS/SS)", fill: "#F0FDFA", border: "#0D9488", text: "#115E59", sellable: false },
  RESALE_RR: { label: "Re-Sale (RR)", fill: "#F5F3FF", border: "#7C3AED", text: "#5B21B6", sellable: true },
  ASSET_BOOKED: { label: "Sold Out", fill: "#FFFBEB", border: "#D97706", text: "#92400E", sellable: false },
  READY: { label: "Ready Apartment", fill: "#FFFFFF", border: "#991B1B", text: "#991B1B", sellable: true },
};

export const STATUS_ORDER = ["AVAILABLE", "LAND_OWNER", "SOLD_CR", "SOLD_OS_SS", "RESALE_RR", "ASSET_BOOKED", "READY"];

export function statusMeta(code) {
  return STATUS[code] || STATUS.AVAILABLE;
}

export const CUSTOMER_STATUSES = ["New", "Interested", "Follow-up", "Negotiation", "Booked", "Sold", "Lost"];
export const CUSTOMER_STATUS_COLORS = {
  New: "bg-slate-100 text-slate-600",
  Interested: "bg-blue-50 text-blue-700",
  "Follow-up": "bg-amber-50 text-amber-700",
  Negotiation: "bg-purple-50 text-purple-700",
  Booked: "bg-orange-50 text-orange-700",
  Sold: "bg-green-50 text-green-700",
  Lost: "bg-red-50 text-red-700",
};

export const PROJECT_STATUSES = ["Planning", "Ongoing", "Completed", "Suspended", "Archived"];

// "Client Reference" — how a customer/lead reached us (Customer.reference_source).
export const CLIENT_REFERENCE_OPTIONS = ["Facebook", "Friend", "Old Data", "Walk-in", "Advertisement", "Other"];

// Team hierarchy / Task management (owner's request) — matches
// tasks.status/priority enums in the create_tasks_table migration.
export const TASK_STATUSES = ["todo", "in_progress", "done"];
export const TASK_STATUS_LABELS = { todo: "To Do", in_progress: "In Progress", done: "Done" };
export const TASK_STATUS_COLORS = {
  todo: "bg-slate-100 text-slate-600",
  in_progress: "bg-blue-50 text-blue-700",
  done: "bg-emerald-50 text-emerald-700",
};
export const TASK_PRIORITY_COLORS = {
  low: "bg-slate-100 text-slate-500",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-red-50 text-red-700",
};

/**
 * Roadmap Part B / Stage 16-20 — License states mirrored from the API's
 * CheckLicense middleware (App\Http\Middleware\CheckLicense /
 * App\Services\LicenseService). See lib/api.js's LicenseBlockedError.
 */
export const LICENSE_META = {
  ACTIVE: { label: "Active", blocked: false, warn: false },
  GRACE: { label: "Grace Period", blocked: false, warn: true },
  EXPIRED: { label: "Expired", blocked: true, warn: true },
  SUSPENDED: { label: "Suspended", blocked: true, warn: true },
  REVOKED: { label: "Revoked", blocked: true, warn: true },
};
