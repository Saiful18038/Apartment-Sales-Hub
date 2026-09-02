<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Flat;
use App\Models\Sale;
use App\Services\LicenseService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SaleController extends Controller
{
    public function __construct(protected LicenseService $license) {}

    public function index(Request $request)
    {
        // Roadmap Phase 11 — query-level scoping, an employee's fetch never
        // even receives another employee's rows over the wire.
        return Sale::visibleTo($request->user())
            ->with(['flat', 'customer', 'employee'])
            ->latest()
            ->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'flat_id' => 'required|exists:flats,id',
            'customer_id' => 'required|exists:customers,id',
            'sale_type' => 'required|in:SOLD_CR,SOLD_OS_SS',
            'sale_price' => 'required|numeric|min:0',
            'sold_price_per_sft' => 'nullable|numeric|min:0',
            'date' => 'required|date',
        ]);

        $flat = Flat::findOrFail($data['flat_id']);
        if (!in_array($flat->status_code, ['AVAILABLE', 'ASSET_BOOKED'], true)) {
            return response()->json(['message' => 'Flat is not sellable in its current status.'], 422);
        }

        $isEmployee = $request->user()->isEmployee();

        $sale = DB::transaction(function () use ($data, $flat, $request, $isEmployee) {
            $sale = Sale::create([
                ...$data,
                'employee_id' => $request->user()->id,
                // Roadmap Phase 10 — Approval workflow: employee sales need
                // Admin/Owner sign-off before the flat actually flips to Sold.
                'status' => $isEmployee ? 'pending' : 'confirmed',
                'approved_by' => $isEmployee ? null : $request->user()->id,
            ]);
            $flat->update(['status_code' => $sale->status === 'confirmed' ? $sale->sale_type : 'ASSET_BOOKED']);
            return $sale;
        });

        ActivityLog::record($request->user(), 'Sale Created', "{$flat->flat_no} — " . ($sale->status === 'pending' ? 'pending approval' : 'confirmed'));
        return response()->json($sale, 201);
    }

    /** Admin/Owner only (see routes/api.php role middleware). */
    public function approve(Request $request, Sale $sale)
    {
        $this->license->guard(); // per-action re-check, mirrors guardAction() in the prototype

        if ($sale->status !== 'pending') {
            return response()->json(['message' => 'Sale is not pending.'], 422);
        }

        DB::transaction(function () use ($sale, $request) {
            $sale->update(['status' => 'confirmed', 'approved_by' => $request->user()->id]);
            $sale->flat()->update(['status_code' => $sale->sale_type]);
        });

        ActivityLog::record($request->user(), 'Sale Approved', "{$sale->flat->flat_no} → {$sale->sale_type}");
        return response()->json($sale);
    }

    public function reject(Request $request, Sale $sale)
    {
        $this->license->guard();

        if ($sale->status !== 'pending') {
            return response()->json(['message' => 'Sale is not pending.'], 422);
        }

        DB::transaction(function () use ($sale) {
            $sale->update(['status' => 'rejected']);
            $sale->flat()->update(['status_code' => 'AVAILABLE']);
        });

        ActivityLog::record($request->user(), 'Sale Rejected', $sale->flat->flat_no);
        return response()->json($sale);
    }
}
