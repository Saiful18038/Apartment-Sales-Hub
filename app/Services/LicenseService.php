<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

/**
 * ============================================================================
 * OFFLINE LICENSE / KILL SWITCH
 * ----------------------------------------------------------------------------
 * The app ships with an RSA *public* key (PUBLIC_KEY_PEM below). A license is
 * a short signed token issued with the matching private key, which the
 * software provider keeps and never hands over:
 *
 *     LICENSE_KEY="<base64url(payload)>.<base64url(signature)>"   (in .env)
 *
 * On every request CheckLicense middleware calls status(). This class:
 *   1. verifies the token signature against PUBLIC_KEY_PEM (tamper check),
 *   2. compares the embedded expiry date to the clock,
 *   3. refuses to run if the system clock was rolled back (anti-tamper).
 *
 * Result:
 *   ACTIVE   - before expiry
 *   GRACE    - within `grace_days` after expiry (app still works, shows a
 *              warning banner via the X-License-Status header)
 *   EXPIRED  - past expiry + grace  -> whole app is locked
 *   REVOKED  - token missing/blank/corrupt/forged, or clock tampering
 *
 * To extend a license: issue a new token (`php artisan license:issue ...`)
 * and give the client the new LICENSE_KEY line. Nothing else changes.
 *
 * NOTE ON STRENGTH: this is an honest, offline time-lock. A developer with
 * full server access can edit PHP to bypass any local check - that is true
 * of every offline licensing scheme. It is a contractual/deterrent control,
 * not unbreakable DRM.
 * ============================================================================
 */
class LicenseService
{
    /** Statuses that CheckLicense treats as a hard lock. */
    public const BLOCKING = ['EXPIRED', 'SUSPENDED', 'REVOKED'];

    public const PRODUCT = 'apartment-sales-hub';

    /**
     * RSA public key used to verify license tokens. Replaced in place by
     * `php artisan license:keygen`. Leave as the placeholder and the app
     * fails closed (locked) everywhere except local dev.
     */
    private const PUBLIC_KEY_PEM = <<<'PEM'
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAx+mbVpUViqhj4sKlkyaX
cn2KkBejD3DBRNythaFZj3wsfhbneagw/ghB4OH3DPpljTLnUhFW+W9S52mYrdR8
VxySuea42X0/iSa2Saxg/fr97w4wXpRiNAzmOBQaZAAZCmaNr4S6VbQvQ9VteluU
Tk2azYps+nkja8p05OvF9X8pw2O3kUPUr2Ca0sj8i8L3w/xF5mo29AX76YaSWLfC
0UB6JIT8ZjptDcP5QhXvfOWyYesmAqy1/vDb1de1SCa4PgqpR5lsc/z/qDjyzCwk
lH61sbK2bJno5FXNBvMw4ReOk8ls+zWrMExaarY2wrn7qjK3FpxHxbxDm1M0lVyZ
yQIDAQAB
-----END PUBLIC KEY-----
PEM;

    /** Memoised per request so the RSA verify runs at most once. */
    private ?array $resolved = null;

    public function status(): string
    {
        return $this->resolve()['status'];
    }

    public function isBlocked(): bool
    {
        return in_array($this->status(), self::BLOCKING, true);
    }

    /**
     * Expiry date from the verified token (null when there is no valid
     * token). Feeds app:send-license-expiry-reminders.
     */
    public function expiryDate(): ?Carbon
    {
        return $this->resolve()['expires_at'];
    }

    /** Licensee name from the verified token, for support/status output. */
    public function licensee(): ?string
    {
        return $this->resolve()['licensee'];
    }

    /** Whole-number days until expiry; negative once expired. */
    public function daysRemaining(): ?int
    {
        $expiry = $this->expiryDate();
        return $expiry ? (int) round(now()->startOfDay()->diffInDays($expiry->copy()->startOfDay(), false)) : null;
    }

