<?php

namespace App\Services;

use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\IOFactory;

/**
 * Best-effort parser for the owner's hand-made "PRICE & AVAILABILITY CHART"
 * workbook — a visual floor-map grid, not a data table. Turns each grid
 * cell into one flat row. Used by the `chart:extract` command and by
 * ChartImportController (the in-app upload).
 *
 * Nothing here touches the database. See the plan file
 * (.claude/plans/replicated-inventing-wilkes.md) for the layout notes.
 */
class ChartParser
{
    /** Fill colours the chart uses for status. */
    private const FILL_AVAILABLE = ['CCFFCC', 'C6EFCE', 'CCFFFF'];
    private const FILL_SOLD_B = ['FFFFCC', 'FFEB9C', 'FFF2CC']; // yellow

    private const AMENITY = '/\b(commu|community|commercial\s+space|double\s+height|open\s+roof|car\s+parking|lounge|reception|gym|hall|guard|driver|sub[\- ]?station|generator|lobby|prayer)\b|^[\-–—]{1,3}$/i';

    public const CSV_COLUMNS = [
        'zone', 'project', 'address', 'land_katha', 'handover', 'lift', 'parking_charge',
        'utility_charge', 'flat_line', 'facing', 'floor', 'flat_no', 'price_per_sft', 'size_sft',
        'status_code', 'variant', 'tags', 'sheet', 'source_cell', 'warning',
    ];

    private array $rows = [];
    private array $warnings = [];
    private int $amenitySkipped = 0;
    private int $noPrice = 0;

    /**
     * @return array{rows: array<int,array<string,mixed>>, warnings: array<int,array{cell:string,msg:string}>, stats: array{amenity_skipped:int, no_price:int, zones:int, projects:int, flats:int}}
     */
    public function parse(string $xlsxPath, array $sheetIndexes = [0, 1, 2]): array
    {
        $this->rows = [];
        $this->warnings = [];
        $this->amenitySkipped = 0;
        $this->noPrice = 0;

        $reader = IOFactory::createReader('Xlsx');
        $reader->setReadDataOnly(false);
        $book = $reader->load($xlsxPath);

        foreach ($sheetIndexes as $si) {
            if ($si >= 0 && $si < $book->getSheetCount()) {
                $this->parseSheet($book->getSheet($si));
            }
        }

        return [
            'rows' => $this->rows,
            'warnings' => $this->warnings,
            'stats' => [
                'amenity_skipped' => $this->amenitySkipped,
                'no_price' => $this->noPrice,
                'zones' => collect($this->rows)->pluck('zone')->unique()->count(),
                'projects' => collect($this->rows)->pluck('project')->unique()->filter()->count(),
                'flats' => count($this->rows),
            ],
        ];
    }

    public function writeCsv(array $rows, string $path): void
    {
        @mkdir(dirname($path), 0755, true);
        $fh = fopen($path, 'w');
        fputcsv($fh, self::CSV_COLUMNS);
        foreach ($rows as $row) {
            fputcsv($fh, array_map(fn ($k) => $row[$k] ?? '', self::CSV_COLUMNS));
        }
        fclose($fh);
    }

    /** Read a reviewed extract CSV back into row arrays. */
    public function readCsv(string $path): array
    {
        $fh = fopen($path, 'r');
        $header = array_map('trim', fgetcsv($fh));
        $rows = [];
        while (($r = fgetcsv($fh)) !== false) {
            if (count(array_filter($r, fn ($v) => trim((string) $v) !== '')) === 0) {
                continue;
            }
            $rows[] = array_combine($header, array_pad($r, count($header), ''));
        }
        fclose($fh);

        return $rows;
    }

    // ---------------------------------------------------------------- //

