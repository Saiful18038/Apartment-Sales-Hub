<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Sale;
use App\Models\Team;

class ReportController extends Controller
{
    /**
     * Owner's request: a per-Team performance summary — Total Apt (units
     * confirmed-sold), Total sft, Total Revenue, Total Booking (bookings
     * ever made), Total Cancelled Apt (bookings that fell through), one row
     * per team. `members()` already includes the team's leader (their own
     * team_id points at their own team — see TeamController), so a single
     * "employee is one of this team's members" query covers everyone who
     * sold or booked under that team, leader included.
     */
    public function teamSummary()
    {
        $teams = Team::with('members:id,team_id')->get();

        $rows = $teams->map(function (Team $team) {
            $memberIds = $team->members->pluck('id');

            $confirmedSales = Sale::whereIn('employee_id', $memberIds)
                ->where('status', 'confirmed')
                ->with('flat')
                ->get();

            $totalBooking = Booking::whereIn('employee_id', $memberIds)->count();
            $cancelledApt = Booking::whereIn('employee_id', $memberIds)->where('status', 'cancelled')->count();

            return [
                'team' => $team->name,
                'leader' => $team->leader?->name,
                'total_apt' => $confirmedSales->count(),
                'total_sft' => (float) $confirmedSales->sum(fn ($s) => (float) ($s->flat->size_sft ?? 0)),
                'total_revenue' => (float) $confirmedSales->sum('sale_price'),
                'total_booking' => $totalBooking,
                'total_cancelled_apt' => $cancelledApt,
                'remarks' => null,
            ];
        });

        $grand = [
            'total_apt' => $rows->sum('total_apt'),
            'total_sft' => $rows->sum('total_sft'),
            'total_revenue' => $rows->sum('total_revenue'),
            'total_booking' => $rows->sum('total_booking'),
            'total_cancelled_apt' => $rows->sum('total_cancelled_apt'),
        ];

        return response()->json(['teams' => $rows->values(), 'grand_total' => $grand]);
    }
}
