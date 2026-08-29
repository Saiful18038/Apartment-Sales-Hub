<?php

/**
 * Config for the License Middleware placeholder (see App\Services\LicenseService).
 * Add matching keys to .env — see .env.example in this package.
 */
return [
    'server_url' => env('LICENSE_SERVER_URL'),
    'key' => env('LICENSE_KEY'),
    'company_id' => env('LICENSE_COMPANY_ID'),
    'installation_id' => env('LICENSE_INSTALLATION_ID'),

    // DEV ONLY — lets you simulate ACTIVE / GRACE / EXPIRED / SUSPENDED / REVOKED
    // without a real License Server. Remove once Stage 16-20 is wired in.
    'simulated_status' => env('LICENSE_SIMULATED_STATUS', 'ACTIVE'),

    // DEV ONLY — Y-m-d date the License Expiry Reminder (Phase 19) counts
    // down to. The real License Server will report this instead once
    // Part B is built (LicenseService::expiryDate() is the only thing that
    // needs to change).
    'simulated_expiry_date' => env('LICENSE_SIMULATED_EXPIRY_DATE'),
];