    private function parseSheet($sheet): void
    {
        $title = $sheet->getTitle();
        $maxCol = Coordinate::columnIndexFromString($sheet->getHighestColumn());
        $maxRow = $sheet->getHighestRow();

        $merge = [];
        foreach ($sheet->getMergeCells() as $range) {
            [$tl] = explode(':', $range);
            foreach (Coordinate::extractAllCellReferencesInRange($range) as $ref) {
                $merge[$ref] = $tl;
            }
        }

        $val = function (int $c, int $r) use ($sheet, $merge): string {
            $ref = Coordinate::stringFromColumnIndex($c) . $r;
            $ref = $merge[$ref] ?? $ref;

            return trim(preg_replace('/\s+/', ' ', (string) $sheet->getCell($ref)->getCalculatedValue()));
        };
        $fill = function (int $c, int $r) use ($sheet, $merge): string {
            $ref = Coordinate::stringFromColumnIndex($c) . $r;
            $ref = $merge[$ref] ?? $ref;

            return strtoupper($sheet->getCell($ref)->getStyle()->getFill()->getStartColor()->getRGB() ?: '');
        };

        $bareZones = ['NIKETON', 'BANANI', 'DOHS BANANI', 'GULSHAN', 'BARIDHARA', 'UTTARA', 'BASHUNDHARA', 'MID-TOWN', 'MIRPUR', 'DHANMONDI'];
        $zoneAt = [];
        for ($r = 1; $r <= $maxRow; $r++) {
            for ($c = 1; $c <= $maxCol; $c++) {
                $t = $val($c, $r);
                if ($t === '') {
                    continue;
                }
                if (preg_match('/^([A-Z][A-Za-z .\-]{2,30}?)\s*ZONE$/', $t, $m)) {
                    $zoneAt[] = ['row' => $r, 'col' => $c, 'zone' => trim($m[1])];
                } elseif (in_array(strtoupper($t), $bareZones, true)) {
                    $zoneAt[] = ['row' => $r, 'col' => $c, 'zone' => strtoupper($t)];
                }
            }
        }
        $zoneFor = function (int $row, int $col) use ($zoneAt, $title): string {
            $best = null;
            $bestScore = null;
            foreach ($zoneAt as $z) {
                if ($z['row'] > $row + 1) {
                    continue;
                }
                $score = ($row - $z['row']) * 1000 + abs($col - $z['col']);
                if ($bestScore === null || $score < $bestScore) {
                    $bestScore = $score;
                    $best = $z;
                }
            }

            return $best['zone'] ?? strtoupper(trim(preg_replace('/Page-\d+|\(|\)/', '', $title)));
        };

        $isFloor = function (string $t): ?int {
            if ($t === '') {
                return null;
            }
            if (preg_match('/^G\.?\s?F\.?$|^ground/i', $t)) {
                return 0;
            }
            if (preg_match('/^(\d{1,2})\s*(st|nd|rd|th)\s*floor/i', $t, $m)) {
                return (int) $m[1];
            }

            return null;
        };

        $blocks = [];
        for ($c = 1; $c <= $maxCol; $c++) {
            $run = [];
            for ($r = 1; $r <= $maxRow + 1; $r++) {
                $f = $r <= $maxRow ? $isFloor($val($c, $r)) : null;
                if ($f !== null) {
                    $run[] = ['row' => $r, 'floor' => $f];
                } elseif (count($run) >= 3) {
                    $blocks[] = ['anchorCol' => $c, 'rows' => $run];
                    $run = [];
                } else {
                    $run = [];
                }
            }
        }
        if (! $blocks) {
            return;
        }

        $anchorCols = collect($blocks)->pluck('anchorCol')->unique()->sort()->values()->all();

        foreach ($blocks as $blk) {
            $this->parseBlock($val, $fill, $blk, $anchorCols, $maxCol, $maxRow, $title, $zoneFor);
        }
    }

