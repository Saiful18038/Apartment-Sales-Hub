<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * The "Final Price & Payment Schedule" document for one sale — a header
 * snapshot, a price-calculation table (lines) and an instalment schedule
 * (installments). See the create_price_schedules_table migration.
 */
class PriceSchedule extends Model
{
    protected $fillable = [
        'sale_id', 'agreement_date', 'project_name', 'project_address',
        'apartment_type', 'apartment_facing', 'floor', 'size_sft', 'rate_per_sft',
        'terms', 'totals_overridden', 'created_by',
    ];

    protected $casts = [
        'agreement_date' => 'date',
        'size_sft' => 'decimal:2',
        'rate_per_sft' => 'decimal:2',
        'totals_overridden' => 'boolean',
    ];

    /** The default footer notes, lifted verbatim from the reference PDF. */
    public const DEFAULT_TERMS = "The Apartment will be handed over to the allottee after receiving of full payment.\n"
        . "Please note that apartments are sold on \"First Come First Served\" basis.\n"
        . "This Price is a special quotation and is valid only for the day of issue.";

    public function sale()
    {
        return $this->belongsTo(Sale::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function lines()
    {
        return $this->hasMany(PriceScheduleLine::class)->orderBy('sort');
    }

    public function installments()
    {
        return $this->hasMany(PaymentScheduleInstallment::class)->orderBy('sort');
    }

    /**
     * Recompute every is_computed line (subtotal / revised_subtotal / total)
     * and the Apartment-Value-style rows (rate_per_sft x size_sft) from the
     * item/rebate rows around them, in `sort` order, and persist the result.
     * Call after any change to the price lines.
     */
    public function recalculate(): void
    {
        $size = (float) $this->size_sft;

        $runningItems = 0.0;      // item amounts since the last (revised) subtotal
        $rebatesSinceSub = 0.0;   // rebate amounts since the last plain subtotal
        $lastSubtotal = null;     // most recent `subtotal` amount
        $lastRevised = null;      // most recent `revised_subtotal` amount

        foreach ($this->lines as $line) {
            switch ($line->line_type) {
                case 'item':
                    if ($line->rate_per_sft !== null && $size > 0) {
                        $line->amount = round((float) $line->rate_per_sft * $size, 2);
                    }
                    $runningItems += (float) $line->amount;
                    break;

                case 'rebate':
                    $rebatesSinceSub += (float) $line->amount;
                    break;

                case 'subtotal':
                    $line->amount = round($runningItems, 2);
                    $line->is_computed = true;
                    $lastSubtotal = (float) $line->amount;
                    $runningItems = 0.0;
                    $rebatesSinceSub = 0.0;
                    break;

                case 'revised_subtotal':
                    $base = $lastSubtotal ?? $runningItems;
                    $line->amount = round($base - $rebatesSinceSub, 2);
                    $line->is_computed = true;
                    $lastRevised = (float) $line->amount;
                    $runningItems = 0.0;
                    $rebatesSinceSub = 0.0;
                    break;

                case 'total':
                    $base = $lastRevised ?? $lastSubtotal ?? 0.0;
                    $line->amount = round($base + $runningItems, 2);
                    $line->is_computed = true;
                    $runningItems = 0.0;
                    break;
            }

            if ($line->isDirty()) {
                $line->save();
            }
        }
    }

    /** The payable "Total" — the last `total` line, or a best-effort sum. */
    public function grandTotal(): float
    {
        $total = $this->lines->where('line_type', 'total')->last();
        if ($total) {
            return (float) $total->amount;
        }

        $items = (float) $this->lines->where('line_type', 'item')->sum('amount');
        $rebates = (float) $this->lines->where('line_type', 'rebate')->sum('amount');

        return round($items - $rebates, 2);
    }

    public function installmentsTotal(): float
    {
        return round((float) $this->installments->sum('amount'), 2);
    }

    public function totalsMatch(): bool
    {
        return abs($this->grandTotal() - $this->installmentsTotal()) < 0.01;
    }
}
