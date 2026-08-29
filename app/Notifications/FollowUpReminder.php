<?php

namespace App\Notifications;

use App\Models\Customer;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;

/**
 * Roadmap Phase 19 — Follow-up Reminder.
 * Dispatched by the app:send-follow-up-reminders scheduled command for
 * customers whose follow_up_date has arrived and are not yet Sold/Lost.
 */
class FollowUpReminder extends Notification
{
    public function __construct(protected Customer $customer) {}

    public function via($notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toDatabase($notifiable): array
    {
        return [
            'type' => 'follow_up_reminder',
            'title' => 'Follow-up Reminder',
            'message' => "Follow up with {$this->customer->name} today (status: {$this->customer->status})",
            'customer_id' => $this->customer->id,
        ];
    }

    public function toMail($notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Follow-up Reminder — ' . $this->customer->name)
            ->greeting("Hello {$notifiable->name},")
            ->line("Today is the scheduled follow-up date for {$this->customer->name} (current status: {$this->customer->status}).")
            ->line($this->customer->phone ? "Phone: {$this->customer->phone}" : '');
    }
}