    private function parseBlock(callable $val, callable $fill, array $blk, array $anchorCols, int $maxCol, int $maxRow, string $title, callable $zoneFor): void
    {
        $aCol = $blk['anchorCol'];
        $floorRows = $blk['rows'];
        $topRow = $floorRows[0]['row'];
        $botRow = end($floorRows)['row'];

        $rightCol = $maxCol;
        foreach ($anchorCols as $ac) {
            if ($ac > $aCol) {
                $rightCol = $ac - 1;
                break;
            }
        }
        $leftCol = $aCol + 1;
        if ($leftCol > $rightCol) {
            return;
        }

        $addrRow = null;
        for ($r = $botRow + 1; $r <= min($botRow + 6, $maxRow); $r++) {
            for ($c = max(1, $aCol - 1); $c <= $aCol + 1; $c++) {
                if (preg_match('/^address$/i', $val($c, $r))) {
                    $addrRow = $r;
                    break 2;
                }
            }
        }
        $nameRow = null;
        if ($addrRow) {
            for ($r = $addrRow + 1; $r <= min($addrRow + 4, $maxRow); $r++) {
                for ($c = $leftCol; $c <= $rightCol; $c++) {
                    if (preg_match('/\*(each|two|three)\s+parking/i', $val($c, $r)) || preg_match('/parking\s*[\d.]+\s*lac/i', $val($c, $r))) {
                        $nameRow = $r;
                        break 2;
                    }
                }
            }
        }

        $projCols = [];
        $scanRow = $nameRow ?: $addrRow;
        if ($scanRow) {
            for ($c = $leftCol; $c <= $rightCol; $c++) {
                if ($val($c, $scanRow) !== '') {
                    $projCols[] = $c;
                }
            }
        }
        if (! $projCols) {
            $projCols = [$leftCol];
        }
        $projCols[] = $rightCol + 1;

        for ($pi = 0; $pi < count($projCols) - 1; $pi++) {
            $ps = $projCols[$pi];
            $pe = $projCols[$pi + 1] - 1;

            $nameCell = $nameRow ? $val($ps, $nameRow) : '';
            $project = $nameCell !== '' ? trim(preg_replace('/\*.*/s', '', $nameCell)) : '';
            if ($project === '' && $addrRow) {
                $project = 'UNNAMED @ ' . Coordinate::stringFromColumnIndex($ps) . $addrRow;
            }
            $address = $addrRow ? $val($ps, $addrRow) : '';

            [$parkingCharge, $utilityCharge] = $this->parseCharges($nameCell);
            $land = 0.0;
            $handover = '';
            $lift = '';
            if ($addrRow) {
                for ($r = ($nameRow ?: $addrRow) + 1; $r <= min(($nameRow ?: $addrRow) + 5, $maxRow); $r++) {
                    $t = $val($ps, $r);
                    if ($t === '') {
                        continue;
                    }
                    if (! $land && preg_match('/([\d.]+)\s*katha/i', $t, $m)) {
                        $land = (float) $m[1];
                    }
                    if (! $handover && preg_match('~^(ready|[A-Za-z]{3,4}-\d{2})~i', $t)) {
                        $handover = preg_replace('~/.*$~', '', $t);
                        if (preg_match('~L-\s*(\d+)~i', $t, $m)) {
                            $lift = $m[1];
                        }
                    }
                }
            }

            $zone = $zoneFor($topRow, $ps);

            $lines = $this->flatLines($val, $ps, $pe, $topRow);
            if (! $lines) {
                $lines = [['col' => $ps, 'prefix' => 'A', 'facing' => '', 'label' => '']];
            }

            $seenPrefix = [];
            foreach ($lines as $line) {
                $prefix = $line['prefix'];
                if (isset($seenPrefix[$prefix])) {
                    $seenPrefix[$prefix]++;
                    $prefix .= '(' . $seenPrefix[$prefix] . ')';
                } else {
                    $seenPrefix[$line['prefix']] = 1;
                }

                foreach ($floorRows as $fr) {
                    $c = $line['col'];
                    $raw = $val($c, $fr['row']);
                    $bg = $fill($c, $fr['row']);
                    $cellRef = "{$title}!" . Coordinate::stringFromColumnIndex($c) . $fr['row'];

                    if ($raw !== '' && $raw === $line['label']) {
                        continue;
                    }
                    if ($raw === '' && ! $this->isFillIn($bg, self::FILL_AVAILABLE)) {
                        continue;
                    }
                    if ($raw !== '' && preg_match(self::AMENITY, $raw)) {
                        $this->amenitySkipped++;
                        continue;
                    }

                    $flatNo = trim("$prefix (" . $this->ordinal($fr['floor']) . ')');
                    [$rate, $size, $variant, $tags] = $this->parseCellNumbers($raw);
                    $status = $this->classify($raw, $bg, $tags);
                    $warning = '';

                    if ($status === '' && $raw !== '') {
                        $warning = 'unrecognised cell: "' . mb_substr($raw, 0, 40) . '"';
                        $this->warnings[] = ['cell' => $cellRef, 'msg' => $warning];
                    } elseif ($status === 'AVAILABLE' && ! $rate && $raw === '') {
                        $warning = 'no price in chart';
                        $this->noPrice++;
                    } elseif (preg_match('/^asset/i', $raw)) {
                        $warning = 'was "Asset" — mapped to LAND_OWNER, re-check';
                        $this->warnings[] = ['cell' => $cellRef, 'msg' => $warning];
                    } elseif (preg_match('/suspension/i', $raw)) {
                        $warning = 'was "Suspension" — mapped to LAND_OWNER';
                        $this->warnings[] = ['cell' => $cellRef, 'msg' => $warning];
                    }

                    $this->rows[] = [
                        'zone' => $zone,
                        'project' => $project,
                        'address' => $address,
                        'land_katha' => $land ?: '',
                        'handover' => $handover,
                        'lift' => $lift,
                        'parking_charge' => $parkingCharge ?: '',
                        'utility_charge' => $utilityCharge ?: '',
                        'flat_line' => $line['label'],
                        'facing' => $line['facing'],
                        'floor' => $fr['floor'],
                        'flat_no' => $flatNo,
                        'price_per_sft' => $rate ?: '',
                        'size_sft' => $size ?: '',
                        'status_code' => $status,
                        'variant' => $variant,
                        'tags' => $tags,
                        'sheet' => $title,
                        'source_cell' => $cellRef,
                        'warning' => $warning,
                    ];
                }
            }
        }
    }

