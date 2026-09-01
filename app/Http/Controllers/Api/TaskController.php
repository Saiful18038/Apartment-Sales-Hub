<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Task;
use App\Models\User;
use App\Notifications\TaskAssigned;
use Illuminate\Http\Request;

/**
 * Owner's request — Task management scoped to a Team:
 *   - Owner/Admin: every task, everywhere.
 *   - Team Leader: create/assign/edit/delete tasks for their own team only.
 *   - Employee/Team Member: read their team's tasks (shared visibility), but
 *     may only change the `status` field, and only on their own tasks.
 * These are inline checks (not route middleware) because "only my own team"
 * needs a DB comparison per request — same pattern as
 * BookingController::cancel()/convertToSale().
 */
class TaskController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $query = Task::with(['team:id,name', 'assignee:id,name,email', 'assignedBy:id,name']);

        if (!$user->canManage()) {
            $query->where('team_id', $user->team_id);
        }

        return $query->latest()->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'team_id' => 'required|exists:teams,id',
            'assigned_to' => 'required|exists:users,id',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'priority' => 'nullable|in:low,medium,high',
            'due_date' => 'nullable|date',
        ]);

        $user = $request->user();
        if (!$user->canManage() && !($user->isTeamLeader() && (int) $data['team_id'] === (int) $user->team_id)) {
            return response()->json(['message' => 'You can only assign tasks within your own team.'], 403);
        }

        $assignee = User::findOrFail($data['assigned_to']);
        if ((int) $assignee->team_id !== (int) $data['team_id']) {
            return response()->json(['message' => 'The assignee must be a member of that team.'], 422);
        }

        $task = Task::create([...$data, 'assigned_by' => $user->id]);
        ActivityLog::record($user, 'Task Created', $task->title);
        $assignee->notify(new TaskAssigned($task));

        return response()->json($task->load(['team', 'assignee', 'assignedBy']), 201);
    }

    public function update(Request $request, Task $task)
    {
        $user = $request->user();
        $isManager = $user->canManage() || ($user->isTeamLeader() && (int) $task->team_id === (int) $user->team_id);
        $isAssignee = (int) $task->assigned_to === (int) $user->id;

        if (!$isManager && !$isAssignee) {
            return response()->json(['message' => 'Forbidden — not your task.'], 403);
        }

        // A plain assignee (not the team's own leader, not owner/admin) may
        // only ever move their own task's status — never reassign it, retitle
        // it, or hand it to someone else.
        $rules = $isManager
            ? [
                'title' => 'sometimes|string|max:255',
                'description' => 'nullable|string',
                'assigned_to' => 'sometimes|exists:users,id',
                'priority' => 'sometimes|in:low,medium,high',
                'due_date' => 'nullable|date',
                'status' => 'sometimes|in:todo,in_progress,done',
            ]
            : ['status' => 'required|in:todo,in_progress,done'];

        $data = $request->validate($rules);

        if ($isManager && !empty($data['assigned_to']) && (int) $data['assigned_to'] !== (int) $task->assigned_to) {
            $newAssignee = User::findOrFail($data['assigned_to']);
            if ((int) $newAssignee->team_id !== (int) $task->team_id) {
                return response()->json(['message' => 'The assignee must be a member of this task\'s team.'], 422);
            }
            $task->update($data);
            $newAssignee->notify(new TaskAssigned($task));
        } else {
            $task->update($data);
        }

        ActivityLog::record($user, 'Task Updated', $task->title);

        return response()->json($task->fresh(['team', 'assignee', 'assignedBy']));
    }

    public function destroy(Request $request, Task $task)
    {
        $user = $request->user();
        if (!$user->canManage() && !($user->isTeamLeader() && (int) $task->team_id === (int) $user->team_id)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $title = $task->title;
        $task->delete();
        ActivityLog::record($user, 'Task Deleted', $title);

        return response()->json(['message' => 'Deleted']);
    }
}
