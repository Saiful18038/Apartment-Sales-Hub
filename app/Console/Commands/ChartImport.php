<?php

namespace App\Console\Commands;

use App\Services\ChartImporter;
use App\Services\ChartParser;
use Illuminate\Console\Command;

/**
 * Load the reviewed extract CSV (or a raw .xlsx) into Zones / Projects /
 * Flats. Logic lives in App\Services\ChartImporter, shared with the
 * in-app upload. Idempotent — an existing flat (project + flat_no) is
 * skipped, so re-running is safe.
 *
 *   php artisan chart:import storage/app/imports/chart-extract.csv --dry-run
 *   php artisan chart:import storage/app/imports/chart-extract.csv
 */
class ChartImport extends Command
{
    protected $signature = 'chart:import {path : Reviewed extract .csv, or a raw .xlsx}
        {--dry-run : Print what would be created, write nothing}';

    protected $description = 'Import the reviewed price/availability CSV into zones, projects and flats';

    public function handle(ChartParser $parser, ChartImporter $importer): int
    {
        $path = $this->argument('path');
        if (! is_file($path)) {
            $this->error("Not found: $path");

            return self::FAILURE;
        }

        $rows = str_ends_with(strtolower($path), '.csv')
            ? $parser->readCsv($path)
            : $parser->parse($path)['rows'];

        $dry = (bool) $this->option('dry-run');
        if ($dry) {
            $this->warn('DRY RUN — nothing will be written');
        }

        $res = $importer->import($rows, $dry);

        foreach ($res['tree'] as $node) {
            $tag = $node['new'] ? '+ project' : '  project';
            $this->line("  {$tag}  {$node['zone']} / {$node['project']}  ({$node['flats']} flats)");
        }

        $this->newLine();
        $this->table([], [
            ['Zones created', $res['zones_created']],
            ['Projects created', $res['projects_created']],
            ['Flats created', $res['flats_created']],
            ['Flats skipped (blank / already exist)', $res['flats_skipped']],
            ['Status defaulted to AVAILABLE', $res['status_defaulted']],
        ]);
        $this->info($dry ? 'Dry run complete.' : 'Import complete.');

        return self::SUCCESS;
    }
}
