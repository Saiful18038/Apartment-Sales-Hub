# Real Estate Inventory — Frontend

Next.js (App Router) + Tailwind CSS dashboard for the Real Estate Price
List, Inventory Management & Sales Tracking System (Roadmap Part A —
Main Application UI). Built from the original `RealEstateERP.jsx`
prototype, wired to the real Laravel API (`../laravel-backend`) instead of
browser-local storage.

## 1. Requirements

- Node.js 18+ (this machine has v24)
- The Laravel backend running at `http://127.0.0.1:8000` (see
  `../laravel-backend/README.md`)

## 2. Run it

```bash
npm install       # only needed once, or after pulling new dependencies
npm run dev
```

Open `http://localhost:3000`. `.env.local` already points
`NEXT_PUBLIC_API_BASE` at `http://127.0.0.1:8000/api` — change it if the
backend runs somewhere else.

Sign in with any of the seeded demo accounts (password `password`):
owner@company.com, admin@company.com, rahim@company.com, karim@company.com.

## 3. Structure

```
lib/api.js               fetch wrapper — Bearer token auth, license-status
                          header/403 handling, multipart upload (postForm),
                          authenticated file download (download())
lib/AuthContext.js        user/token state, login/logout, license-blocked state
lib/useApi.js             small GET hook (data/loading/error/refetch)
lib/status.js             colour-status map, mirrors asset_statuses on the API
lib/format.js             BDT currency formatting, date formatting, price calc
components/ui.js          shared atoms (Modal, Btn, StatusPill, Th/Td, ...)
components/AppShell.js    sidebar + header + license-restricted screen
components/DocumentsPanel.js  Phase 14 — upload/list/download/delete, reused
                               across Projects/Customers/Bookings/Sales/Payments
components/NotificationBell.js  Phase 19 — unread badge, polls every 30s,
                                 mark-read / mark-all-read
app/login/page.js         real login form (was one-click demo login in the
                           prototype)
app/(app)/*/page.js       one route per module — dashboard, zones, projects,
                           flats (visual floor map), customers, bookings,
                           sales, payments, reports, activity, users
```

## 4. What changed vs. the RealEstateERP.jsx prototype

- All `window.storage.get/set` persistence replaced with real `fetch()`
  calls to the Laravel API — nothing is stored in the browser except the
  Sanctum bearer token (`localStorage`).
- One-click demo login replaced with a real `POST /api/login` form.
- The "Dev: simulate license state" switcher is gone — license status now
  comes from the API's real `X-License-Status` response header and 403
  `LICENSE_*` errors (see `App\Services\LicenseService` on the backend).
  `<AppShell>` shows the same full-screen restricted state the prototype's
  `<LicenseRestrictedScreen>` did when the API reports a blocking status.
- Employee privacy (roadmap Phase 11) is enforced by the API, not the
  client — the frontend just renders whatever `sale` block the API sends
  (`null` when withheld). There is no client-side filtering to keep in
  sync with the backend's rules — verified in a real browser: an employee
  viewing a flat sold by a colleague sees "Sold-by / customer details
  hidden" instead of the actual buyer/amount.
- RBAC-based UI hiding (e.g. the "Employees" nav item, edit buttons) is a
  UX convenience only — the real enforcement is server-side
  (`role:owner,admin` middleware + `CheckRole`), same as the roadmap
  requires.

## 5. Document Management & Notifications (Phases 14 & 19)

- **Documents** — a 📎 paperclip icon on Projects, Customers, Bookings,
  Sales, and Payments opens `<DocumentsPanel>` in a modal: category picker,
  upload, and a list with download/delete. Access is enforced entirely by
  the API (`DocumentController`) — an employee who can't see a colleague's
  customer/booking/sale gets a 403 on that record's documents too, same
  boundary as everywhere else. Downloads go through `api.download()`
  (fetch-as-blob + trigger save) since the file endpoint needs the Bearer
  token, which a plain `<a href>` can't send.
- **Notifications** — the bell icon in the header polls
  `/api/notifications/unread-count` every 30s and shows a red badge; click
  it to see the latest 50 (Booking Confirmation, Payment Due Reminder,
  Follow-up Reminder, License Expiry Reminder) with mark-read /
  mark-all-read. The Customer form also gained a **Follow-up Date** field
  so the Follow-up Reminder has something to fire against.

## 6. Not included (Version 3 scope, matching the backend)

Any License Server admin UI — depends on backend Part B, not yet built
(see `../laravel-backend/README.md`).
