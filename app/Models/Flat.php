<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Flat extends Model
{
    protected $fillable = [
        'project_id', 'floor', 'flat_no', 'size_sft', 'price_per_sft',
        'parking_charge', 'parking_count', 'parking_number', 'utility_charge', 'reserve_fund', 'facing',
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
     * The Booking (if any) currently backing a SOLD_CR/SOLD_OS_SS
     * status_code before it's converted into a confirmedSale — see
     * FlatResource, which falls back to this when there's no Sale yet.
     */
    public function activeBooking()
    {
        return $this->hasOne(Booking::class)->where('status', 'active');
    }

    /**
     * An employee-made Sale (via BookingController::convertToSale or
     * SaleController::store) still awaiting owner/admin approval. The flat's
     * status_code is already SOLD_CR/SOLD_OS_SS at this point (set the
     * moment booking money was taken) but the Booking has moved to
     * 'converted' — no longer activeBooking() — and the Sale isn't
     * 'confirmed' yet, so without this fallback FlatResource would show
     * "Sold" with no backing detail at all, even to Owner/Admin. See
     * FlatResource, which checks this last, after confirmedSale/activeBooking.
     */
    public function pendingSale()
    {
        return $this->hasOne(Sale::class)->where('status', 'pending');
    }

    /**
     * Roadmap Phase 5 — Price Formula (single source of truth).
     * Sub-Total = (Price/sft × Size) + (Parking Charge × Parking Count) + Utility Charge + Reserve Fund
     *
     * $pricePerSft overrides the flat's listing price_per_sft — pass the
     * sale's negotiated sold_price_per_sft here when computing what a
     * customer actually owes (see SaleController::store/update), so a
     * discount off the listing price actually reduces the total instead of
     * only being shown as a side-by-side informational figure.
     */
    public function calcSubTotal(?float $pricePerSft = null): float
    {
        $rate = $pricePerSft ?? (float) $this->price_per_sft;
        $basic = $rate * (float) $this->size_sft;
        $parking = (float) $this->parking_charge * (int) $this->parking_count;
        return $basic + $parking + (float) $this->utility_charge + (float) $this->reserve_fund;
    }

    /** Roadmap Reports — First / Middle / Top Floor classification. */
    public function floorBand(): string
    {
        if ($this->floor == 1) return 'First Floor';
        if ($this->project && $this->floor == $this->project->total_floors) return 'Top Floor';
        return 'Middle';
    }
}