    private function flatLines(callable $val, int $ps, int $pe, int $topRow): array
    {
        $lines = [];
        for ($c = $ps; $c <= $pe; $c++) {
            for ($r = max(1, $topRow - 3); $r <= $topRow + 3; $r++) {
                $t = $val($c, $r);
                if ($t === '') {
                    continue;
                }
                if (preg_match('/^([A-Z]{1,3}(?:-?\d{2,4})?)\s*(\(\s*\d[\d ]*\))?\s+([A-Za-z].*?(?:Rd|Bk|Lake|Front|Field|Green|Blk|Duplex).*)$/', $t, $m)) {
                    $lines[$c] = [
                        'col' => $c,
                        'prefix' => str_replace(' ', '', $m[1]),
                        'facing' => trim($m[2] . ' ' . $m[3]),
                        'label' => $t,
                    ];
                    break;
                }
            }
        }

        return array_values($lines);
    }

    private function parseCharges(string $s): array
    {
        $p = 0;
        $u = 0;
        if (preg_match('/parking\s*([\d.]+)\s*lac/i', $s, $m)) {
            $p = (float) $m[1] * 100000;
        }
        if (preg_match('/utility\s*([\d.]+)\s*lac/i', $s, $m)) {
            $u = (float) $m[1] * 100000;
        }

        return [$p, $u];
    }

    /** @return array{0:float,1:float,2:string,3:string} rate, size, variant, tags */
    private function parseCellNumbers(string $raw): array
    {
        $rate = 0.0;
        $size = 0.0;
        $variant = '';
        $tags = '';
        if (preg_match('/(?<!\[)\b(\d{4,6})\b(?!\s*s?ft)/i', $raw, $m)) {
            $rate = (float) $m[1];
        }
        if (preg_match('/\[\s*([\d.]+)\s*s?ft\s*\]/i', $raw, $m)) {
            $size = (float) $m[1];
        }
        if (preg_match('/\((ap\s*\d+)\)/i', $raw, $m)) {
            $variant = strtolower(str_replace(' ', '', $m[1]));
        }
        if (preg_match_all('~\((RR[- ]?[A-Z/]+)\)~i', $raw, $mm)) {
            $tags = implode(' ', $mm[1]);
        }
        if (stripos($raw, 'duplex') !== false) {
            $tags = trim($tags . ' duplex');
        }

        return [$rate, $size, $variant, $tags];
    }

    private function classify(string $raw, string $bg, string $tags): string
    {
        if ($raw === '') {
            return $this->isFillIn($bg, self::FILL_AVAILABLE) ? 'AVAILABLE' : '';
        }
        if (preg_match('/^asset/i', $raw) || preg_match('/suspension/i', $raw)) {
            return 'LAND_OWNER';
        }
        if (stripos($tags, 'RR') !== false) {
            return 'RESALE_RR';
        }
        if (preg_match('/\bsold\b/i', $raw)) {
            return $this->isFillIn($bg, self::FILL_SOLD_B) ? 'SOLD_OS_SS' : 'SOLD_CR';
        }
        if (preg_match('/\d{4,6}/', $raw)) {
            return 'AVAILABLE';
        }

        return $this->isFillIn($bg, self::FILL_AVAILABLE) ? 'AVAILABLE' : '';
    }

    private function isFillIn(string $bg, array $set): bool
    {
        return $bg !== '' && in_array($bg, $set, true);
    }

    private function ordinal(int $n): string
    {
        if ($n === 0) {
            return 'GF';
        }
        $s = ['th', 'st', 'nd', 'rd'];
        $v = $n % 100;

        return $n . ($s[($v - 20) % 10] ?? $s[$v] ?? $s[0]);
    }
}
