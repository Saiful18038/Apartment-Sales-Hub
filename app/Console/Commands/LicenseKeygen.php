<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

/**
 * Generates the RSA keypair for offline licensing.
 *
 *   - private key -> config('license.private_key_path')
 *                    (LICENSE_PRIVATE_KEY_PATH in .env, default
 *                    storage/license/private.pem). KEEP THIS SECRET; never
 *                    ship it to the client. It signs every license token.
 *   - public key  -> baked into app/Services/LicenseService.php so the
 *                    handed-over app can verify tokens with no secrets.
 *
 * Run once, before the first `license:issue`. Running it again rotates the
 * keypair and invalidates every previously issued token.
 */
class LicenseKeygen extends Command
{
    protected $signature = 'license:keygen {--force : Overwrite an existing private key}';

    protected $description = 'Generate the RSA keypair used to sign/verify offline license tokens';

    public function handle(): int
    {
        $privPath = config('license.private_key_path');
        $dir = dirname($privPath);
        $pubPath = $dir . DIRECTORY_SEPARATOR . 'public.pem';

        if (is_file($privPath) && ! $this->option('force')) {
            $this->error("A private key already exists at {$privPath}.");
            $this->line('Re-run with --force to rotate it (this invalidates all existing licenses).');
            return self::FAILURE;
        }

        if (! is_dir($dir) && ! mkdir($dir, 0755, true) && ! is_dir($dir)) {
            $this->error("Could not create directory {$dir}. Check LICENSE_PRIVATE_KEY_PATH.");
            return self::FAILURE;
        }

        $conf = [
            'private_key_bits' => 2048,
            'private_key_type' => OPENSSL_KEYTYPE_RSA,
        ];
        if ($cnf = $this->opensslConfig()) {
            $conf['config'] = $cnf;
        }

        $res = openssl_pkey_new($conf);

        if ($res === false) {
            $this->error('openssl_pkey_new() failed: ' . openssl_error_string());
            $this->line('On XAMPP this usually means OpenSSL cannot find openssl.cnf.');
            $this->line('Set an environment variable and retry:  set OPENSSL_CONF=C:\\xampp\\apache\\conf\\openssl.cnf');
            return self::FAILURE;
        }

        openssl_pkey_export($res, $privPem, null, $conf);
        $pubPem = openssl_pkey_get_details($res)['key'];

        file_put_contents($privPath, $privPem);
        @chmod($privPath, 0600);
        file_put_contents($pubPath, $pubPem);

        if (! $this->bakePublicKey($pubPem)) {
            $this->error('Could not patch app/Services/LicenseService.php automatically.');
            $this->line('Paste this block into the PUBLIC_KEY_PEM constant by hand:');
            $this->line(PHP_EOL . trim($pubPem) . PHP_EOL);
            return self::FAILURE;
        }

        $this->info('Keypair generated.');
        $this->line("  private key : {$privPath}   (secret - do NOT hand over)");
        $this->line('  public key  : baked into app/Services/LicenseService.php');
        $this->newLine();
        $this->line('Next: php artisan license:issue --licensee="Client name" --days=30');

        return self::SUCCESS;
    }

    /** Best-effort path to an openssl.cnf (XAMPP ships several). */
    private function opensslConfig(): ?string
    {
        if (($env = getenv('OPENSSL_CONF')) && is_file($env)) {
            return $env;
        }
        foreach ([
            'C:\\xampp\\apache\\conf\\openssl.cnf',
            'C:\\xampp\\php\\extras\\openssl\\openssl.cnf',
            'C:\\xampp\\php\\extras\\ssl\\openssl.cnf',
        ] as $candidate) {
            if (is_file($candidate)) {
                return $candidate;
            }
        }
        return null;
    }

    private function bakePublicKey(string $pubPem): bool
    {
        $file = app_path('Services/LicenseService.php');
        $src = file_get_contents($file);

        $pattern = "/private const PUBLIC_KEY_PEM = <<<'PEM'\n.*?\nPEM;/s";
        $replacement = "private const PUBLIC_KEY_PEM = <<<'PEM'\n" . trim($pubPem) . "\nPEM;";

        $patched = preg_replace($pattern, $replacement, $src, 1, $count);
        if ($patched === null || $count !== 1) {
            return false;
        }

        return file_put_contents($file, $patched) !== false;
    }
}
