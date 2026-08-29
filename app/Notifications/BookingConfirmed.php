<?php

namespace App\Notifications;

use App\Models\Booking;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;

/**
 * Roadmap Phase 19 — Notification System: Booking Confirmation.
 * Fired from BookingController::store(). Channels are ['database', 'mail']
 * — database always works (no infra needed); mail is wired and ready, it
 * currently just writes to storage/logs/laravel.log because MAIL_MAILER=log
 * in .env — point MAIL_MAILER at a real SMTP driver and it starts sending
 * for real with no code change here.
 */
class BookingConfirmed extends Notification
{
    public function __construct(protected Booking $booking) {}

    public function via($notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toDatabase($notifiable): array
    {
        $this->booking->loadMissing(['flat', 'customer']);
        return [
            'type' => 'booking_confirmed',
            'title' => 'Booking Confirmed',
            'message' => "{$this->booking->flat->flat_no} booked for {$this->booking->customer->name}",
            'booking_id' => $this->booking->id,
        ];
    }

    public function toMail($notifiable): MailMessage
    {
        $this->booking->loadMissing(['flat', 'customer']);
        return (new MailMessage)
            ->subject('Booking Confirmed — ' . $this->booking->flat->flat_no)
            ->greeting("Hello {$notifiable->name},")
            ->line("A new booking has been confirmed for flat {$this->booking->flat->flat_no}.")
            ->line("Customer: {$this->booking->customer->name}")
            ->line('Booking Amount: ৳' . number_format((float) $this->booking->amount));
    }
}
