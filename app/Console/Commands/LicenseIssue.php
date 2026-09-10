<?php

namespace App\Console\Commands;

use App\Services\LicenseService;
use Carbon\Carbon;
use Illuminate\Console\Command;

/**
 * Issues a signed offline license token. Requires the private key at
 * config('license.private_key_path') (run `php artisan license:keygen` first).
 *
 *   php artisan license:issue --licensee="Acme Ltd" --days=30
 *   php artisan license:issue --licensee="Acme Ltd" --expires=2026-12-31 --grace=5
 *
 * Prints the LICENSE_KEY line to paste into the client's .env.
 */
class LicenseIssue extends Command
{
    protected $signature = 'license:issue
        {--licensee= : Name of the client the license is issued to}
        {--days=30 : Days from today until expiry (ignored if --expires is given)}
        {--expires= : Explicit expiry date Y-m-d}
        {--grace=3 : Extra days after expiry where the app still runs with a warning}';

    protected $description = 'Issue a signed offline license token (kill-switch key)';

    public function handle(): int
    {
        $privPath = config('license.private_key_path');
        if (! is_file($privPath)) {
            $this->error("Private key not found at {$privPath}. Run: php artisan license:keygen");
            $this->line('(Path comes from LICENSE_PRIVATE_KEY_PATH in .env, if set.)');
            return self::FAILURE;
        }

        $licensee = trim((string) $this->option('licensee'));
        if ($licensee === '') {
            $this->error('--licensee is required.');
            return self::FAILURE;
        }

        try {
            $expires = $this->option('expires')
                ? Carbon::parse($this->option('expires'))->endOfDay()
                : now()->addDays((int) $this->option('days'))->endOfDay();
        } catch (\Throwable $e) {
            $this->error('Invalid --expires date. Use Y-m-d.');
            return self::FAILURE;
        }

        $grace = max(0, (int) $this->option('grace'));

        $payload = [
            'v'          => 1,
            'product'    => LicenseService::PRODUCT,
            'licensee'   => $licensee,
            'issued'     => now()->toDateString(),
            'expires'    => $expires->toDateString(),
            'grace_days' => $grace,
        ];

        $json = json_encode($payload, JSON_UNESCAPED_SLASHES);

        $key = openssl_pkey_get_private(file_get_contents($privPath));
        if ($key === false) {
            $this->error('Could not read private key: ' . openssl_error_string());
            return self::FAILURE;
        }

        openssl_sign($json, $sig, $key, OPENSSL_ALGO_SHA256);

        $token = $this->b64url($json) . '.' . $this->b64url($sig);

        $this->newLine();
        $this->info('License issued');
        $this->table([], [
            ['Licensee', $licensee],
            ['Issued', $payload['issued']],
            ['Expires', $payload['expires'] . ' (end of day)'],
            ['Grace', $grace . ' day(s)'],
            ['Hard lock on', $expires->copy()->addDays($grace)->addDay()->toDateString()],
        ]);
        $this->newLine();
        $this->line('Add this line to the client\'s .env (replace any existing LICENSE_KEY):');
        $this->newLine();
        $this->line('LICENSE_KEY="' . $token . '"');
        $this->newLine();
        $this->line('Then on the client server: php artisan config:clear');

        return self::SUCCESS;
    }

    private function b64url(string $v): string
    {
        return rtrim(strtr(base64_encode($v), '+/', '-_'), '=');
    }
}
