<?php

namespace App\Services;

use Carbon\Carbon;

/**
 * ============================================================================
 * LICENSE MIDDLEWARE — PLACEHOLDER (server-side mirror of checkLicenseStatus()
 * in the React prototype). Roadmap Part B / Stage 16-20.
 * ----------------------------------------------------------------------------
 * This is a STUB. When the real License Server (Part B of the roadmap) is
 * built, replace ONLY the body of status() with a real HTTP call, e.g.:
 *
 *   $response = Http::timeout(3)->post(
 *       config('license.server_url') . '/api/v1/license/validate',
 *       [
 *           'license_key'     => config('license.key'),
 *           'company_id'      => config('license.company_id'),
 *           'installation_id' => config('license.installation_id'),
 *           'app_version'     => config('app.version'),
 *       ]
 *   );
 *
 *   if ($response->successful()) {
 *       $status = $response->json('status'); // ACTIVE|GRACE|EXPIRED|SUSPENDED|REVOKED
 *       Cache::put('license.status', $status, now()->addHours(6)); // Phase 6 — local cache
 *       return $status;
 *   }
 *
 *   // Server unreachable — fall back to the last cached signed status
 *   // (Phase 6) rather than failing the whole app closed immediately.
 *   return Cache::get('license.status', 'GRACE');
 *
 * Nothing else needs to change — CheckLicense middleware and every
 * controller that calls guard() already read status() through here.
 * ============================================================================
 */
class LicenseService
{
    public const BLOCKING = ['EXPIRED', 'SUSPENDED', 'REVOKED'];

    public function status(): string
    {
        // TODO: replace with real License Server call + Cache-backed fallback.
        return config('license.simulated_status', 'ACTIVE');
    }

    public function isBlocked(): bool
    {
        return in_array($this->status(), self::BLOCKING, true);
    }

    /**
     * Roadmap Phase 19 — feeds app:send-license-expiry-reminders.
     * TODO: once Part B exists, read this from the same License Server
     * response that status() will call — no other code needs to change.
     */
    public function expiryDate(): ?Carbon
    {
        $date = config('license.simulated_expiry_date');
        return $date ? Carbon::parse($date) : null;
    }

    /**
     * Use inside a controller action for an extra, per-action re-check on
     * sensitive writes (sale approval, payment entry, destructive deletes) —
     * mirrors guardAction() in the React prototype.
     */
    public function guard(): void
    {
        if ($this->isBlocked()) {
            abort(403, 'Action blocked — license is ' . $this->status() . '. Contact your software provider.');
        }
    }
}
