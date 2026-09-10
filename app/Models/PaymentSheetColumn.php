<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One user-defined column on a single sale's Payments "Excel Sheet".
 * See the create_payment_sheet_columns_table migration.
 */
class PaymentSheetColumn extends Model
{
    protected $fillable = ['sale_id', 'name', 'sort'];

    public function sale() { return $this->belongsTo(Sale::class); }
}
