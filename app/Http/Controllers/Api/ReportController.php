<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\Sale;
use App\Models\Team;
use App\Models\Zone;

class ReportController extends Controller
{
    /**
     * Roadmap Phase 8.1/8.2 — Floor Summary + Stock Summary, computed live
     * from the same flat records so Zone/Project/Stock totals can never
     * drift out of sync the way they did in the manual spreadsheet.
     */
    public function floorAndStockSummary()
    {
        $zones = Zone::with('projects.flats')->get();

        $rows = $zones->map(function (Zone $zone) {
            $first = 0;
            $top = 0;
            $totalFlats = 0;
            $projReg = 0;
            $projRR = 0;
            $aptReg = 0;
            $aptRR = 0;
            $ready = 0;

            foreach ($zone->projects as $project) {
                $projReg += $project->type === 'regular' ? 1 : 0;
                $projRR += $project->type === 'rr' ? 1 : 0;

                foreach ($project->flats as $flat) {
                    $totalFlats++;
                    if ($flat->floor == 1) {
                        $first++;
                    } elseif ($flat->floor == $project->total_floors) {
                        $top++;
                    }

                    if ($project->type === 'regular') {
                        $aptReg++;
                    } else {
                        $aptRR++;
                    }
                    if ($flat->status_code === 'READY') {
                        $ready++;
                    }
                }
            }

            return [
                'zone' => $zone->name,
                'first_floor' => $first,
                'middle' => $totalFlats - $first - $top,
                'top_floor' => $top,
                'total' => $totalFlats,
                'project_regular' => $projReg,
                'project_rr' => $projRR,
                'apt_regular' => $aptReg,
                'apt_rr' => $aptRR,
                'ready' => $ready,
            ];
        });

        $grand = [
            'first_floor' => $rows->sum('first_floor'),
            'middle' => $rows->sum('middle'),
            'top_floor' => $rows->sum('top_floor'),
            'total' => $rows->sum('total'),
            'project_regular' => $rows->sum('project_regular'),
            'project_rr' => $rows->sum('project_rr'),
            'apt_regular' => $rows->sum('apt_regular'),
            'apt_rr' => $rows->sum('apt_rr'),
            'ready' => $rows->sum('ready'),
        ];

        return response()->json(['zones' => $rows->values(), 'grand_total' => $grand]);
    }

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
