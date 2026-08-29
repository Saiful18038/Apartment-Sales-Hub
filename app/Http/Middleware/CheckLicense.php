<?php

namespace App\Http\Middleware;

use App\Services\LicenseService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Applied to the whole /api group (see routes/api.php) so a blocked
 * license restricts the entire app — mirrors <LicenseGate> in the React
 * prototype. GRACE is allowed through with a warning header so the
 * frontend can show a banner without losing functionality.
 */
class CheckLicense
{
    public function __construct(protected LicenseService $license) {}

    public function handle(Request $request, Closure $next): Response
    {
        $status = $this->license->status();

        if (in_array($status, LicenseService::BLOCKING, true)) {
            return response()->json([
                'error' => 'LICENSE_' . $status,
                'message' => 'Access restricted. Please contact your software provider. Your data has not been deleted.',
            ], 403);
        }

        $response = $next($request);
        $response->headers->set('X-License-Status', $status);
        return $response;
    }
}
