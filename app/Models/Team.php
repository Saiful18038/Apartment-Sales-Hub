<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Team extends Model
{
    protected $fillable = ['name', 'leader_id'];

    public function leader()  { return $this->belongsTo(User::class, 'leader_id'); }
    public function members() { return $this->hasMany(User::class, 'team_id'); }
    public function tasks()   { return $this->hasMany(Task::class); }
}
