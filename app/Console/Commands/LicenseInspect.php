<?php

namespace App\Console\Commands;

use App\Services\LicenseService;
use Illuminate\Console\Command;

/**
 * Shows the current license state as the running app sees it. Safe to run
 * on the client server for support ("is it locked, and when does it lock?").
 */
class LicenseInspect extends Command
{
    protected $signature = 'license:status';

    protected $description = 'Show the current offline license status and expiry';

    public function handle(LicenseService $license): int
    {
        $status = $license->status();
        $expiry = $license->expiryDate();
        $days = $license->daysRemaining();

        $this->newLine();
        $this->table([], [
            ['Status', $status],
            ['Licensee', $license->licensee() ?? '-'],
            ['Expires', $expiry?->toDateString() ?? '-'],
            ['Days remaining', $days === null ? '-' : $days],
            ['App locked', in_array($status, LicenseService::BLOCKING, true) ? 'YES' : 'no'],
        ]);
        $this->newLine();

        return in_array($status, LicenseService::BLOCKING, true) ? self::FAILURE : self::SUCCESS;
    }
}
