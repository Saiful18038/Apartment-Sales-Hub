<?php

namespace App\Exports;

use App\Models\PriceSchedule;
use App\Models\Sale;
use Maatwebsite\Excel\Concerns\FromView;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Illuminate\Contracts\View\View;

/**
 * The "Final Price & Payment Schedule" as a formatted .xlsx — renders the
 * same two tables as the PDF from a Blade HTML table so amounts stay
 * numeric in Excel. See resources/views/excel/price-schedule.blade.php.
 */
class PriceScheduleExport implements FromView, ShouldAutoSize
{
    public function __construct(
        protected PriceSchedule $schedule,
        protected Sale $sale,
    ) {}

    public function view(): View
    {
        return view('excel.price-schedule', [
            'schedule' => $this->schedule,
            'sale' => $this->sale,
        ]);
    }
}
