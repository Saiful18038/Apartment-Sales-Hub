<?php

namespace App\Console\Commands;

use App\Services\ChartParser;
use Illuminate\Console\Command;

/**
 * Parse the owner's "PRICE & AVAILABILITY CHART" workbook into a
 * reviewable flat CSV. All heuristics live in App\Services\ChartParser
 * (shared with the in-app upload). Nothing here writes to the database.
 *
 *   php artisan chart:extract storage/app/imports/chart.xlsx
 */
class ChartExtract extends Command
{
    protected $signature = 'chart:extract {file : Path to the .xlsx}
        {--out=storage/app/imports/chart-extract.csv : CSV output path}
        {--sheets=0,1,2 : Comma-separated sheet indexes to read}';

    protected $description = 'Parse the price/availability chart workbook into a reviewable flat CSV';

    public function handle(ChartParser $parser): int
    {
        $file = $this->argument('file');
        if (! is_file($file)) {
            $this->error("Not found: $file");

            return self::FAILURE;
        }

        $sheets = array_map('intval', explode(',', $this->option('sheets')));
        $res = $parser->parse($file, $sheets);

        $out = $this->option('out');
        $parser->writeCsv($res['rows'], $out);

        $this->newLine();
        $this->info('Extract complete → ' . $out);
        $this->table([], [
            ['Zones', $res['stats']['zones']],
            ['Projects', $res['stats']['projects']],
            ['Flat rows', $res['stats']['flats']],
            ['  of which no price in chart', $res['stats']['no_price']],
            ['Amenity cells skipped', $res['stats']['amenity_skipped']],
            ['Warnings (need a human eye)', count($res['warnings'])],
        ]);

        if ($res['warnings']) {
            $this->newLine();
            $this->warn('Rows needing a human eye (fix them in the CSV):');
            foreach (array_slice($res['warnings'], 0, 60) as $w) {
                $this->line("  {$w['cell']}  —  {$w['msg']}");
            }
            if (count($res['warnings']) > 60) {
                $this->line('  … +' . (count($res['warnings']) - 60) . ' more (all in the CSV `warning` column)');
            }
        }

        return self::SUCCESS;
    }
}
