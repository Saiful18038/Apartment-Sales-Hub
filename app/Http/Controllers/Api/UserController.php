<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class UserController extends Controller
{
    public function index()
    {
        return User::select('id', 'name', 'email', 'role', 'employee_code', 'department', 'designation', 'is_active', 'team_id')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'role' => 'required|in:admin,team_leader,employee',
            'employee_code' => 'nullable|string|max:50|unique:users,employee_code',
            'department' => 'nullable|string|max:255',
            'designation' => 'nullable|string|max:255',
            'team_id' => 'nullable|exists:teams,id',
            'password' => 'nullable|string|min:6',
        ]);

        // Only Owner may create another Admin (Roadmap Phase 1/2 nuance).
        if ($data['role'] === 'admin' && !$request->user()->isOwner()) {
            return response()->json(['message' => 'Only the Owner can create Admin accounts.'], 403);
        }

        // Owner/Admin can set the login password directly (e.g. one they'll
        // tell the employee); leaving it blank still auto-generates one, so
        // the account is always immediately usable to log in either way.
        // Plain text here is intentional — the User model's 'password' cast
        // ('hashed') hashes it automatically on save. Do NOT Hash::make() it
        // yourself here or it will be double-hashed and login will break.
        $password = $data['password'] ?? Str::random(12);
        unset($data['password']);
        $user = User::create([...$data, 'password' => $password]);

        ActivityLog::record($request->user(), 'User Added', "{$user->name} ({$user->role})");

        // In production: email the password / a reset link instead of returning it.
        return response()->json(['user' => $user, 'temp_password' => $password], 201);
    }

    /**
     * Owner's Team hierarchy request: promoting someone to Team Leader, and
     * placing/moving people between teams, both happen here.
     */
    public function update(Request $request, User $user)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'role' => 'sometimes|in:admin,team_leader,employee',
            'employee_code' => 'nullable|string|max:50|unique:users,employee_code,' . $user->id,
            'department' => 'nullable|string|max:255',
            'designation' => 'nullable|string|max:255',
            'team_id' => 'nullable|exists:teams,id',
            'is_active' => 'sometimes|boolean',
            'password' => 'nullable|string|min:6',
        ]);

        if (($data['role'] ?? null) === 'admin' && !$request->user()->isOwner()) {
            return response()->json(['message' => 'Only the Owner can grant Admin.'], 403);
        }

        // Same 'hashed' cast note as store() — pass the plain password
        // through as-is, never Hash::make() it here.
        if (empty($data['password'])) {
            unset($data['password']);
        }

        $user->update($data);
        ActivityLog::record($request->user(), 'User Updated', "{$user->name} ({$user->role})");

        return response()->json($user);
    }
}
