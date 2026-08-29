<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Customer extends Model
{
    protected $fillable = [
        'name', 'phone', 'email', 'nid', 'interested_project_id', 'interested_flat_id',
        'assigned_employee_id', 'status', 'notes', 'follow_up_date',
    ];

    protected $casts = ['follow_up_date' => 'date'];

    public function interestedProject()  { return $this->belongsTo(Project::class, 'interested_project_id'); }
    public function interestedFlat()     { return $this->belongsTo(Flat::class, 'interested_flat_id'); }
    public function assignedEmployee()   { return $this->belongsTo(User::class, 'assigned_employee_id'); }
    public function bookings()           { return $this->hasMany(Booking::class); }
    public function sales()              { return $this->hasMany(Sale::class); }
    public function documents()          { return $this->morphMany(Document::class, 'documentable'); }

    /** Roadmap Phase 11 — Employee Privacy: scope a query to what this user may see. */
    public function scopeVisibleTo($query, User $user)
    {
        if ($user->isEmployee()) {
            return $query->where('assigned_employee_id', $user->id);
        }
        return $query;
    }
}
