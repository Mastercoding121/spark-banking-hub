import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  adminListTickets, adminGetTicketMessages, adminReplyTicket, adminUpdateTicketStatus,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/support")({
  head: () => ({ meta: [{ title: "Support Inbox — FinextHub Admin" }] }),
  component: AdminSupport,
});

type Ticket = {
  id: string; userId: string | null; name: string; email: string;
  topic: string; status: string; createdAt: string; updatedAt: string;
  messageCount: number; latestContent: string | null; latestRole: "user" | "bot" | "admin" | null;
};

type Msg = { id: string; role: "user" | "bot" | "admin"; content: string; at: string };

const ROLE_LABEL: Record<string, string> = { user: "User", bot: "Ember (Bot)", admin: "Agent" };
const ROLE_COLOR: Record<string, string> = {
  user: "bg-slate-700 text-white self-end rounded-br-sm",
  bot: "bg-white/10 text-white/90 self-start rounded-bl-sm border border-white/10",
  admin: "bg-amber-400/20 text-amber-200 self-start rounded-bl-sm border border-amber-400/20",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function AdminSupport() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListTickets);
  const msgsFn = useServerFn(adminGetTicketMessages);
  const replyFn = useServerFn(adminReplyTicket);
  const statusFn = useServerFn(adminUpdateTicketStatus);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "resolved">("open");
  const [search, setSearch] = useState("");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // List all tickets — poll every 8s
  const { data: tickets = [], isLoading: loadingList } = useQuery({
    queryKey: ["admin-tickets"],
    queryFn: () => listFn({}),
    refetchInterval: 8_000,
  });

  // Messages for selected ticket — poll every 4s
  const { data: msgs = [], isLoading: loadingMsgs } = useQuery({
    queryKey: ["admin-ticket-msgs", selectedId],
    queryFn: () => msgsFn({ data: { ticketId: selectedId! } }),
    enabled: !!selectedId,
    refetchInterval: 4_000,
  });

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [msgs]);

  const fb = (msg: string) => { setFeedback(msg); setTimeout(() => setFeedback(null), 3000); };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId || !reply.trim() || sending) return;
    setSending(true);
    try {
      await replyFn({ data: { ticketId: selectedId, content: reply.trim() } });
      setReply("");
      qc.invalidateQueries({ queryKey: ["admin-ticket-msgs", selectedId] });
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
    } catch (e: any) { fb(e?.message ?? "Failed to send."); }
    setSending(false);
  };

  const toggleStatus = async (ticket: Ticket) => {
    const next = ticket.status === "open" ? "resolved" : "open";
    try {
      await statusFn({ data: { ticketId: ticket.id, status: next } });
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
      fb(`Ticket marked as ${next}.`);
    } catch (e: any) { fb(e?.message ?? "Failed."); }
  };

  const filtered = tickets.filter((t) => {
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q) || t.topic.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const selectedTicket = tickets.find((t) => t.id === selectedId) ?? null;
  const openCount = tickets.filter((t) => t.status === "open").length;
  const needsReply = tickets.filter((t) => t.status === "open" && t.latestRole === "user").length;

  return (
    <div className="flex h-[calc(100vh-49px)] overflow-hidden">

      {/* ── Left panel: ticket list ───────────────────────────── */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-white/10 bg-slate-900/50">
        {/* Header */}
        <div className="border-b border-white/10 px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Support Inbox</h2>
            <div className="flex gap-1.5">
              {openCount > 0 && (
                <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">{openCount} open</span>
              )}
              {needsReply > 0 && (
                <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400">{needsReply} waiting</span>
              )}
            </div>
          </div>

          {/* Status filter */}
          <div className="mt-2 flex rounded-lg bg-white/5 p-0.5 text-[11px]">
            {(["open", "all", "resolved"] as const).map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`flex-1 rounded-md py-1 capitalize transition ${statusFilter === s ? "bg-white/20 font-semibold text-white" : "text-white/40 hover:text-white"}`}>
                {s}
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email…"
            className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs placeholder-white/30 focus:border-amber-400 focus:outline-none"
          />
        </div>

        {/* Ticket list */}
        <div className="flex-1 overflow-y-auto divide-y divide-white/5">
          {loadingList ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-4 py-3 space-y-1.5">
                <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
                <div className="h-2 w-40 animate-pulse rounded bg-white/5" />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-white/30">No tickets found.</div>
          ) : (
            filtered.map((t) => {
              const isSelected = t.id === selectedId;
              const needsReply = t.status === "open" && t.latestRole === "user";
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full px-4 py-3 text-left transition ${isSelected ? "bg-amber-400/10 border-l-2 border-amber-400" : "hover:bg-white/5 border-l-2 border-transparent"}`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${t.status === "resolved" ? "bg-white/10 text-white/40" : "bg-amber-400/20 text-amber-400"}`}>
                        {t.name?.[0]?.toUpperCase() || "?"}
                      </div>
                      <span className="truncate text-xs font-semibold">{t.name}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {needsReply && <span className="h-2 w-2 rounded-full bg-red-500" title="Awaiting reply" />}
                      <span className="text-[10px] text-white/30">{timeAgo(t.updatedAt)}</span>
                    </div>
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-white/40">{t.email}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/50">{t.topic}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${t.status === "resolved" ? "bg-white/5 text-white/30" : "bg-emerald-500/10 text-emerald-400"}`}>{t.status}</span>
                  </div>
                  {t.latestContent && (
                    <div className="mt-1.5 truncate text-[11px] text-white/30 italic">
                      {t.latestRole === "admin" ? "You: " : ""}{t.latestContent}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ── Right panel: conversation ──────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0">
        {!selectedTicket ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-white/30">
            <svg viewBox="0 0 24 24" className="h-12 w-12 opacity-30" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            <p className="text-sm">Select a conversation to view</p>
          </div>
        ) : (
          <>
            {/* Convo header */}
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-400/20 text-sm font-bold text-amber-400">
                  {selectedTicket.name?.[0]?.toUpperCase() || "?"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{selectedTicket.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${selectedTicket.status === "resolved" ? "bg-white/10 text-white/40" : "bg-emerald-500/20 text-emerald-400"}`}>
                      {selectedTicket.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-white/40">{selectedTicket.email} · {selectedTicket.topic} · {selectedTicket.messageCount} messages</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleStatus(selectedTicket)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    selectedTicket.status === "open"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                      : "border-white/20 text-white/50 hover:bg-white/10"
                  }`}
                >
                  {selectedTicket.status === "open" ? "✓ Mark Resolved" : "↺ Reopen"}
                </button>
              </div>
            </div>

            {/* Feedback */}
            {feedback && (
              <div className="mx-5 mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-300">{feedback}</div>
            )}

            {/* Messages */}
            <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
              {loadingMsgs ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className={`h-10 w-2/3 animate-pulse rounded-xl bg-white/5 ${i % 2 === 0 ? "self-start" : "self-end"}`} />
                ))
              ) : msgs.length === 0 ? (
                <div className="flex flex-1 items-center justify-center text-xs text-white/30">No messages yet in this conversation.</div>
              ) : (
                msgs.map((m) => (
                  <div key={m.id} className={`flex flex-col gap-0.5 ${m.role === "user" ? "items-end" : "items-start"}`}>
                    <div className="flex items-center gap-1.5">
                      {m.role !== "user" && (
                        <span className={`text-[10px] font-semibold ${m.role === "admin" ? "text-amber-400" : "text-white/40"}`}>
                          {ROLE_LABEL[m.role]}
                        </span>
                      )}
                      <span className="text-[10px] text-white/25">{timeAgo(m.at)}</span>
                      {m.role === "user" && (
                        <span className="text-[10px] text-white/40">Customer</span>
                      )}
                    </div>
                    <div className={`max-w-[70%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${ROLE_COLOR[m.role]}`}>
                      {m.content}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Reply input */}
            <div className="border-t border-white/10 px-5 py-4">
              {selectedTicket.status === "resolved" ? (
                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/40">
                  <span>Ticket resolved — reopen to send more replies</span>
                  <button onClick={() => toggleStatus(selectedTicket)} className="text-amber-400 hover:text-amber-300">Reopen →</button>
                </div>
              ) : (
                <form onSubmit={handleReply} className="flex gap-2">
                  <input
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Type your reply as an agent…"
                    className="flex-1 rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm placeholder-white/30 focus:border-amber-400 focus:outline-none"
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(e as any); } }}
                  />
                  <button
                    type="submit"
                    disabled={!reply.trim() || sending}
                    className="flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-amber-300 disabled:opacity-40"
                  >
                    {sending ? (
                      <span className="inline-flex gap-1">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-900 [animation-delay:-0.2s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-900 [animation-delay:-0.1s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-900" />
                      </span>
                    ) : (
                      <>
                        Send
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
