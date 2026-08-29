<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Flat extends Model
{
    protected $fillable = [
        'project_id', 'floor', 'flat_no', 'size_sft', 'price_per_sft',
        'parking_charge', 'parking_count', 'utility_charge', 'facing',
        'bedroom', 'bathroom', 'balcony', 'status_code', 'notes',
    ];

    public function project() { return $this->belongsTo(Project::class); }
    public function status()  { return $this->belongsTo(AssetStatus::class, 'status_code', 'code'); }
    public function bookings(){ return $this->hasMany(Booking::class); }
    public function sales()   { return $this->hasMany(Sale::class); }

    public function confirmedSale()
    {
        return $this->hasOne(Sale::class)->where('status', 'confirmed');
    }

    /**
     * Roadmap Phase 5 — Price Formula (single source of truth).
     * Sub-Total = (Price/sft × Size) + (Parking Charge × Parking Count) + Utility Charge
     */
    public function calcSubTotal(): float
    {
        $basic = (float) $this->price_per_sft * (float) $this->size_sft;
        $parking = (float) $this->parking_charge * (int) $this->parking_count;
        return $basic + $parking + (float) $this->utility_charge;
    }

    /** Roadmap Reports — First / Middle / Top Floor classification. */
    public function floorBand(): string
    {
        if ($this->floor == 1) return 'First Floor';
        if ($this->project && $this->floor == $this->project->total_floors) return 'Top Floor';
        return 'Middle';
    }
}
