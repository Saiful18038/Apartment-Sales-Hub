<?php

namespace App\Console\Commands;

use App\Models\Customer;
use App\Models\User;
use App\Notifications\FollowUpReminder;
use Illuminate\Console\Command;

/**
 * Roadmap Phase 19 — Follow-up Reminder. Run daily (see routes/console.php).
 */
class SendFollowUpReminders extends Command
{
    protected $signature = 'app:send-follow-up-reminders';
    protected $description = "Notify the assigned employee and owner/admin of customers due for follow-up today.";

    public function handle(): int
    {
        $managers = User::whereIn('role', ['owner', 'admin'])->where('is_active', true)->get();
        $sent = 0;

        Customer::whereDate('follow_up_date', '<=', now()->toDateString())
            ->whereNotIn('status', ['Sold', 'Lost'])
            ->with('assignedEmployee')
            ->chunk(50, function ($customers) use ($managers, &$sent) {
                foreach ($customers as $customer) {
                    $alreadySentToday = $customer->assignedEmployee
                        ?->notifications()
                        ->where('type', FollowUpReminder::class)
                        ->where('data->customer_id', $customer->id)
                        ->whereDate('created_at', now()->toDateString())
                        ->exists();

                    if ($alreadySentToday) {
                        continue;
                    }

                    $recipients = $managers->concat([$customer->assignedEmployee])->filter()->unique('id');
                    foreach ($recipients as $recipient) {
                        $recipient->notify(new FollowUpReminder($customer));
                    }
                    $sent++;
                }
            });

        $this->info("Follow-up reminders sent for {$sent} customer(s).");
        return self::SUCCESS;
    }
}
