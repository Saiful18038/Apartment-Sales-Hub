<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Booking extends Model
{
    protected $fillable = ['flat_id', 'customer_id', 'employee_id', 'amount', 'sale_type', 'date', 'status'];

    // paid_amount/is_complete ride along on every JSON response (index,
    // store, addPayment) without every call site remembering to eager-load
    // and sum `payments` itself.
    protected $appends = ['paid_amount', 'is_complete'];

    public function flat()     { return $this->belongsTo(Flat::class); }
    public function customer() { return $this->belongsTo(Customer::class); }
    public function employee() { return $this->belongsTo(User::class, 'employee_id'); }
    public function documents() { return $this->morphMany(Document::class, 'documentable'); }
    public function payments() { return $this->hasMany(BookingPayment::class); }

    /**
     * Owner's request: "amount" is the fixed target Booking Money agreed
     * up front (settable only at creation — the form calls it "(Fix
     * Amount)"); it can be paid off in one or several installments
     * (BookingPayment rows), each auto-timestamped. This is the running
     * total actually received so far, not the target itself.
     */
    public function getPaidAmountAttribute(): float
    {
        return (float) $this->payments()->sum('amount');
    }

    /** True once installments reach the fixed target — triggers the
     *  "Booking money complete!" message client-side. */
    public function getIsCompleteAttribute(): bool
    {
        return $this->paid_amount >= (float) $this->amount;
    }

    /**
     * Roadmap Phase 11 — Employee Privacy, extended for the Team hierarchy
     * (matches Sale::scopeVisibleTo/Customer::scopeVisibleTo): a Team Leader
     * only sees their own team's bookings.
     */
    public function scopeVisibleTo($query, User $user)
    {
        if ($user->isEmployee()) {
            return $query->where('employee_id', $user->id);
        }
        if ($user->isTeamLeader()) {
            return $query->whereHas('employee', fn ($q) => $q->where('team_id', $user->team_id));
        }
        return $query;
    }
}
