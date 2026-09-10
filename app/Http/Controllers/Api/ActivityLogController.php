<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    public function index(Request $request)
    {
        // The Activity Log page wants the full feed; the Dashboard only
        // shows the latest handful, so it passes ?limit=<n> to keep that
        // payload small.
        $limit = (int) $request->query('limit', 200);
        $limit = max(1, min($limit, 200));

        return ActivityLog::latest('created_at')->limit($limit)->get();
    }
}
