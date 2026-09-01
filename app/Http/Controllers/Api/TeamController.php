<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Team;
use Illuminate\Http\Request;

/**
 * Owner's request — Team hierarchy: Owner/Admin create teams and assign a
 * Team Leader; a Team Leader and their members only ever see their own
 * team. This is a separate organizational layer for task management — it
 * does not touch Zone/Project/Flat/Sale/Booking/Customer visibility.
 */
class TeamController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $query = Team::with(['leader:id,name,email', 'members:id,name,email,role,team_id']);

        if (!$user->canManage()) {
            // Team Leader / Employee only ever see their own team.
            $query->where('id', $user->team_id);
        }

        return $query->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'leader_id' => 'nullable|exists:users,id',
        ]);

        $team = Team::create($data);

        if (!empty($data['leader_id'])) {
            $team->leader()->update(['role' => 'team_leader', 'team_id' => $team->id]);
        }

        ActivityLog::record($request->user(), 'Team Created', $team->name);

        return response()->json($team->load(['leader', 'members']), 201);
    }

    public function update(Request $request, Team $team)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'leader_id' => 'nullable|exists:users,id',
        ]);

        if (array_key_exists('leader_id', $data) && $data['leader_id'] !== $team->leader_id) {
            // The outgoing leader keeps their team_id (still a member) unless
            // explicitly removed via /users — this call only changes who leads.
            $team->update(['leader_id' => $data['leader_id']]);
            if ($data['leader_id']) {
                $team->leader()->update(['role' => 'team_leader', 'team_id' => $team->id]);
            }
            unset($data['leader_id']);
        }

        if (!empty($data)) {
            $team->update($data);
        }

        ActivityLog::record($request->user(), 'Team Updated', $team->name);

        return response()->json($team->fresh(['leader', 'members']));
    }

    public function destroy(Request $request, Team $team)
    {
        $name = $team->name;
        // Members/tasks cascade per the migrations' FK rules (users.team_id
        // -> nullOnDelete, tasks.team_id -> cascadeOnDelete).
        $team->delete();
        ActivityLog::record($request->user(), 'Team Deleted', $name);
        return response()->json(['message' => 'Deleted']);
    }
}
