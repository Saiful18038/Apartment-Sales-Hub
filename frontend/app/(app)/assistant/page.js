"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, User as UserIcon, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/api";
import { Btn, ErrorBanner } from "@/components/ui";

const SUGGESTIONS = [
  "কতগুলো ফ্ল্যাট এখনো Available আছে?",
  "এই মাসের Total Sold Amount কত?",
  "কোন কোন Booking-এর টাকা এখনো বাকি আছে?",
];

/**
 * Owner's request: an in-app AI assistant staff can ask about apartment
 * sales info. Answers come from AiAssistantService, which grounds every
 * reply in a live, role-scoped data snapshot (never invented) — see that
 * service's docblock. SMS Q&A was explicitly deferred (needs a paid SMS
 * gateway that isn't set up yet); this is the in-app chat only.
 */
export default function AssistantPage() {
  const { user } = useAuth();
  const { data: statusData } = useApi("/assistant/status");
  const configured = statusData?.configured;

  const [messages, setMessages] = useState([
    { role: "assistant", text: `Hi ${user.name.split(" ")[0]}! Ask me anything about flats, sales, bookings, or customers.` },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const send = async (text) => {
    const message = (text ?? input).trim();
    if (!message || sending) return;
    setMessages((m) => [...m, { role: "user", text: message }]);
    setInput("");
    setError("");
    setSending(true);
    try {
      const res = await api.post("/assistant/chat", { message });
      setMessages((m) => [...m, { role: "assistant", text: res.reply }]);
    } catch (e) {
      setError(e.message || "Couldn't reach the assistant.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] max-w-3xl mx-auto">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#28477a] to-[#1F3864] flex items-center justify-center text-white shrink-0">
          <Bot size={18} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-800">AI Assistant</h2>
          <p className="text-xs text-slate-400">Answers are based on live data you&apos;re allowed to see — never invented.</p>
        </div>
      </div>

      {configured === false && (
        <div className="mb-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0" />
          Not set up yet — an owner/admin needs to add an ANTHROPIC_API_KEY in the server&apos;s .env file (get one from console.anthropic.com).
        </div>
      )}

      <ErrorBanner message={error} />

      <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${m.role === "user" ? "bg-slate-100 text-slate-500" : "bg-[#1F3864]/10 text-[#1F3864]"}`}>
              {m.role === "user" ? <UserIcon size={14} /> : <Bot size={14} />}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-[#1F3864] text-white rounded-tr-sm" : "bg-slate-50 text-slate-700 rounded-tl-sm"}`}>
              {m.text}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#1F3864]/10 text-[#1F3864] flex items-center justify-center shrink-0"><Bot size={14} /></div>
            <div className="bg-slate-50 text-slate-400 rounded-2xl rounded-tl-sm px-3.5 py-2 text-sm">Thinking…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="text-xs px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-3">
        <input
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/40 focus:border-[#1F3864]"
          placeholder="Ask about flats, sales, bookings…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          disabled={sending}
        />
        <Btn onClick={() => send()} disabled={sending || !input.trim()}><Send size={15} /></Btn>
      </div>
    </div>
  );
}
