<?php

namespace App\Console\Commands;

use App\Models\Sale;
use App\Models\User;
use App\Notifications\PaymentDueReminder;
use Illuminate\Console\Command;

/**
 * Roadmap Phase 19 — Payment Due Reminder. Run daily (see routes/console.php).
 */
class SendPaymentDueReminders extends Command
{
    protected $signature = 'app:send-payment-due-reminders';
    protected $description = 'Notify the responsible employee and owner/admin of confirmed sales with an outstanding due amount.';

    public function handle(): int
    {
        $managers = User::whereIn('role', ['owner', 'admin'])->where('is_active', true)->get();
        $sent = 0;

        Sale::where('status', 'confirmed')
            ->with(['employee', 'payments'])
            ->chunk(50, function ($sales) use ($managers, &$sent) {
                foreach ($sales as $sale) {
                    $due = (float) $sale->sale_price - (float) $sale->payments->sum('amount');
                    if ($due <= 0) {
                        continue;
                    }

                    // Don't re-notify the same sale more than once a week.
                    $alreadySent = $sale->employee
                        ?->notifications()
                        ->where('type', PaymentDueReminder::class)
                        ->where('data->sale_id', $sale->id)
                        ->where('created_at', '>=', now()->subDays(7))
                        ->exists();

                    if ($alreadySent) {
                        continue;
                    }

                    // concat() (not push()) — push() mutates $managers in place,
                    // which would accumulate every sale's employee across iterations.
                    $recipients = $managers->concat([$sale->employee])->filter()->unique('id');
                    foreach ($recipients as $recipient) {
                        $recipient->notify(new PaymentDueReminder($sale, $due));
                    }
                    $sent++;
                }
            });

        $this->info("Payment due reminders sent for {$sent} sale(s).");
        return self::SUCCESS;
    }
}
