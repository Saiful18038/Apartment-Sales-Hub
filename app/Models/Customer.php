<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Customer extends Model
{
    protected $fillable = [
        'name', 'phone', 'email', 'nid', 'reference_source', 'interested_project_id', 'interested_flat_id',
        'assigned_employee_id', 'status', 'notes', 'follow_up_date',
    ];

    protected $casts = ['follow_up_date' => 'date'];

    public function interestedProject()  { return $this->belongsTo(Project::class, 'interested_project_id'); }
    public function interestedFlat()     { return $this->belongsTo(Flat::class, 'interested_flat_id'); }
    public function assignedEmployee()   { return $this->belongsTo(User::class, 'assigned_employee_id'); }
    public function bookings()           { return $this->hasMany(Booking::class); }
    public function sales()              { return $this->hasMany(Sale::class); }
    public function documents()          { return $this->morphMany(Document::class, 'documentable'); }

    /**
     * Roadmap Phase 11 — Employee Privacy: scope a query to what this user
     * may see. A Team Leader sees their own team's customers only (matches
     * Sale::scopeVisibleTo's Team hierarchy extension).
     */
    public function scopeVisibleTo($query, User $user)
    {
        if ($user->isEmployee()) {
            return $query->where('assigned_employee_id', $user->id);
        }
        if ($user->isTeamLeader()) {
            return $query->whereHas('assignedEmployee', fn ($q) => $q->where('team_id', $user->team_id));
        }
        return $query;
    }
}
