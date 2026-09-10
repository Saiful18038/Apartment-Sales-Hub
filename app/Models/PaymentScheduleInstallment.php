<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One planned instalment on a price schedule. `is_overdue` is derived from
 * the due date — never stored — so the UI can show a third "Overdue" state
 * on top of the pending/paid column.
 */
class PaymentScheduleInstallment extends Model
{
    protected $fillable = [
        'price_schedule_id', 'sort', 'milestone', 'term', 'due_date',
        'amount', 'status', 'paid_on', 'payment_id', 'note',
    ];

    protected $casts = [
        'due_date' => 'date',
        'paid_on' => 'date',
        'amount' => 'decimal:2',
    ];

    protected $appends = ['is_overdue'];

    public function priceSchedule()
    {
        return $this->belongsTo(PriceSchedule::class);
    }

    public function payment()
    {
        return $this->belongsTo(Payment::class);
    }

    public function getIsOverdueAttribute(): bool
    {
        return $this->status !== 'paid'
            && $this->due_date !== null
            && $this->due_date->isPast()
            && ! $this->due_date->isToday();
    }
}