    /**
     * Extra per-action re-check for sensitive writes (sale approval,
     * payment entry, destructive deletes).
     */
    public function guard(): void
    {
        if ($this->isBlocked()) {
            abort(403, 'Action blocked - license is ' . $this->status() . '. Contact your software provider.');
        }
    }

    // ------------------------------------------------------------------ //

    private function resolve(): array
    {
        return $this->resolved ??= $this->evaluate();
    }

    private function evaluate(): array
    {
        $blank = ['status' => 'REVOKED', 'expires_at' => null, 'licensee' => null];

        $token = trim((string) config('license.key'));

        // No token configured. On a developer machine or the test suite,
        // honour the simulated status so work is never blocked. Anywhere
        // else (production, staging, a client install): fail closed.
        if ($token === '') {
            if (app()->environment('local', 'testing')) {
                return [
                    'status'     => config('license.simulated_status', 'ACTIVE'),
                    'expires_at' => $this->simulatedExpiry(),
                    'licensee'   => 'LOCAL DEV',
                ];
            }
            Log::warning('License: no LICENSE_KEY configured - locking.');
            return $blank;
        }

        $payload = $this->verifyToken($token);
        if ($payload === null) {
            Log::warning('License: token missing, malformed, or signature invalid - locking.');
            return $blank;
        }

        if (($payload['product'] ?? null) !== self::PRODUCT) {
            Log::warning('License: token is for a different product - locking.');
            return $blank;
        }

        if ($this->clockRolledBack()) {
            Log::warning('License: system clock moved backwards - locking (suspected tampering).');
            return ['status' => 'REVOKED', 'expires_at' => null, 'licensee' => $payload['licensee'] ?? null];
        }

        $expires = Carbon::parse($payload['expires'])->endOfDay();
        $graceEnds = $expires->copy()->addDays((int) ($payload['grace_days'] ?? 0));
        $now = now();

        $status = $now->lte($expires) ? 'ACTIVE'
            : ($now->lte($graceEnds) ? 'GRACE' : 'EXPIRED');

        return [
            'status'     => $status,
            'expires_at' => $expires,
            'licensee'   => $payload['licensee'] ?? null,
        ];
    }

    /**
     * Verify `<base64url(json)>.<base64url(sig)>` against PUBLIC_KEY_PEM.
     * Returns the decoded payload array, or null on any failure.
     */
    private function verifyToken(string $token): ?array
    {
        $pem = trim(self::PUBLIC_KEY_PEM);
        if (str_contains($pem, 'PLACEHOLDER')) {
            return null;
        }

        $parts = explode('.', $token);
        if (count($parts) !== 2) {
            return null;
        }

        $json = self::b64urlDecode($parts[0]);
        $sig  = self::b64urlDecode($parts[1]);
        if ($json === false || $sig === false) {
            return null;
        }

        $key = openssl_pkey_get_public($pem);
        if ($key === false) {
            return null;
        }

        $ok = openssl_verify($json, $sig, $key, OPENSSL_ALGO_SHA256);
        if ($ok !== 1) {
            return null;
        }

        $payload = json_decode($json, true);
        return (is_array($payload) && isset($payload['expires'])) ? $payload : null;
    }

    /**
     * True if the clock is now more than a day behind the newest time we
     * have ever observed. Records the high-water mark in storage.
     */
    private function clockRolledBack(): bool
    {
        $path = storage_path('license/clock');
        $now = time();
        $seen = is_file($path) ? (int) trim((string) @file_get_contents($path)) : 0;

        $rolledBack = $seen > 0 && ($now + 86400) < $seen;

        if ($now > $seen && ! $rolledBack) {
            if (! is_dir(dirname($path))) {
                @mkdir(dirname($path), 0755, true);
            }
            @file_put_contents($path, (string) $now);
        }

        return $rolledBack;
    }

    private function simulatedExpiry(): ?Carbon
    {
        $date = config('license.simulated_expiry_date');
        return $date ? Carbon::parse($date) : null;
    }

    private static function b64urlDecode(string $v): string|false
    {
        return base64_decode(strtr($v, '-_', '+/'), true);
    }
}
