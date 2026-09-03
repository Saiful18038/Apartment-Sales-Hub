<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Sale;
use App\Models\Team;
use Illuminate\Support\Collection;

class ReportController extends Controller
{
    /**
     * Owner's request: a per-Team performance summary — Total Apt (units
     * confirmed-sold), Total sft, Total Revenue, Total Booking (bookings
     * ever made), Total Cancelled Apt (bookings that fell through), one row
     * per team — plus, per team, the same breakdown for each individual
     * member, so clicking a team name on the Reports page can show
     * "Individual Team Performance" (who on the team sold/booked what)
     * without a second request. `members()` already includes the team's
     * leader (their own team_id points at their own team — see
     * TeamController), so a single "employee is one of this team's
     * members" query covers everyone who sold or booked under that team,
     * leader included.
     */
    public function teamSummary()
    {
        $teams = Team::with('members')->get();

        $rows = $teams->map(function (Team $team) {
            $members = $team->members;

            $memberRows = $members->map(function ($member) {
                return array_merge([
                    'id' => $member->id,
                    'name' => $member->name,
                    'role' => $member->role,
                    'designation' => $member->designation,
                    'employee_code' => $member->employee_code,
                ], $this->statsFor(collect([$member->id])));
            })->values();

            return array_merge([
                'team' => $team->name,
                'leader' => $team->leader?->name,
                'leader_id' => $team->leader_id,
                'members' => $memberRows,
                'remarks' => null,
            ], $this->statsFor($members->pluck('id')));
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

    /** Total Apt/sft/Revenue/Booking/Cancelled Apt for a set of employee ids — shared by the team-level and per-member rows above. */
    private function statsFor(Collection $employeeIds): array
    {
        $confirmedSales = Sale::whereIn('employee_id', $employeeIds)
            ->where('status', 'confirmed')
            ->with('flat')
            ->get();

        $totalBooking = Booking::whereIn('employee_id', $employeeIds)->count();
        $cancelledApt = Booking::whereIn('employee_id', $employeeIds)->where('status', 'cancelled')->count();

        return [
            'total_apt' => $confirmedSales->count(),
            'total_sft' => (float) $confirmedSales->sum(fn ($s) => (float) ($s->flat->size_sft ?? 0)),
            'total_revenue' => (float) $confirmedSales->sum('sale_price'),
            'total_booking' => $totalBooking,
            'total_cancelled_apt' => $cancelledApt,
        ];
    }
}
