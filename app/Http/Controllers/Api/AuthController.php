<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $data['email'])->first();

        if (!$user || !$user->is_active || !Hash::check($data['password'], $user->password)) {
            if ($user) {
                $user->increment('failed_login_attempts');
            }
            throw ValidationException::withMessages(['email' => 'Invalid credentials or inactive account.']);
        }

        $user->update(['failed_login_attempts' => 0]);
        $token = $user->createToken('api')->plainTextToken;

        ActivityLog::record($user, 'Login', null);

        return response()->json(['token' => $token, 'user' => $user]);
    }

    public function logout(Request $request)
    {
        // Paired with the 'Login' entry so the Activity Log can compute how
        // long a session lasted (see frontend/app/(app)/activity/page.js).
        ActivityLog::record($request->user(), 'Logout', null);
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out']);
    }

    public function me(Request $request)
    {
        return response()->json($request->user());
    }
}
