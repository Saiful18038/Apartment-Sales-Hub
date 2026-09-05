<?php

namespace App\Http\Resources;

use App\Models\Booking;
use App\Models\Sale;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Roadmap Phase 11 — Employee Privacy, enforced HERE at the server.
 * The React prototype only hid "Sold By" in the UI (anyone could still see
 * it via DevTools). This resource never puts the sale detail into the JSON
 * response at all unless the requester is allowed to see it — that's the
 * actual security boundary.
 *
 * Team hierarchy extension (owner's request): a Sold Out flat's details are
 * visible to Owner/Admin, to the specific employee who made the sale, and
 * to THAT employee's Team Leader — but not to any other Team Leader. See
 * canView() below; mirrors Sale::scopeVisibleTo's same rule for the Sales
 * list page.
 *
 * A flat's status_code goes to SOLD_CR/SOLD_OS_SS the moment booking money
 * is taken (BookingController::store), before any Sale exists — so the
 * detail block falls back to the active Booking when there's no
 * confirmedSale yet, showing the same shape of data (customer, employee,
 * team) plus the booking's target/paid/due figures in place of a sale
 * price. Once the booking converts (BookingController::convertToSale) the
 * Booking moves to 'converted' (no longer activeBooking) but an
 * employee-made Sale starts out 'pending' owner/admin approval, not
 * 'confirmed' yet — so there's a second fallback to Flat::pendingSale()
 * before finally showing nothing, otherwise a flat would read as "Sold"
 * with zero backing detail during that approval window (the same class of
 * bug fixed for orphaned SOLD_CR flats in an earlier pass).
 */
class FlatResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $data = [
            'id' => $this->id,
            'project_id' => $this->project_id,
            'floor' => $this->floor,
            'flat_no' => $this->flat_no,
            'size_sft' => $this->size_sft,
            'price_per_sft' => $this->price_per_sft,
            'parking_charge' => $this->parking_charge,
            'parking_count' => $this->parking_count,
            'parking_number' => $this->parking_number,
            'utility_charge' => $this->utility_charge,
            'reserve_fund' => $this->reserve_fund,
            'facing' => $this->facing,
            'bedroom' => $this->bedroom,
            'bathroom' => $this->bathroom,
            'balcony' => $this->balcony,
            'status_code' => $this->status_code,
            'notes' => $this->notes,
            'sub_total' => $this->calcSubTotal(),
        ];

        if (in_array($this->status_code, ['SOLD_CR', 'SOLD_OS_SS'], true)) {
            $sale = $this->confirmedSale ?? $this->pendingSale;
            $booking = $sale ? null : $this->activeBooking;
            $user = $request->user();

            if ($sale && self::canView($user, $sale->employee)) {
                $customer = $sale->customer;
                $leader = $sale->employee->team?->leader;

                $data['sale'] = [
                    'is_booking' => false,
                    'pending_approval' => $sale->status === 'pending',
                    'sold_by' => $sale->employee->name,
                    'employee_id' => $sale->employee_id,
                    'customer' => $customer->name,
                    // "Generate hoba" — there's no separate customer_code
                    // column; the auto-increment id already is the
                    // auto-generated identity, just formatted for display.
                    'customer_id' => self::customerId($customer->id),
                    'client_reference' => $customer->reference_source,
                    'date' => $sale->date,
                    'price_per_sft' => $this->price_per_sft,
                    'sold_price_per_sft' => $sale->sold_price_per_sft,
                    'sale_price' => $sale->sale_price,
                    'team_leader' => $leader?->name,
                    'team_member' => $sale->employee->name,
                ] + self::bookingFigures(null);
            } elseif ($booking && self::canView($user, $booking->employee)) {
                $customer = $booking->customer;
                $leader = $booking->employee->team?->leader;

                $data['sale'] = [
                    'is_booking' => true,
                    'pending_approval' => false,
                    'sold_by' => $booking->employee->name,
                    'employee_id' => $booking->employee_id,
                    'customer' => $customer->name,
                    'customer_id' => self::customerId($customer->id),
                    'client_reference' => $customer->reference_source,
                    'date' => $booking->date,
                    'price_per_sft' => $this->price_per_sft,
                    'sold_price_per_sft' => null, // not negotiated yet — still just booked
                    'sale_price' => $this->calcSubTotal(), // Total Sold Amount reference figure
                    'team_leader' => $leader?->name,
                    'team_member' => $booking->employee->name,
                ] + self::bookingFigures($booking);
            } elseif (!$sale && !$booking) {
                // Legacy data: the flat's status_code says Sold but no Sale
                // or Booking row backs it (from before changeStatus() below
                // blocked setting status straight to Sold). Not a privacy
                // case — surface that distinction so Owner/Admin aren't
                // told the detail is merely hidden from them when there's
                // actually nothing on record to show anyone.
                $data['sale'] = null;
                $data['sale_orphaned'] = true;
            } else {
                $data['sale'] = null; // deliberately withheld, not just hidden client-side
            }
        }

        return $data;
    }

    private static function customerId(int $id): string
    {
        return 'CUST-' . str_pad((string) $id, 5, '0', STR_PAD_LEFT);
    }

    /** Booking-specific figures the Sold flat detail needs — null-shaped when there's no booking. */
    private static function bookingFigures(?Booking $booking): array
    {
        if (!$booking) {
            return ['booking_target_amount' => null, 'booking_paid_amount' => null, 'booking_is_complete' => null];
        }
        return [
            'booking_target_amount' => (float) $booking->amount,
            'booking_paid_amount' => $booking->paid_amount,
            'booking_is_complete' => $booking->is_complete,
        ];
    }

    /**
     * Owner: "Sold out flat details — only Owner, Admin, and the Team
     * Leader whose member sold it can see it; no other Team Leader can."
     * Same rule for a Sale's employee or a Booking's employee.
     */
    private static function canView(?User $user, User $employee): bool
    {
        if (!$user) {
            return false;
        }
        if ($user->canManage()) {
            return true;
        }
        if ($user->isTeamLeader()) {
            return $employee->team_id !== null && $employee->team_id === $user->team_id;
        }
        return $employee->id === $user->id;
    }
}
