<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Project extends Model
{
    protected $fillable = [
        'zone_id', 'type', 'name', 'code', 'address', 'road_facing',
        'land_katha', 'total_floors', 'status', 'handover',
    ];

    public function zone()  { return $this->belongsTo(Zone::class); }
    public function flats() { return $this->hasMany(Flat::class); }
    public function documents() { return $this->morphMany(Document::class, 'documentable'); }

    /** Roadmap Phase 4 — Project Dashboard: live counts by status. */
    public function statusCounts(): array
    {
        return $this->flats()
            ->selectRaw('status_code, count(*) as total')
            ->groupBy('status_code')
            ->pluck('total', 'status_code')
            ->toArray();
    }
}
