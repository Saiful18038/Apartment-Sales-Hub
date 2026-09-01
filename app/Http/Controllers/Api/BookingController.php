<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Booking;
use App\Models\Flat;
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
            ->with(['flat', 'customer', 'employee'])
            ->latest()
            ->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'flat_id' => 'required|exists:flats,id',
            'customer_id' => 'required|exists:customers,id',
            'amount' => 'required|numeric|min:0',
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
            $flat->update(['status_code' => 'ASSET_BOOKED']);
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

    /** Roadmap Phase 9 — Booking → Sale conversion. */
    public function convertToSale(Request $request, Booking $booking)
    {
        if ($request->user()->isEmployee() && $booking->employee_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden — not your booking.'], 403);
        }

        $sale = DB::transaction(function () use ($booking, $request) {
            $isEmployee = $request->user()->isEmployee();
            $sale = Sale::create([
                'flat_id' => $booking->flat_id,
                'customer_id' => $booking->customer_id,
                'employee_id' => $booking->employee_id,
                'sale_price' => $booking->flat->calcSubTotal(),
                'sale_type' => 'SOLD_CR',
                'date' => now()->toDateString(),
                'status' => $isEmployee ? 'pending' : 'confirmed',
                'approved_by' => $isEmployee ? null : $request->user()->id,
            ]);
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
