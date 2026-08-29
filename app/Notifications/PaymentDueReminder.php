<?php

namespace App\Notifications;

use App\Models\Sale;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;

/**
 * Roadmap Phase 19 — Payment Due Reminder.
 * Dispatched by the app:send-payment-due-reminders scheduled command
 * (see routes/console.php) for confirmed sales with an outstanding due
 * amount.
 */
class PaymentDueReminder extends Notification
{
    public function __construct(protected Sale $sale, protected float $dueAmount) {}

    public function via($notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toDatabase($notifiable): array
    {
        $this->sale->loadMissing(['flat', 'customer']);
        return [
            'type' => 'payment_due_reminder',
            'title' => 'Payment Due Reminder',
            'message' => "{$this->sale->flat->flat_no} — {$this->sale->customer->name} — Due ৳" . number_format($this->dueAmount),
            'sale_id' => $this->sale->id,
        ];
    }

    public function toMail($notifiable): MailMessage
    {
        $this->sale->loadMissing(['flat', 'customer']);
        return (new MailMessage)
            ->subject('Payment Due — ' . $this->sale->flat->flat_no)
            ->greeting("Hello {$notifiable->name},")
            ->line("The sale for {$this->sale->flat->flat_no} (customer: {$this->sale->customer->name}) still has an outstanding balance.")
            ->line('Due Amount: ৳' . number_format($this->dueAmount));
    }
}
