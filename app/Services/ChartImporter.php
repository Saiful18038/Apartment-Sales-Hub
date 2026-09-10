<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\AssetStatus;
use App\Models\Flat;
use App\Models\Project;
use App\Models\User;
use App\Models\Zone;
use Illuminate\Support\Facades\DB;

/**
 * Loads the flat rows produced by ChartParser into Zones, Projects and
 * Flats. Idempotent: a Flat that already exists (same project + flat_no)
 * is skipped, so it is safe to run repeatedly. Used by the `chart:import`
 * command and by ChartImportController.
 */
class ChartImporter
{
    /**
     * @param  array<int,array<string,mixed>>  $rows  ChartParser row arrays
     * @return array{dry_run:bool, zones_created:int, projects_created:int, flats_created:int, flats_skipped:int, status_defaulted:int, tree:array<int,array{zone:string,project:string,flats:int,new:bool}>}
     */
    public function import(array $rows, bool $dryRun = false, ?User $actor = null): array
    {
        $validStatuses = AssetStatus::pluck('code')->all();

        // group: zone -> project -> [rows]  (+ per-project metadata)
        $tree = [];
        $meta = [];
        foreach ($rows as $row) {
            $zone = trim((string) ($row['zone'] ?? '')) ?: 'UNZONED';
            $project = trim((string) ($row['project'] ?? ''));
            if ($project === '') {
                continue;
            }
            $tree[$zone][$project][] = $row;
            $meta[$zone][$project] ??= [
                'address' => $row['address'] ?? '',
                'land_katha' => $row['land_katha'] ?? '',
                'handover' => $row['handover'] ?? '',
                'parking_charge' => $row['parking_charge'] ?? '',
                'utility_charge' => $row['utility_charge'] ?? '',
                'max_floor' => 0,
            ];
            $meta[$zone][$project]['max_floor'] = max($meta[$zone][$project]['max_floor'], (int) ($row['floor'] ?? 0));
        }

        $result = [
            'dry_run' => $dryRun,
            'zones_created' => 0,
            'projects_created' => 0,
            'flats_created' => 0,
            'flats_skipped' => 0,
            'status_defaulted' => 0,
            'tree' => [],
        ];

        $run = function () use ($tree, $meta, $validStatuses, $dryRun, &$result) {
            foreach ($tree as $zoneName => $projects) {
                $zone = Zone::where('name', $zoneName)->first();
                $zoneIsNew = ! $zone;
                if ($zoneIsNew) {
                    $result['zones_created']++;
                    $zone = $dryRun ? tap(new Zone(['name' => $zoneName]), fn ($z) => $z->id = -1)
                                    : Zone::create(['name' => $zoneName]);
                }

                foreach ($projects as $projectName => $flatRows) {
                    $m = $meta[$zoneName][$projectName];
                    $project = Project::where('name', $projectName)->first();
                    $projIsNew = ! $project;
                    if ($projIsNew) {
                        $result['projects_created']++;
                        $attrs = [
                            'zone_id' => $zone->id,
                            'type' => 'regular',
                            'name' => $projectName,
                            'address' => $m['address'] ?: null,
                            'land_katha' => $m['land_katha'] !== '' ? (float) $m['land_katha'] : null,
                            'total_floors' => (int) $m['max_floor'],
                            'status' => 'Ongoing',
                            'handover' => $m['handover'] ?: null,
                        ];
                        $project = $dryRun ? tap(new Project($attrs), fn ($p) => $p->id = -1)
                                           : Project::create($attrs);
                    }

                    $existing = ($dryRun || $project->id < 0)
                        ? []
                        : Flat::where('project_id', $project->id)->pluck('flat_no')->flip()->all();

                    $madeHere = 0;
                    foreach ($flatRows as $row) {
                        $flatNo = trim((string) ($row['flat_no'] ?? ''));
                        if ($flatNo === '' || isset($existing[$flatNo])) {
                            $result['flats_skipped']++;
                            continue;
                        }

                        $status = trim((string) ($row['status_code'] ?? ''));
                        if (! in_array($status, $validStatuses, true)) {
                            $status = 'AVAILABLE';
                            $result['status_defaulted']++;
                        }

                        $notes = trim(implode(' ', array_filter([
                            $row['variant'] ?? '',
                            $row['tags'] ?? '',
                            ($row['flat_line'] ?? '') !== '' ? 'line: ' . $row['flat_line'] : '',
                        ])));

                        if (! $dryRun) {
                            Flat::create([
                                'project_id' => $project->id,
                                'floor' => (int) ($row['floor'] ?? 0),
                                'flat_no' => $flatNo,
                                'size_sft' => ($row['size_sft'] ?? '') !== '' ? (float) $row['size_sft'] : 0,
                                'price_per_sft' => ($row['price_per_sft'] ?? '') !== '' ? (float) $row['price_per_sft'] : 0,
                                'parking_charge' => ($m['parking_charge'] ?? '') !== '' ? (float) $m['parking_charge'] : 0,
                                'parking_count' => 1,
                                'utility_charge' => ($m['utility_charge'] ?? '') !== '' ? (float) $m['utility_charge'] : 0,
                                'reserve_fund' => 25000,
                                'facing' => trim((string) ($row['facing'] ?? '')) ?: null,
                                'status_code' => $status,
                                'notes' => $notes ?: null,
                            ]);
                            $existing[$flatNo] = true;
                        }
                        $result['flats_created']++;
                        $madeHere++;
                    }

                    $result['tree'][] = [
                        'zone' => $zoneName,
                        'project' => $projectName,
                        'flats' => $madeHere,
                        'new' => $projIsNew,
                    ];
                }
            }
        };

        if ($dryRun) {
            $run();
        } else {
            DB::transaction($run);
            ActivityLog::record(
                $actor,
                'Chart Import',
                "{$result['zones_created']} zones, {$result['projects_created']} projects, {$result['flats_created']} flats"
            );
        }

        return $result;
    }
}
