<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Notifications\LicenseExpiryReminder;
use App\Services\LicenseService;
use Illuminate\Console\Command;

/**
 * Roadmap Phase 19 / Part B — License Expiry Reminder (30/15/7 days out).
 * Run daily (see routes/console.php). Reads the expiry date from
 * LicenseService::expiryDate() — the placeholder that Part B's real
 * License Server will eventually back.
 */
class SendLicenseExpiryReminders extends Command
{
    protected $signature = 'app:send-license-expiry-reminders';
    protected $description = 'Notify owner/admin when the license is 30, 15, or 7 days from expiry.';

    public function handle(LicenseService $license): int
    {
        $expiry = $license->expiryDate();
        if (!$expiry) {
            $this->info('No simulated expiry date configured (LICENSE_SIMULATED_EXPIRY_DATE) — nothing to check.');
            return self::SUCCESS;
        }

        $daysRemaining = (int) now()->startOfDay()->diffInDays($expiry->copy()->startOfDay(), false);

        if (!in_array($daysRemaining, [30, 15, 7], true)) {
            $this->info("License expires in {$daysRemaining} day(s) — not a reminder checkpoint (30/15/7).");
            return self::SUCCESS;
        }

        $managers = User::whereIn('role', ['owner', 'admin'])->where('is_active', true)->get();
        $sent = 0;
        foreach ($managers as $manager) {
            // Don't re-notify the same person for the same checkpoint twice
            // in one day (e.g. an overlapping cron entry or a manual rerun).
            $alreadySentToday = $manager->notifications()
                ->where('type', LicenseExpiryReminder::class)
                ->where('data->message', 'like', "%expires in {$daysRemaining} day(s)%")
                ->whereDate('created_at', now()->toDateString())
                ->exists();

            if ($alreadySentToday) {
                continue;
            }

            $manager->notify(new LicenseExpiryReminder($daysRemaining, $expiry->toDateString()));
            $sent++;
        }

        $this->info("License expiry reminder ({$daysRemaining} days) sent to {$sent} owner/admin user(s).");
        return self::SUCCESS;
    }
}
