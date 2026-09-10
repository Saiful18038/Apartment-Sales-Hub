<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ChartImporter;
use App\Services\ChartParser;
use App\Services\LicenseService;
use Illuminate\Http\Request;

/**
 * In-app bulk upload: the owner drops the "PRICE & AVAILABILITY CHART"
 * .xlsx (or a reviewed .csv) and the app creates the Zones / Projects /
 * Flats — the same parse + import the `chart:extract` / `chart:import`
 * commands do, wrapped in one request. Owner-only (see routes/api.php).
 */
class ChartImportController extends Controller
{
    public function __construct(protected LicenseService $license) {}

    public function store(Request $request, ChartParser $parser, ChartImporter $importer)
    {
        $this->license->guard();

        $request->validate([
            'file' => 'required|file|max:20480',
            'dry_run' => 'boolean',
        ]);

        $upload = $request->file('file');
        $ext = strtolower($upload->getClientOriginalExtension() ?: $upload->guessExtension() ?: '');
        if (! in_array($ext, ['xlsx', 'xls', 'csv'], true)) {
            return response()->json(['message' => 'Upload a .xlsx or .csv file.'], 422);
        }

        $dir = storage_path('app/imports');
        @mkdir($dir, 0755, true);
        $path = $dir . DIRECTORY_SEPARATOR . 'upload-' . now()->format('Ymd-His') . '.' . $ext;
        $upload->move($dir, basename($path));

        $warnings = [];
        $stats = [];
        try {
            if ($ext === 'csv') {
                $rows = $parser->readCsv($path);
            } else {
                $parsed = $parser->parse($path);
                $rows = $parsed['rows'];
                $warnings = $parsed['warnings'];
                $stats = $parsed['stats'];
            }
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Could not read that file: ' . $e->getMessage()], 422);
        }

        if (! $rows) {
            return response()->json(['message' => 'No flats found in that file.'], 422);
        }

        $dryRun = $request->boolean('dry_run', true);
        $result = $importer->import($rows, $dryRun, $request->user());

        return response()->json([
            'dry_run' => $dryRun,
            'source' => $ext,
            'parse_stats' => $stats,
            'warnings' => array_slice($warnings, 0, 100),
            'warning_count' => count($warnings),
            'result' => $result,
        ]);
    }
}
