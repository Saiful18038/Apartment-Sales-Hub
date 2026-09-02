<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One installment toward a Booking's fixed target amount (Booking::amount).
 * Mirrors Payment (against a Sale) but for the booking stage, before a
 * formal Sale exists — see BookingController::addPayment().
 */
class BookingPayment extends Model
{
    protected $fillable = ['booking_id', 'amount', 'paid_at', 'recorded_by'];

    protected $casts = ['paid_at' => 'datetime'];

    public function booking()    { return $this->belongsTo(Booking::class); }
    public function recordedBy() { return $this->belongsTo(User::class, 'recorded_by'); }
}
