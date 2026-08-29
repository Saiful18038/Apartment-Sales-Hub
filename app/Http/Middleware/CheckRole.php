<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Usage in routes: ->middleware('role:owner,admin')
 * Roadmap Phase 1 — Permission Engine, enforced at the API level (not just
 * hidden in the UI).
 */
class CheckRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (!$user || !$user->is_active || !in_array($user->role, $roles, true)) {
            return response()->json(['message' => 'Forbidden — insufficient role.'], 403);
        }

        return $next($request);
    }
}
