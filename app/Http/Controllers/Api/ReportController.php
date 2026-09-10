<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Sale;
use App\Models\Team;
use Illuminate\Http\Request;
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
     *
     * Privacy: only Owner/Admin see every team. A Team Leader or Employee
     * only ever sees their own team's row — same "your own team's numbers,
     * nobody else's" boundary already enforced elsewhere (Sale/Booking
     * visibleTo(), FlatResource::canView).
     */
    public function teamSummary(Request $request)
    {
        $user = $request->user();

        // Owner's request: the same summary sliced by period — a year
        // (2026, 2027, …) and, optionally, one month within it. Sale and
        // Booking rows are filtered on their own `date` column; `month` of
        // 0 (or absent) means the whole year, and `year` of 0 (or absent)
        // means all time.
        $year = (int) $request->query('year');
        $month = (int) $request->query('month');
        if ($month < 1 || $month > 12) {
            $month = 0;
        }

        $teamsQuery = Team::with('members');
        if (!$user->canManage()) {
            $teamsQuery->where('id', $user->team_id);
        }
        $teams = $teamsQuery->get();

        $rows = $teams->map(function (Team $team) use ($year, $month) {
            $members = $team->members;

            $memberRows = $members->map(function ($member) use ($year, $month) {
                return array_merge([
                    'id' => $member->id,
                    'name' => $member->name,
                    'role' => $member->role,
                    'designation' => $member->designation,
                    'employee_code' => $member->employee_code,
                ], $this->statsFor(collect([$member->id]), $year, $month));
            })->values();

            return array_merge([
                'id' => $team->id,
                'team' => $team->name,
                'leader' => $team->leader?->name,
                'leader_id' => $team->leader_id,
                'members' => $memberRows,
                'remarks' => null,
            ], $this->statsFor($members->pluck('id'), $year, $month));
        });

        $grand = [
            'total_apt' => $rows->sum('total_apt'),
            'total_sft' => $rows->sum('total_sft'),
            'total_revenue' => $rows->sum('total_revenue'),
            'total_booking' => $rows->sum('total_booking'),
            'total_cancelled_apt' => $rows->sum('total_cancelled_apt'),
        ];

        // Every year that has a Sale or Booking on it, newest first, with
        // the current year always offered so a fresh period can be started.
        $years = Sale::query()->selectRaw('YEAR(date) as y')->distinct()->pluck('y')
            ->merge(Booking::query()->selectRaw('YEAR(date) as y')->distinct()->pluck('y'))
            ->push((int) date('Y'))
            ->filter()
            ->map(fn ($y) => (int) $y)
            ->unique()
            ->sortDesc()
            ->values();

        return response()->json([
            'teams' => $rows->values(),
            'grand_total' => $grand,
            'years' => $years,
            'period' => ['year' => $year ?: null, 'month' => $month ?: null],
        ]);
    }

    /** Total Apt/sft/Revenue/Booking/Cancelled Apt for a set of employee ids — shared by the team-level and per-member rows above. Filtered to `year` (0 = all time) and, within it, `month` (0 = whole year). */
    private function statsFor(Collection $employeeIds, int $year = 0, int $month = 0): array
    {
        $salesQuery = Sale::whereIn('employee_id', $employeeIds)
            ->where('status', 'confirmed')
            ->with('flat');
        $bookingsQuery = Booking::whereIn('employee_id', $employeeIds);

        if ($year) {
            $salesQuery->whereYear('date', $year);
            $bookingsQuery->whereYear('date', $year);
            if ($month) {
                $salesQuery->whereMonth('date', $month);
                $bookingsQuery->whereMonth('date', $month);
            }
        }

        $confirmedSales = $salesQuery->get();
        $bookings = $bookingsQuery->get();
        $bookingTarget = (float) $bookings->sum('amount');
        $bookingPaid = (float) $bookings->sum('paid_amount');
        $cancelledApt = $bookings->where('status', 'cancelled')->count();

        return [
            'total_apt' => $confirmedSales->count(),
            'total_sft' => (float) $confirmedSales->sum(fn ($s) => (float) ($s->flat->size_sft ?? 0)),
            'total_revenue' => (float) $confirmedSales->sum('sale_price'),
            'total_booking' => $bookings->count(),
            // "Booking Money %" — of every booking this employee/team has
            // ever taken (any status), how much of the committed Booking
            // Money target has actually been collected so far.
            'booking_money_percent' => $bookingTarget > 0 ? round($bookingPaid / $bookingTarget * 100, 1) : 0.0,
            'total_cancelled_apt' => $cancelledApt,
        ];
    }
}
