<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\FlatResource;
use App\Models\ActivityLog;
use App\Models\AssetStatus;
use App\Models\Flat;
use Illuminate\Http\Request;

class FlatController extends Controller
{
    public function index(Request $request)
    {
        $query = Flat::with(['confirmedSale.employee', 'confirmedSale.customer']);
        if ($request->filled('project_id')) {
            $query->where('project_id', $request->integer('project_id'));
        }
        return FlatResource::collection($query->orderByDesc('floor')->get());
    }

    public function show(Request $request, Flat $flat)
    {
        $flat->load(['confirmedSale.employee', 'confirmedSale.customer']);
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
            'utility_charge' => 'nullable|numeric',
            'facing' => 'nullable|string|max:255',
            'bedroom' => 'nullable|integer|min:0',
            'bathroom' => 'nullable|integer|min:0',
            'balcony' => 'nullable|integer|min:0',
            'status_code' => 'nullable|exists:asset_statuses,code',
            'notes' => 'nullable|string',
        ]);
    }
}
