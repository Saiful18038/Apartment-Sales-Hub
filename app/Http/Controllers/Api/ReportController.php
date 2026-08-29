<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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
}
