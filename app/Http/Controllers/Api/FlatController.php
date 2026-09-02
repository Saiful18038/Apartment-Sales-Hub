<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\FlatResource;
use App\Models\ActivityLog;
use App\Models\AssetStatus;
use App\Models\Flat;
use App\Models\User;
use App\Notifications\ParkingExchanged;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FlatController extends Controller
{
    public function index(Request $request)
    {
        $query = Flat::with(['confirmedSale.employee.team.leader', 'confirmedSale.customer']);
        if ($request->filled('project_id')) {
            $query->where('project_id', $request->integer('project_id'));
        }
        return FlatResource::collection($query->orderByDesc('floor')->get());
    }

    public function show(Request $request, Flat $flat)
    {
        $flat->load(['confirmedSale.employee.team.leader', 'confirmedSale.customer']);
        return new FlatResource($flat);
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $flat = Flat::create($data);
        ActivityLog::record($request->user(), 'Flat Created', $flat->flat_no);
        return response()->json($flat, 201);
    }

    public function update(Request $request, Flat $flat)
    {
        $data = $this->validated($request, true);
        $flat->update($data);
        ActivityLog::record($request->user(), 'Flat Updated', $flat->flat_no);
        return response()->json($flat);
    }

    public function destroy(Request $request, Flat $flat)
    {
        $no = $flat->flat_no;
        $flat->delete();
        ActivityLog::record($request->user(), 'Flat Deleted', $no);
        return response()->json(['message' => 'Deleted']);
    }

    /**
     * Swap this flat's parking number with another flat's, as-per-demand
     * (e.g. a buyer wants a different parking slot than the one their unit
     * came with). Restricted to the same project — parking is physically
     * tied to one building's garage, so a cross-project "swap" would just
     * be assigning a number that means nothing there. Notifies owner/admin
     * in-app (see App\Notifications\ParkingExchanged) so it's visible via
     * the bell icon, not silent.
     */
    public function exchangeParking(Request $request, Flat $flat)
    {
        $data = $request->validate([
            'with_flat_id' => 'required|integer|exists:flats,id',
        ]);

        if ((int) $data['with_flat_id'] === $flat->id) {
            return response()->json(['message' => 'Pick a different flat to exchange parking with.'], 422);
        }

        $other = Flat::findOrFail($data['with_flat_id']);
        if ($other->project_id !== $flat->project_id) {
            return response()->json(['message' => 'Parking can only be exchanged between flats in the same project.'], 422);
        }

        $oldA = (string) ($flat->parking_number ?? '—');
        $oldB = (string) ($other->parking_number ?? '—');

        DB::transaction(function () use ($flat, $other) {
            [$numA, $numB] = [$flat->parking_number, $other->parking_number];
            $flat->update(['parking_number' => $numB]);
            $other->update(['parking_number' => $numA]);
        });

        ActivityLog::record($request->user(), 'Parking Exchanged', "{$flat->flat_no} ({$oldA}) ↔ {$other->flat_no} ({$oldB})");

        $managers = User::whereIn('role', ['owner', 'admin'])->where('is_active', true)->get();
        $recipients = $managers->concat([$request->user()])->unique('id');
        foreach ($recipients as $recipient) {
            $recipient->notify(new ParkingExchanged($flat, $other, $oldA, $oldB));
        }

        return response()->json([
            'flat' => $flat->fresh(),
            'with' => $other->fresh(),
        ]);
    }

    /** Quick status change from the Visual Flat Map (Roadmap Phase 7). */
    public function changeStatus(Request $request, Flat $flat)
    {
        $data = $request->validate(['status_code' => 'required|exists:asset_statuses,code']);
        $old = $flat->status_code;
        $flat->update(['status_code' => $data['status_code']]);
        ActivityLog::record($request->user(), 'Status Changed', "{$flat->flat_no}: {$old} → {$data['status_code']}");
        return response()->json($flat);
    }

    private function validated(Request $request, bool $isUpdate = false): array
    {
        $rule = $isUpdate ? 'sometimes' : 'required';
        return $request->validate([
            'project_id' => "$rule|exists:projects,id",
            'floor' => "$rule|integer",
            'flat_no' => "$rule|string|max:255",
            'size_sft' => 'nullable|numeric',
            'price_per_sft' => 'nullable|numeric',
            'parking_charge' => 'nullable|numeric',
            'parking_count' => 'nullable|integer|min:0',
            'parking_number' => 'nullable|string|max:50',
            'utility_charge' => 'nullable|numeric',
            'reserve_fund' => 'nullable|numeric',
            'facing' => 'nullable|string|max:255',
            'bedroom' => 'nullable|integer|min:0',
            'bathroom' => 'nullable|integer|min:0',
            'balcony' => 'nullable|integer|min:0',
            'status_code' => 'nullable|exists:asset_statuses,code',
            'notes' => 'nullable|string',
        ]);
    }
}
