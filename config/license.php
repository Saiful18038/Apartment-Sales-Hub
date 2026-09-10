<?php

/**
 * Offline license / kill switch — see App\Services\LicenseService.
 *
 * LICENSE_KEY is a signed token produced by `php artisan license:issue`.
 * It carries its own expiry and grace period, so nothing else here needs
 * to change to extend or shorten a license — just swap the key.
 */
return [
    // The signed license token. Empty => locked (except on a local dev
    // machine, where `simulated_status` below applies instead).
    'key' => env('LICENSE_KEY'),

    // Where the SECRET signing key lives on the provider's machine, used by
    // `license:keygen` (writes it) and `license:issue` (reads it). Point
    // this at a path OUTSIDE the project so it can never be swept into a
    // handover archive. Absolute path recommended. Never needed on the
    // client's server. Defaults to storage/license/private.pem.
    'private_key_path' => env('LICENSE_PRIVATE_KEY_PATH') ?: storage_path('license/private.pem'),

    // DEV ONLY — when LICENSE_KEY is empty AND APP_ENV=local, pretend the
    // license is in this state: ACTIVE | GRACE | EXPIRED | SUSPENDED | REVOKED.
    'simulated_status' => env('LICENSE_SIMULATED_STATUS', 'ACTIVE'),

    // DEV ONLY — Y-m-d expiry the reminder command counts down to when
    // running without a real token.
    'simulated_expiry_date' => env('LICENSE_SIMULATED_EXPIRY_DATE'),
];
