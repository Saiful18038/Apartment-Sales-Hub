# Real Estate Inventory — Laravel Backend

Laravel 11 + Sanctum API backend for the Real Estate Price List, Inventory
Management & Sales Tracking System (Roadmap **Part A — Main Application**,
MVP scope). This is a real, bootstrapped Laravel project — `composer.json`,
`artisan`, `bootstrap/app.php`, `vendor/`, everything — not a hand-written
skeleton. It has been migrated, seeded, and smoke-tested end-to-end against
MySQL in this environment.

## 1. Requirements

- PHP 8.2+, Composer (both already available via XAMPP on this machine)
- MySQL running (XAMPP) — database `real_estate` already created

## 2. Run it

```bash
composer install            # only needed if vendor/ is ever removed
php artisan migrate --seed   # only needed on a fresh database
powershell -ExecutionPolicy Bypass -File build-frontend.ps1   # build the UI into public/
php artisan serve
```

Then open **http://localhost:8000** — this serves both the UI and the API.

`.env` is already configured for XAMPP's MySQL (`root`, no password,
database `real_estate`). Copy `.env.example` → `.env` and run
`php artisan key:generate` if you ever need to recreate it from scratch.

### Frontend

The dashboard lives in `frontend/` (Next.js) — same repo, same folder tree.
It is compiled to a static export and copied into `public/` by
`build-frontend.ps1`. After the first build there is **one server** —
`php artisan serve` on port 8000 serves the UI, the API (`/api/*`), and the
static bundles together. No Node process is needed at runtime.

Re-run `build-frontend.ps1` whenever the frontend source changes. For fast
UI iteration you can still run the Next dev server directly
(`cd frontend && npm run dev` → http://localhost:3000, which talks to the
API on port 8000 via `frontend/.env.development`).

All demo users share the password `password`:

| Email | Role |
|---|---|
| owner@company.com | owner |
| admin@company.com | admin |
| rahim@company.com | employee |
| karim@company.com | employee |

```bash
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@company.com","password":"password"}'
# → { "token": "...", "user": {...} }

curl http://localhost:8000/api/flats \
  -H "Authorization: Bearer <token>"
```

## 3. Run the tests

```bash
php artisan test
```

17 tests covering License state transitions, Employee Privacy row-level
scoping, API error format, Document Management access control, and the
Notification System. They run against an in-memory SQLite DB
(`phpunit.xml`), completely isolated from the MySQL dev database.

## 3a. Run the notification reminders

The three Phase 19 reminder commands are meant to run daily via the
scheduler (`routes/console.php`), but you can trigger them by hand at any
time to see them fire:

```bash
php artisan app:send-payment-due-reminders
php artisan app:send-follow-up-reminders
php artisan app:send-license-expiry-reminders
```

