<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;

/**
 * Roadmap Phase 19 / Part B — License Expiry Reminder (30/15/7 days out).
 * Dispatched by the app:send-license-expiry-reminders scheduled command,
 * which reads the expiry date from App\Services\LicenseService — the same
 * placeholder that will be backed by the real License Server in Part B.
 * Only owner/admin receive this (it's a business/billing concern).
 */
class LicenseExpiryReminder extends Notification
{
    public function __construct(protected int $daysRemaining, protected string $expiryDate) {}

    public function via($notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toDatabase($notifiable): array
    {
        return [
            'type' => 'license_expiry_reminder',
            'title' => 'License Expiring Soon',
            'message' => "Your software license expires in {$this->daysRemaining} day(s) ({$this->expiryDate}). Please renew to avoid service interruption.",
        ];
    }

    public function toMail($notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("License expires in {$this->daysRemaining} day(s)")
            ->greeting("Hello {$notifiable->name},")
            ->line("Your software license is set to expire on {$this->expiryDate} — that's {$this->daysRemaining} day(s) from now.")
            ->line('Please contact your software provider to renew before it enters Grace Period / Restricted Mode.');
    }
}
