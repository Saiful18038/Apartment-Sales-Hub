<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Team;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Owner's request — Team hierarchy: Owner/Admin create teams and assign a
 * Team Leader (with their Designation/Department/Employee ID) and a roster
 * of Team Employees in one place; a Team Leader and their members only
 * ever see their own team. This is a separate organizational layer for
 * task management — it does not touch Zone/Project/Flat/Sale/Booking/
 * Customer visibility.
 */
class TeamController extends Controller
{
    private const MEMBER_COLUMNS = ['id', 'name', 'email', 'role', 'team_id', 'employee_code', 'department', 'designation'];

    public function index(Request $request)
    {
        $user = $request->user();
        $query = Team::with(['leader:' . implode(',', self::MEMBER_COLUMNS), 'members:' . implode(',', self::MEMBER_COLUMNS)]);

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
            'leader_id' => 'required|exists:users,id',
            'leader_designation' => 'nullable|string|max:255',
            'leader_department' => 'nullable|string|max:255',
            'leader_employee_code' => ['nullable', 'string', 'max:50', Rule::unique('users', 'employee_code')->ignore($request->input('leader_id'))],
            'member_ids' => 'nullable|array',
            'member_ids.*' => 'exists:users,id',
        ]);

        $team = Team::create(['name' => $data['name'], 'leader_id' => $data['leader_id']]);
        $this->applyLeaderProfile($team, $data);
        $this->syncMembers($team, $data['member_ids'] ?? []);

        ActivityLog::record($request->user(), 'Team Created', $team->name);

        return response()->json($team->fresh(['leader', 'members']), 201);
    }

    public function update(Request $request, Team $team)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'leader_id' => 'nullable|exists:users,id',
            'leader_designation' => 'nullable|string|max:255',
            'leader_department' => 'nullable|string|max:255',
            'leader_employee_code' => [
                'nullable', 'string', 'max:50',
                Rule::unique('users', 'employee_code')->ignore($request->input('leader_id', $team->leader_id)),
            ],
            'member_ids' => 'nullable|array',
            'member_ids.*' => 'exists:users,id',
        ]);

        if (isset($data['name'])) {
            $team->update(['name' => $data['name']]);
        }

        // The outgoing leader (if changed) keeps their team_id — still a
        // member — unless the new member list below removes them.
        if (array_key_exists('leader_id', $data) && $data['leader_id'] !== $team->leader_id) {
            $team->update(['leader_id' => $data['leader_id']]);
        }

        // Promotes the (possibly just-changed) leader + applies whatever
        // Designation/Department/Employee ID were given.
        $this->applyLeaderProfile($team->fresh(), $data);

        if (array_key_exists('member_ids', $data)) {
            $this->syncMembers($team->fresh(), $data['member_ids'] ?? []);
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

    /**
     * Whoever currently leads the team is promoted to team_leader and
     * placed on this team, plus whatever Designation/Department/Employee
     * ID were given — this is the one place a leader actually becomes one.
     */
    private function applyLeaderProfile(Team $team, array $data): void
    {
        if (!$team->leader_id) {
            return;
        }
        $updates = array_filter([
            'designation' => $data['leader_designation'] ?? null,
            'department' => $data['leader_department'] ?? null,
            'employee_code' => $data['leader_employee_code'] ?? null,
        ], fn ($v) => $v !== null && $v !== '');
        $updates['role'] = 'team_leader';
        $updates['team_id'] = $team->id;
        $team->leader()->update($updates);
    }

    /**
     * `$memberIds` is the FULL desired Team Employee roster (the "Assign"
     * checklist) — anyone currently on the team but not in the new list is
     * unassigned (team_id -> null); the leader is never touched here.
     */
    private function syncMembers(Team $team, array $memberIds): void
    {
        $memberIds = array_diff(array_map('intval', $memberIds), [(int) $team->leader_id]);

        User::where('team_id', $team->id)
            ->where('id', '!=', $team->leader_id)
            ->whereNotIn('id', $memberIds)
            ->update(['team_id' => null]);

        if ($memberIds) {
            User::whereIn('id', $memberIds)->update(['team_id' => $team->id]);
        }
    }
}
