<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Project;
use Illuminate\Http\Request;

class ProjectController extends Controller
{
    public function index()
    {
        return Project::with('zone')->withCount('flats')->get()->map(function ($p) {
            $p->status_counts = $p->statusCounts();
            return $p;
        });
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'zone_id' => 'required|exists:zones,id',
            'type' => 'required|in:regular,rr',
            'name' => 'required|string|max:255',
            'code' => 'nullable|string|max:255',
            'address' => 'nullable|string|max:255',
            'road_facing' => 'nullable|string|max:255',
            'land_katha' => 'nullable|numeric',
            'total_floors' => 'nullable|integer|min:0',
            'status' => 'required|in:Planning,Ongoing,Completed,Suspended,Archived',
            'handover' => 'nullable|string|max:255',
            'launch_date' => 'nullable|string|max:255',
        ]);
        $project = Project::create($data);
        ActivityLog::record($request->user(), 'Project Created', $project->name);
        return response()->json($project, 201);
    }

    public function update(Request $request, Project $project)
    {
        $data = $request->validate([
            'zone_id' => 'sometimes|exists:zones,id',
            'type' => 'sometimes|in:regular,rr',
            'name' => 'sometimes|string|max:255',
            'code' => 'nullable|string|max:255',
            'address' => 'nullable|string|max:255',
            'road_facing' => 'nullable|string|max:255',
            'land_katha' => 'nullable|numeric',
            'total_floors' => 'nullable|integer|min:0',
            'status' => 'sometimes|in:Planning,Ongoing,Completed,Suspended,Archived',
            'handover' => 'nullable|string|max:255',
            'launch_date' => 'nullable|string|max:255',
        ]);
        $project->update($data);
        ActivityLog::record($request->user(), 'Project Updated', $project->name);
        return response()->json($project);
    }

    public function destroy(Request $request, Project $project)
    {
        $name = $project->name;
        $project->delete(); // flats cascade-delete via FK
        ActivityLog::record($request->user(), 'Project Deleted', $name);
        return response()->json(['message' => 'Deleted']);
    }
}
