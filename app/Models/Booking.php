<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Booking extends Model
{
    protected $fillable = ['flat_id', 'customer_id', 'employee_id', 'amount', 'date', 'status'];

    public function flat()     { return $this->belongsTo(Flat::class); }
    public function customer() { return $this->belongsTo(Customer::class); }
    public function employee() { return $this->belongsTo(User::class, 'employee_id'); }
    public function documents() { return $this->morphMany(Document::class, 'documentable'); }

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
