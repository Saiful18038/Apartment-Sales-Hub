<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One row of the "Price" calculation table — see the
 * create_price_schedule_lines_table migration and PriceSchedule::recalculate().
 */
class PriceScheduleLine extends Model
{
    protected $fillable = [
        'price_schedule_id', 'sort', 'description', 'line_type', 'rate_per_sft', 'amount', 'is_computed',
    ];

    protected $casts = [
        'rate_per_sft' => 'decimal:2',
        'amount' => 'decimal:2',
        'is_computed' => 'boolean',
    ];

    public function priceSchedule()
    {
        return $this->belongsTo(PriceSchedule::class);
    }
}
