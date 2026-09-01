<?php

namespace App\Notifications;

use App\Models\Flat;
use Illuminate\Notifications\Notification;

/**
 * Fired from FlatController::exchangeParking(). In-app only ('database'
 * channel) — no SMS/mail gateway is configured for this yet; wiring one in
 * later just means adding 'mail'/a real SMS channel to via() and a
 * toMail()/toSms() method here, nothing else changes.
 */
class ParkingExchanged extends Notification
{
    public function __construct(
        protected Flat $flatA,
        protected Flat $flatB,
        protected string $oldNumberA,
        protected string $oldNumberB,
    ) {}

    public function via($notifiable): array
    {
        return ['database'];
    }

    public function toDatabase($notifiable): array
    {
        $newA = $this->oldNumberB;
        $newB = $this->oldNumberA;

        return [
            'type' => 'parking_exchanged',
            'title' => 'Parking Number Exchanged',
            'message' => "{$this->flatA->flat_no}: {$this->oldNumberA} → {$newA}  ⇄  {$this->flatB->flat_no}: {$this->oldNumberB} → {$newB}",
            'flat_a_id' => $this->flatA->id,
            'flat_b_id' => $this->flatB->id,
        ];
    }
}
