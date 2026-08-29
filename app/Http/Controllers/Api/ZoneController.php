<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Zone;
use Illuminate\Http\Request;

class ZoneController extends Controller
{
    public function index()
    {
        return Zone::withCount('projects')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate(['name' => 'required|string|max:255|unique:zones,name']);
        $zone = Zone::create($data);
        ActivityLog::record($request->user(), 'Zone Created', $zone->name);
        return response()->json($zone, 201);
    }

    public function update(Request $request, Zone $zone)
    {
        $data = $request->validate(['name' => 'required|string|max:255|unique:zones,name,' . $zone->id]);
        $zone->update($data);
        ActivityLog::record($request->user(), 'Zone Updated', $zone->name);
        return response()->json($zone);
    }

    public function destroy(Request $request, Zone $zone)
    {
        $name = $zone->name;
        $zone->delete();
        ActivityLog::record($request->user(), 'Zone Deleted', $name);
        return response()->json(['message' => 'Deleted']);
    }
}
