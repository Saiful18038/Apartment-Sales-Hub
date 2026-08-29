<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

/**
 * Roadmap Phase 19 — Notification System. Reads/writes the standard
 * Laravel "database" notification channel (see notifications migration).
 * Every notification a user receives — Booking Confirmation, Payment Due
 * Reminder, Follow-up Reminder, License Expiry Reminder — surfaces here
 * regardless of what triggered it.
 */
class NotificationController extends Controller
{
    public function index(Request $request)
    {
        return $request->user()->notifications()->latest()->limit(50)->get();
    }

    public function unreadCount(Request $request)
    {
        return response()->json(['count' => $request->user()->unreadNotifications()->count()]);
    }

    public function markRead(Request $request, string $id)
    {
        $notification = $request->user()->notifications()->findOrFail($id);
        $notification->markAsRead();
        return response()->json($notification);
    }

    public function markAllRead(Request $request)
    {
        $request->user()->unreadNotifications->markAsRead();
        return response()->json(['message' => 'All notifications marked as read.']);
    }
}
