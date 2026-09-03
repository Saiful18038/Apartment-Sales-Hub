<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Payment;
use App\Models\Sale;
use App\Services\LicenseService;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function __construct(protected LicenseService $license) {}

    public function index(Request $request)
    {
        $query = Payment::with(['sale.flat.project', 'sale.customer', 'recordedBy']);
        if ($request->user()->isEmployee()) {
            $query->whereHas('sale', fn ($q) => $q->where('employee_id', $request->user()->id));
        }
        return $query->latest()->get();
    }

    public function store(Request $request)
    {
        $this->license->guard(); // financial write — per-action re-check

        $data = $request->validate([
            'sale_id' => 'required|exists:sales,id',
            'amount' => 'required|numeric|min:0.01',
            'date' => 'required|date',
            'method' => 'required|string|max:100',
        ]);

        $sale = Sale::findOrFail($data['sale_id']);
        if ($sale->status !== 'confirmed') {
            return response()->json(['message' => 'Sale is not confirmed yet.'], 422);
        }
        if ($data['amount'] > $sale->dueAmount()) {
            return response()->json(['message' => 'Payment exceeds due amount.'], 422);
        }

        $payment = Payment::create([...$data, 'recorded_by' => $request->user()->id]);

        ActivityLog::record($request->user(), 'Payment Recorded', "{$sale->flat->flat_no} — {$data['amount']} ({$data['method']})");
        return response()->json($payment, 201);
    }

    /**
     * Correcting an already-recorded installment (a typo'd amount/date/
     * method) — owner/admin only (see routes/api.php). The due-amount guard
     * excludes this payment's own current amount from the "already paid"
     * total, otherwise editing a payment would always appear to exceed the
     * due amount by its own value.
     */
    public function update(Request $request, Payment $payment)
    {
        $this->license->guard();

        $data = $request->validate([
            'amount' => 'required|numeric|min:0.01',
            'date' => 'required|date',
            'method' => 'required|string|max:100',
        ]);

        $sale = $payment->sale;
        $paidByOthers = (float) $sale->payments()->where('id', '!=', $payment->id)->sum('amount');
        if ($data['amount'] > (float) $sale->sale_price - $paidByOthers) {
            return response()->json(['message' => 'Amount exceeds due amount.'], 422);
        }

        $payment->update($data);
        ActivityLog::record($request->user(), 'Payment Updated', "{$sale->flat->flat_no} — {$data['amount']} ({$data['method']})");
        return response()->json($payment->fresh());
    }

    /** Removing a mistaken entry entirely — owner/admin only. */
    public function destroy(Request $request, Payment $payment)
    {
        $sale = $payment->sale;
        $details = "{$sale->flat->flat_no} — {$payment->amount} ({$payment->method})";
        $payment->delete();
        ActivityLog::record($request->user(), 'Payment Deleted', $details);
        return response()->json(['message' => 'Deleted']);
    }
}
