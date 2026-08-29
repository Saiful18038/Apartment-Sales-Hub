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
        return User::select('id', 'name', 'email', 'role', 'employee_code', 'department', 'is_active')->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'role' => 'required|in:admin,employee',
            'employee_code' => 'nullable|string|max:50|unique:users,employee_code',
            'department' => 'nullable|string|max:255',
        ]);

        // Only Owner may create another Admin (Roadmap Phase 1/2 nuance).
        if ($data['role'] === 'admin' && !$request->user()->isOwner()) {
            return response()->json(['message' => 'Only the Owner can create Admin accounts.'], 403);
        }

        // Plain text here is intentional — the User model's 'password' cast
        // ('hashed') hashes it automatically on save. Do NOT Hash::make() it
        // yourself here or it will be double-hashed and login will break.
        $tempPassword = Str::random(12);
        $user = User::create([...$data, 'password' => $tempPassword]);

        ActivityLog::record($request->user(), 'User Added', "{$user->name} ({$user->role})");

        // In production: email the temp password / a reset link instead of returning it.
        return response()->json(['user' => $user, 'temp_password' => $tempPassword], 201);
    }
}
