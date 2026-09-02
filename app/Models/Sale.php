<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Sale extends Model
{
    protected $fillable = [
        'flat_id', 'customer_id', 'employee_id', 'sale_price', 'sold_price_per_sft', 'sale_type',
        'date', 'status', 'approved_by',
    ];

    public function flat()      { return $this->belongsTo(Flat::class); }
    public function customer()  { return $this->belongsTo(Customer::class); }
    public function employee()  { return $this->belongsTo(User::class, 'employee_id'); }
    public function approver()  { return $this->belongsTo(User::class, 'approved_by'); }
    public function payments()  { return $this->hasMany(Payment::class); }
    public function documents() { return $this->morphMany(Document::class, 'documentable'); }

    public function paidAmount(): float
    {
        return (float) $this->payments()->sum('amount');
    }

    public function dueAmount(): float
    {
        return (float) $this->sale_price - $this->paidAmount();
    }

    /**
     * Roadmap Phase 11 — Employee Privacy (Row-Level Security), extended for
     * the Team hierarchy: a Team Leader only sees their own team's sales —
     * not another team leader's — same "never leaves the server" principle,
     * applied at the QUERY level.
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
