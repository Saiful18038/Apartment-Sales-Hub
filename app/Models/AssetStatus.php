<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Database-driven colour status lookup (Roadmap Phase 6).
 * Primary key is the string code (AVAILABLE, LAND_OWNER, SOLD_CR, ...)
 * so both API and frontend can key off the same values.
 */
class AssetStatus extends Model
{
    protected $primaryKey = 'code';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = ['code', 'label', 'fill_color', 'border_color', 'text_color', 'is_sellable', 'active'];

    protected $casts = [
        'is_sellable' => 'boolean',
        'active' => 'boolean',
    ];
}
