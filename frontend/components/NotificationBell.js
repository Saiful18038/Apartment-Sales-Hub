"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { api } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";

const POLL_INTERVAL_MS = 30000;

/**
 * Roadmap Phase 19 — Notification System. Polls /api/notifications/unread-count
 * so the badge stays live without needing websockets, and lists the latest
 * 50 database-channel notifications (Booking Confirmation, Payment Due
 * Reminder, Follow-up Reminder, License Expiry Reminder) on click.
 */
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  const refreshCount = async () => {
    try {
      const res = await api.get("/notifications/unread-count");
      setUnreadCount(res.count);
    } catch {
      // silent — a failed poll shouldn't disrupt the UI
    }
  };

  useEffect(() => {
    // Fetch-on-mount + poll — the network call can't run during render,
    // so setState via refreshCount() here is correct, not a missed
    // opportunity for derived state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshCount();
    const interval = setInterval(refreshCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const toggleOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      try {
        const res = await api.get("/notifications");
        setNotifications(res);
      } finally {
        setLoading(false);
      }
    }
  };

  const markRead = async (id) => {
    await api.post(`/notifications/${id}/read`);
    setNotifications((list) => list.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    refreshCount();
  };

  const markAllRead = async () => {
    await api.post("/notifications/read-all");
    setNotifications((list) => list.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
    setUnreadCount(0);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggleOpen} className="relative text-slate-500 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100">
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[calc(100vw-1.5rem)] max-w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 sticky top-0 bg-white">
            <span className="text-sm font-semibold text-slate-700">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-[#1F3864] hover:underline">Mark all read</button>
            )}
          </div>
          {loading ? (
            <div className="text-center text-sm text-slate-400 py-8">Loading…</div>
          ) : notifications.length === 0 ? (
            <div className="text-center text-sm text-slate-400 py-8">No notifications</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => !n.read_at && markRead(n.id)}
                  className={`w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 ${!n.read_at ? "bg-blue-50/50" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read_at && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />}
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800">{n.data.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{n.data.message}</div>
                      <div className="text-[10px] text-slate-400 mt-1">{fmtDateTime(n.created_at)}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
