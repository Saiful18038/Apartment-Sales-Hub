<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Payment;
use App\Models\PaymentSheetColumn;
use App\Models\Sale;
use App\Services\LicenseService;
use Illuminate\Http\Request;

/**
 * Owner/admin CRUD for the user-defined columns on one sale's Payments
 * "Excel Sheet" (see PaymentSheetColumn). The columns themselves are read
 * back with the sale (SaleController::index eager-loads `sheetColumns`);
 * the per-installment values live on the payment rows (PaymentController).
 */
class PaymentSheetColumnController extends Controller
{
    public function __construct(protected LicenseService $license) {}

    public function store(Request $request, Sale $sale)
    {
        $this->license->guard();
        $data = $request->validate(['name' => 'required|string|max:100']);

        $column = $sale->sheetColumns()->create([
            'name' => $data['name'],
            'sort' => (int) $sale->sheetColumns()->max('sort') + 1,
        ]);

        ActivityLog::record($request->user(), 'Sheet Column Added', "{$sale->flat->flat_no} — {$data['name']}");
        return response()->json($column, 201);
    }

    public function update(Request $request, PaymentSheetColumn $sheetColumn)
    {
        $this->license->guard();
        $data = $request->validate(['name' => 'required|string|max:100']);

        $sheetColumn->update($data);
        ActivityLog::record($request->user(), 'Sheet Column Renamed', "{$sheetColumn->sale->flat->flat_no} — {$data['name']}");
        return response()->json($sheetColumn->fresh());
    }

    public function destroy(Request $request, PaymentSheetColumn $sheetColumn)
    {
        $this->license->guard();

        $saleId = $sheetColumn->sale_id;
        $flatNo = $sheetColumn->sale->flat->flat_no;
        $name = $sheetColumn->name;
        $key = (string) $sheetColumn->id;
        $sheetColumn->delete();

        // Prune this column's now-orphaned values from every payment on the sale.
        Payment::where('sale_id', $saleId)->whereNotNull('custom')->get()->each(function (Payment $p) use ($key) {
            $custom = $p->custom;
            if (is_array($custom) && array_key_exists($key, $custom)) {
                unset($custom[$key]);
                $p->update(['custom' => $custom ?: null]);
            }
        });

        ActivityLog::record($request->user(), 'Sheet Column Deleted', "{$flatNo} — {$name}");
        return response()->json(['message' => 'Deleted']);
    }
}
