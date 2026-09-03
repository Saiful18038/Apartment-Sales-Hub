<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Booking;
use App\Models\BookingPayment;
use App\Models\Flat;
use App\Models\Payment;
use App\Models\Sale;
use App\Models\User;
use App\Notifications\BookingConfirmed;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BookingController extends Controller
{
    public function index(Request $request)
    {
        return Booking::visibleTo($request->user())
            ->with(['flat', 'customer', 'employee', 'payments'])
            ->latest()
            ->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'flat_id' => 'required|exists:flats,id',
            'customer_id' => 'required|exists:customers,id',
            'amount' => 'required|numeric|min:0.01',
            'sale_type' => 'required|in:SOLD_CR,SOLD_OS_SS',
            'date' => 'required|date',
        ]);

        $flat = Flat::findOrFail($data['flat_id']);
        if ($flat->status_code !== 'AVAILABLE') {
            return response()->json(['message' => 'Flat is not available for booking.'], 422);
        }

        $booking = DB::transaction(function () use ($data, $flat, $request) {
            $booking = Booking::create([
                ...$data,
                'employee_id' => $request->user()->id,
                'status' => 'active',
            ]);
            // Owner's request: the flat reads as the specific Sold (CR)/
            // Sold (OS/SS) type immediately — not a generic "Sold Out" —
            // the moment booking money is taken. FlatResource falls back to
            // this Booking (via Flat::activeBooking()) for detail/privacy
            // purposes until it's converted into a confirmedSale.
            $flat->update(['status_code' => $booking->sale_type]);
            return $booking;
        });

        ActivityLog::record($request->user(), 'Booking Created', "{$flat->flat_no} booked");

        // Roadmap Phase 19 — Booking Confirmation notification.
        $managers = User::whereIn('role', ['owner', 'admin'])->where('is_active', true)->get();
        $recipients = $managers->concat([$request->user()])->unique('id');
        foreach ($recipients as $recipient) {
            $recipient->notify(new BookingConfirmed($booking));
        }

        return response()->json($booking->load(['flat', 'customer']), 201);
    }

    /**
     * One installment toward the booking's fixed target (Booking::amount)
     * — "যত বার booking money দেবে, তত বার date & time generate হবে": each
     * call creates its own auto-timestamped row, however many times the
     * owner's spec allows (1, 2, 3...). Rejects anything that would push
     * the total past the agreed target, same guard PaymentController uses
     * against a Sale's due amount.
     */
    public function addPayment(Request $request, Booking $booking)
    {
        if ($booking->status !== 'active') {
            return response()->json(['message' => 'This booking is no longer active.'], 422);
        }
        if ($request->user()->isEmployee() && $booking->employee_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden — not your booking.'], 403);
        }

        $data = $request->validate(['amount' => 'required|numeric|min:0.01']);

        $remaining = (float) $booking->amount - $booking->paid_amount;
        if ($data['amount'] > $remaining) {
            return response()->json(['message' => 'Amount exceeds the remaining booking target.'], 422);
        }

        BookingPayment::create([
            'booking_id' => $booking->id,
            'amount' => $data['amount'],
            'paid_at' => now(),
            'recorded_by' => $request->user()->id,
        ]);

        ActivityLog::record($request->user(), 'Booking Payment Recorded', "{$booking->flat->flat_no} — {$data['amount']}");

        $booking->refresh();
        return response()->json([
            'booking' => $booking,
            // "Booking money complete! Payment process successful." fires
            // client-side off this flag the instant the target is reached.
            'completed' => $booking->is_complete,
        ]);
    }

    public function cancel(Request $request, Booking $booking)
    {
        // Per the owner's request: cancelling booking money is owner-only —
        // not even admin, and not the employee who took the booking.
        if (! $request->user()->isOwner()) {
            return response()->json(['message' => 'Only the owner can cancel a booking.'], 403);
        }
        DB::transaction(function () use ($booking) {
            $booking->update(['status' => 'cancelled']);
            $booking->flat()->update(['status_code' => 'AVAILABLE']);
        });
        ActivityLog::record($request->user(), 'Booking Cancelled', $booking->flat->flat_no);
        return response()->json($booking);
    }

    /**
     * Roadmap Phase 9 — Booking → Sale conversion.
     *
     * Bug fix: this used to always price the resulting Sale at the flat's
     * full listing total (Flat::calcSubTotal() with no override) — a
     * booking never captures a negotiated per-sft price the way a direct
     * Sale does (see SaleController::store), so every booking-originated
     * sale silently ignored any discount the owner actually gave the
     * customer, inflating "Total Sold Amount" everywhere that reads
     * Sale::sale_price. sold_price_per_sft is now accepted here too, at
     * the point of conversion, and drives sale_price exactly like a
     * direct Sale does — the owner's exact requirement.
     */
    public function convertToSale(Request $request, Booking $booking)
    {
        if ($request->user()->isEmployee() && $booking->employee_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden — not your booking.'], 403);
        }

        $data = $request->validate([
            'sold_price_per_sft' => 'nullable|numeric|min:0',
        ]);

        $sale = DB::transaction(function () use ($booking, $request, $data) {
            $isEmployee = $request->user()->isEmployee();
            $paidSoFar = $booking->paid_amount;
            $soldPricePerSft = $data['sold_price_per_sft'] ?? null;

            $sale = Sale::create([
                'flat_id' => $booking->flat_id,
                'customer_id' => $booking->customer_id,
                'employee_id' => $booking->employee_id,
                'sale_price' => $booking->flat->calcSubTotal($soldPricePerSft ? (float) $soldPricePerSft : null),
                'sold_price_per_sft' => $soldPricePerSft,
                'sale_type' => $booking->sale_type,
                'date' => now()->toDateString(),
                'status' => $isEmployee ? 'pending' : 'confirmed',
                'approved_by' => $isEmployee ? null : $request->user()->id,
            ]);

            // Booking money already collected carries over as a Payment
            // against the new Sale (regardless of pending/confirmed — an
            // employee's sale still awaiting approval already has real
            // money behind it) so the customer doesn't get asked to pay it
            // again, and the Sale's due amount already reflects it.
            if ($paidSoFar > 0) {
                Payment::create([
                    'sale_id' => $sale->id,
                    'amount' => $paidSoFar,
                    'date' => now()->toDateString(),
                    'method' => 'Booking Money',
                    'recorded_by' => $request->user()->id,
                ]);
            }

            $booking->update(['status' => 'converted']);
            if ($sale->status === 'confirmed') {
                $booking->flat()->update(['status_code' => $sale->sale_type]);
            }
            return $sale;
        });

        ActivityLog::record($request->user(), 'Booking Converted to Sale', $booking->flat->flat_no);
        return response()->json($sale, 201);
    }
}
