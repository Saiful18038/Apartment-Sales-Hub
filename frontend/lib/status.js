/**
 * Roadmap §2.1 — Corrected Color-Coded Status System. Kept as a static
 * fallback matching the `asset_statuses` table seeded by DemoDataSeeder.php
 * on the API (the actual single source of truth per §2.2), so the UI still
 * renders correctly even before /api/flats' embedded status data loads.
 */
export const STATUS = {
  AVAILABLE: { label: "Available", fill: "#FFFFFF", border: "#CBD5E1", text: "#334155", sellable: true },
  LAND_OWNER: { label: "Land Owner", fill: "#C6E0B4", border: "#8FAE7C", text: "#284616", sellable: false },
  SOLD_CR: { label: "Sold (CR)", fill: "#FFE699", border: "#D8B84A", text: "#5C4A08", sellable: false },
  SOLD_OS_SS: { label: "Sold (OS/SS)", fill: "#BDD7EE", border: "#6FA8DC", text: "#1B4A6B", sellable: false },
  RESALE_RR: { label: "Re-Sale (RR)", fill: "#F4C7DE", border: "#D888AE", text: "#7A1E48", sellable: true },
  ASSET_BOOKED: { label: "Asset Booked", fill: "#FBD5A5", border: "#E0A458", text: "#6B3E07", sellable: false },
  READY: { label: "Ready Apartment", fill: "#FFFFFF", border: "#DC2626", text: "#DC2626", sellable: true },
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
