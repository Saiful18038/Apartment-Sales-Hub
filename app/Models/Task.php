<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Team hierarchy / task management (owner's request): a task always belongs
 * to exactly one Team, and is worked by one assignee. Visibility/edit rules
 * live in TaskController, not here — see the inline checks there for why
 * (owner/admin: everything; a team's leader: their team; a team member:
 * read their team's tasks, but only change status on their own).
 */
class Task extends Model
{
    protected $fillable = [
        'team_id', 'assigned_to', 'assigned_by', 'title', 'description',
        'status', 'priority', 'due_date',
    ];

    public function team()       { return $this->belongsTo(Team::class); }
    public function assignee()   { return $this->belongsTo(User::class, 'assigned_to'); }
    public function assignedBy() { return $this->belongsTo(User::class, 'assigned_by'); }
}
