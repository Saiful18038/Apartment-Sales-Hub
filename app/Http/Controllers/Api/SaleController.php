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
            ->with(['flat.project', 'customer', 'employee'])
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

        // If a negotiated per-sft price was given, it — not whatever the
        // client happened to send as sale_price — is the source of truth
        // for the total, so a discount always actually reduces what the
        // customer owes instead of just being a side-by-side display figure.
        if (!empty($data['sold_price_per_sft'])) {
            $data['sale_price'] = $flat->calcSubTotal((float) $data['sold_price_per_sft']);
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

    /**
     * Admin/Owner only (see routes/api.php role middleware) — corrects a
     * sale after the fact (e.g. the negotiated per-sft price was wrong).
     * Same rule as store(): sold_price_per_sft, when present, drives
     * sale_price — you can't edit one without the other going stale.
     */
    public function update(Request $request, Sale $sale)
    {
        $data = $request->validate([
            'sale_price' => 'sometimes|numeric|min:0',
            'sold_price_per_sft' => 'nullable|numeric|min:0',
            'date' => 'sometimes|date',
        ]);

        if (array_key_exists('sold_price_per_sft', $data) && $data['sold_price_per_sft'] !== null) {
            $data['sale_price'] = $sale->flat->calcSubTotal((float) $data['sold_price_per_sft']);
        }

        $sale->update($data);
        ActivityLog::record($request->user(), 'Sale Updated', $sale->flat->flat_no);

        return response()->json($sale->fresh());
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
