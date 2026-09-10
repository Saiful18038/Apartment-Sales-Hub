<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Project extends Model
{
    protected $fillable = [
        'zone_id', 'type', 'name', 'code', 'address', 'road_facing',
        'land_katha', 'total_floors', 'status', 'handover', 'launch_date',
    ];

    public function zone()  { return $this->belongsTo(Zone::class); }
    public function flats() { return $this->hasMany(Flat::class); }
    public function documents() { return $this->morphMany(Document::class, 'documentable'); }

    /** Roadmap Phase 4 — Project Dashboard: live counts by status. */
    public function statusCounts(): array
    {
        return $this->flats()
            ->selectRaw('status_code, count(*) as total')
            ->groupBy('status_code')
            ->pluck('total', 'status_code')
            ->toArray();
    }

    /**
     * Unit columns — a project's distinct apartment lines, taken from each
     * flat_no's code before its parenthesised floor suffix ("A-1472 (9th)"
     * -> "A-1472", "A (9th)" -> "A"), falling back to the leading letters
     * for hand-typed numbers. This is the server-side twin of
     * frontend/lib/units.js; a project with 2+ lines renders as side-by-side
     * unit columns on the Flats and Projects screens, like the owner's
     * hand-made availability chart. Order follows the top floor's flats.
     *
     * @return array<int,array{code:string,total:int,available:int}>
     */
    public function unitBreakdown(): array
    {
        $sellable = ['AVAILABLE', 'RESALE_RR', 'READY'];
        $out = [];

        foreach ($this->flats()->orderByDesc('floor')->orderBy('id')->get(['flat_no', 'status_code']) as $f) {
            $raw = trim((string) $f->flat_no);
            $code = trim((string) preg_replace('/\s*\([^)]*\)\s*$/', '', $raw));
            if ($code === '' && preg_match('/^([A-Za-z]+)/', $raw, $m)) {
                $code = $m[1];
            }
            $code = strtoupper($code) ?: '—';

            $out[$code] ??= ['code' => $code, 'total' => 0, 'available' => 0];
            $out[$code]['total']++;
            if (in_array($f->status_code, $sellable, true)) {
                $out[$code]['available']++;
            }
        }

        return array_values($out);
    }
}