For the license reminder to actually fire, `LICENSE_SIMULATED_EXPIRY_DATE`
in `.env` needs to land on a 30/15/7-day checkpoint from today. For the
follow-up reminder, at least one customer needs `follow_up_date` set to
today or earlier (settable from the frontend's Customer form). To actually
run the scheduler continuously in dev: `php artisan schedule:work`.

## 4. What's implemented (Roadmap Part A, Phases 0–16, 19)

- **Sanctum token auth** — `POST /api/login`, `POST /api/logout`, `GET /api/me`
- **RBAC** — `CheckRole` middleware (`role:owner,admin`) enforced at the
  route level via `bootstrap/app.php` middleware aliases, not just hidden
  in a UI.
- **Corrected colour-status system (Phase 6 / roadmap §2.1)** —
  database-driven `asset_statuses` table, seeded as the single source of
  truth: Green=Land Owner, Yellow=Sold(CR), Blue=Sold(OS/SS), Pink=Re-Sale,
  Orange=Asset Booked, Red text=Ready, White=Available.
- **Zone/Area unification (§1.1)** — one `zones` table, no duplicate concept.
- **project_type field (§1.1)** — `projects.type` enum (`regular`/`rr`).
- **RR count consistency (§2.3)** — reports are computed *live* from the
  `flats`/`sales`/`bookings` tables every time (see
  `ReportController::teamSummary`), instead of a separately-maintained
  count. This is the structural fix for the "RR total 25 vs 24" mismatch
  bug described in the roadmap — the numbers literally cannot drift apart
  because there is only one source of truth.
- **Employee privacy / row-level security (Phase 11)** — enforced
  *server-side*, not just in the UI:
  - `Sale::scopeVisibleTo()` / `Booking::scopeVisibleTo()` /
    `Customer::scopeVisibleTo()` filter the SQL query itself for employees
    — other employees' rows never leave the database.
  - `FlatResource` withholds the `sale` block entirely for flats sold by
    another employee.
- **Sale approval workflow (Phase 10)** — employee-created sales default to
  `pending`; only `owner`/`admin` can hit `POST /api/sales/{id}/approve`
  or `/reject`.
- **License-check hook (Roadmap Part B / Stage 16-20)** — wired in from day
  one, per your request, so the real License Server can be dropped in later
  without touching routes or controllers:
  - `App\Services\LicenseService` is the single place that knows the
    current license status. Right now it just reads
    `LICENSE_SIMULATED_STATUS` from `.env` (`ACTIVE` by default).
  - `App\Http\Middleware\CheckLicense` (aliased as `license` in
    `bootstrap/app.php`) gates the *entire* `/api` route group — a blocked
    license (`EXPIRED`/`SUSPENDED`/`REVOKED`) returns `403` with
    `{"error":"LICENSE_<STATUS>"}` before any controller runs. `ACTIVE`/
    `GRACE` pass through with an `X-License-Status` response header.
  - `LicenseService::guard()` is additionally called inside
    `SaleController::approve/reject` and `PaymentController::store` as a
    per-action re-check on sensitive financial writes.
  - **When Part B (the real License Server) is built**, only the body of
    `LicenseService::status()` needs to change to an HTTP call — see the
    docblock in that file for the exact shape. Nothing else in the app
    needs to move.
- **Team Performance Summary report** — `GET /api/reports/team-summary`
  (Total Apt/sft/Revenue/Booking/Cancelled Apt per team, owner's spec;
  replaced the earlier Zone-based Floor & Stock Summary report).
- **Document Management (Phase 14)** — `documents` table, polymorphic
  across Project/Customer/Booking/Sale/Payment (`Document::DOCUMENTABLE_TYPES`).
  Files land on the private `local` disk (`storage/app/private` — never
  web-accessible); `DocumentController::download()` is the only way to
  read one back, and it re-checks the exact same employee-privacy rule as
  Phase 11 before streaming a byte (`DocumentManagementTest`). "Agreement"
  from the roadmap's document list is a `category` value, not a separate
  documentable type — there's no standalone Agreement entity in the MVP.
- **Notification System (Phase 19)** — real Laravel notifications
  (`database` + `mail` channels) for all four kinds the roadmap names:
  - Booking Confirmation — fired synchronously from `BookingController::store()`.
  - Payment Due Reminder, Follow-up Reminder, License Expiry Reminder —
    each its own scheduled command (`app:send-*`, see §3a), all with
    same-day/same-week dedup so a rerun or overlapping cron entry can't
    spam duplicates.
  - `GET /api/notifications`, `/unread-count`, `POST /{id}/read`,
    `/read-all` — the frontend's bell icon polls these.
  - Mail currently just writes to `storage/logs/laravel.log`
    (`MAIL_MAILER=log`) — point it at real SMTP and delivery starts for
    real with no code change, same placeholder philosophy as the License
    hook.

## 5. Not included (intentionally — Version 3 scope per the roadmap's release plan)

- The actual License Server (Part B) — build once the MVP above is
  confirmed working end-to-end; only `LicenseService::status()` and
  `expiryDate()` need to change to call it.
- Building/Block as its own DB level — the roadmap's hierarchy diagram
  (§3.1) mentions it but Phase 5's field list and the MVP release plan
  don't, so flats stay directly under `project` + `floor` for now. Revisit
  if the company's projects actually have multiple named buildings sharing
  one zone.

## 6. Deploying (Render, or any Docker host)

The repo ships a `Dockerfile` that builds the whole app — Next.js dashboard
compiled to a static export in stage 1, copied into Laravel's `public/` in
stage 2 — into one image that serves the UI + API on a single port. It
self-configures on first boot (`docker-entrypoint.sh`): creates `.env` from
`.env.example` if missing, generates `APP_KEY`, runs migrations + seeders,
and starts `php artisan serve` on `$PORT` (Render sets this automatically;
defaults to `10000`).

To deploy on Render:

1. New → Web Service → connect this GitHub repo, runtime **Docker**
   (or New → Blueprint to pick up `render.yaml` automatically).
2. No build/start command needed — Render just builds the `Dockerfile`.
3. Defaults to a bundled SQLite database (`DB_CONNECTION=sqlite`), so it
   runs with zero external services. **Render's free plan has an ephemeral
   filesystem**, so SQLite data does not survive a redeploy or a cold
   start after the free instance spins down — fine for a demo/portfolio
   deploy, not for data you need to keep. For real persistent data, add a
   managed MySQL/Postgres and set `DB_CONNECTION`/`DB_HOST`/`DB_DATABASE`/
   `DB_USERNAME`/`DB_PASSWORD` in the service's Environment tab (the
   container picks them up automatically — no code change needed).
4. After the first successful deploy, set `APP_URL` in the dashboard to
   the assigned `https://*.onrender.com` URL.

The same image runs on any other Docker host the same way:
`docker build -t apartment-sales-hub . && docker run -p 8000:10000 apartment-sales-hub`.

## 7. Project layout notes for VS Code

Everything under `app/`, `config/license.php`, `database/migrations/2024_*`,
`database/seeders/`, and `routes/api.php` is the hand-authored business
logic. Everything else (`vendor/`, `bootstrap/`, `public/`, the base
`config/*.php` files, the `0001_01_01_*` migrations, Sanctum) came from a
real `composer create-project laravel/laravel` scaffold merged in on top,
so `composer install`, `php artisan serve`, and the whole Laravel toolchain
work normally — open the folder in VS Code and it's a standard Laravel app.
