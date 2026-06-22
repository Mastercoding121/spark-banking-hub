import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { BankShell } from "@/components/BankShell";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { chatWithBot } from "@/lib/finance.functions";
import { getOrCreateTicket, sendSupportMessage as persistMessage, getTicketMessages, submitSupportMessage } from "@/lib/support.functions";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "24/7 Customer Support — FinextHub Bank of USA" },
      { name: "description", content: "Chat instantly with Ember, our 24/7 banking assistant, or open a ticket. We answer any time of day." },
    ],
  }),
  component: SupportPage,
});

const SUPPORT_EMAIL = "support@finexthub.com";
const TICKET_KEY = "fnx_support_ticket_id";

type ChatMessage = { id: string; role: "bot" | "user" | "admin"; text: string; at: string };

function SupportBot() {
  const send = useServerFn(chatWithBot);
  const createTicketFn = useServerFn(getOrCreateTicket);
  const persistFn = useServerFn(persistMessage);
  const pollFn = useServerFn(getTicketMessages);

  const [ticketId, setTicketId] = useState<string | null>(null);
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "bot",
      text: `Hi, I'm Ember — FinextHub's 24/7 virtual assistant. Ask me anything about your account, transfers, loans, or investments. For anything I can't resolve, I'll direct you to ${SUPPORT_EMAIL}.`,
      at: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load existing ticket from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(TICKET_KEY);
      if (stored) setTicketId(stored);
    }
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Poll for admin replies every 5 seconds when we have a ticket
  useEffect(() => {
    if (!ticketId) return;
    const poll = async () => {
      try {
        const newMsgs = await pollFn({ data: { ticketId, since: lastSeen ?? undefined } });
        const adminMsgs = newMsgs.filter((m) => m.role === "admin");
        if (adminMsgs.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const toAdd = adminMsgs
              .filter((m) => !existingIds.has(m.id))
              .map((m) => ({ id: m.id, role: "admin" as const, text: m.content, at: m.at }));
            return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
          });
          setLastSeen(adminMsgs[adminMsgs.length - 1].at);
        }
      } catch {}
    };
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [ticketId, lastSeen]);

  const mutation = useMutation({
    mutationFn: async (msg: string) => {
      // Get/create ticket
      let tid = ticketId;
      if (!tid) {
        const res = await createTicketFn({ data: {} });
        tid = res.ticketId;
        setTicketId(tid);
        if (typeof window !== "undefined") localStorage.setItem(TICKET_KEY, tid);
      }

      // Save user message to DB
      await persistFn({ data: { ticketId: tid, content: msg, senderRole: "user" } });

      // Get bot reply
      const res = await send({ data: { message: msg } });

      // Save bot reply to DB
      await persistFn({ data: { ticketId: tid, content: res.reply, senderRole: "bot" } });

      setLastSeen(new Date().toISOString());
      return res;
    },
    onSuccess: (res) => {
      setMessages((m) => [...m, { id: `b-${Date.now()}`, role: "bot", text: res.reply, at: res.at }]);
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || mutation.isPending) return;
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", text, at: new Date().toISOString() }]);
    setInput("");
    mutation.mutate(text);
  };

  const quickPrompts = ["My card was stolen", "I see a fraudulent charge", "Reset my password", "What are your hours?"];

  return (
    <section className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-3">
        <div className="relative">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-red-700 text-sm font-bold text-white">E</div>
          <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
        </div>
        <div>
          <div className="text-sm font-semibold">Ember · Virtual Assistant</div>
          <div className="text-[11px] text-emerald-600">Online · responds instantly</div>
        </div>
        {ticketId && (
          <div className="ml-auto flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Live support active
          </div>
        )}
      </div>

      <div ref={scrollRef} className="h-80 overflow-y-auto px-5 py-4 space-y-3 bg-slate-50">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "admin" && (
              <div className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center self-end rounded-full bg-red-100 text-[10px] font-bold text-red-700">A</div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
              m.role === "user"
                ? "bg-red-700 text-white rounded-br-sm"
                : m.role === "admin"
                  ? "bg-red-50 text-slate-800 border border-red-200 rounded-bl-sm"
                  : "bg-white text-slate-800 border border-slate-200 rounded-bl-sm"
            }`}>
              {m.role === "admin" && (
                <div className="mb-1 text-[10px] font-semibold text-red-700">FinextHub Agent</div>
              )}
              {m.text.split(SUPPORT_EMAIL).map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 && (
                    <a href={`mailto:${SUPPORT_EMAIL}`} className={`underline font-medium ${m.role === "user" ? "text-amber-200" : "text-red-700"}`}>
                      {SUPPORT_EMAIL}
                    </a>
                  )}
                </span>
              ))}
            </div>
          </div>
        ))}
        {mutation.isPending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-white border border-slate-200 px-3 py-2 text-sm text-slate-500">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 px-5 py-2">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {quickPrompts.map((p) => (
            <button
              key={p}
              onClick={() => { setInput(p); }}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:border-red-300 hover:text-red-700"
            >
              {p}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message…"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button disabled={mutation.isPending || !input.trim()} className="rounded-md bg-gradient-to-r from-red-700 to-red-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            Send
          </button>
        </form>
      </div>
    </section>
  );
}

function SupportPage() {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const send = useServerFn(submitSupportMessage);
  const mutation = useMutation({
    mutationFn: (vars: { name: string; email: string; topic: string; message: string }) => send({ data: vars }),
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isLoggedIn) {
      navigate({ to: "/" });
    } else {
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 2500); // 2.5 seconds
      return () => clearTimeout(timer);
    }
  }, [isLoggedIn, navigate]);

  const [name, setName] = useState("John Doe");
  const [email, setEmail] = useState("john.doe@example.com");
  const [topic, setTopic] = useState("Account access");
  const [message, setMessage] = useState("");

  if (isLoading) {
    return (
      <BankShell>
        <main className="mx-auto max-w-7xl px-4 py-20 text-center">
          <LoadingSpinner size="lg" />
          <h2 className="mt-4 text-2xl font-bold">Preparing your support…</h2>
          <p className="mt-2 text-slate-500">Please wait while we load your account data.</p>
        </main>
      </BankShell>
    );
  }

  return (
    <BankShell>
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <div>
          <h1 className="text-2xl font-bold">24/7 Customer Support</h1>
          <p className="text-sm text-slate-600">Chat with our assistant Ember instantly. Anything urgent gets routed to <a className="text-red-700 underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <ContactTile icon="☎" label="Call us" value="1-800-FINEXTHUB" sub="Toll-free, 24/7" />
          <ContactTile icon="✉" label="Email" value={SUPPORT_EMAIL} sub="Replies in &lt; 2 hours" href={`mailto:${SUPPORT_EMAIL}`} />
          <ContactTile icon="💬" label="Live chat" value="Talk to Ember" sub="Avg reply: instant" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SupportBot />
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Open a Ticket</h2>
            <form
              onSubmit={(e) => { e.preventDefault(); mutation.mutate({ name, email, topic, message }); }}
              className="space-y-3 text-sm"
            >
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" required />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Email</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" required />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Topic</span>
                <select value={topic} onChange={(e) => setTopic(e.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2">
                  <option>Account access</option>
                  <option>Card lost or stolen</option>
                  <option>Transfer issue</option>
                  <option>Loan inquiry</option>
                  <option>Investment account</option>
                  <option>Fraud / dispute</option>
                  <option>Other</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Message</span>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className="w-full rounded-md border border-slate-300 px-3 py-2" placeholder="How can we help?" required />
              </label>
              <button disabled={mutation.isPending} className="w-full rounded-md bg-gradient-to-r from-red-700 to-red-800 py-2.5 text-sm font-semibold text-white hover:from-red-800 hover:to-red-900 disabled:opacity-60">
                {mutation.isPending ? "Sending…" : "Open Ticket"}
              </button>
              {mutation.data?.ok && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">✓ {mutation.data.message}</div>
              )}
              {mutation.isError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{(mutation.error as Error).message}</div>
              )}
            </form>
          </section>
        </div>
      </main>
    </BankShell>
  );
}

function ContactTile({ icon, label, value, sub, href }: { icon: string; label: string; value: string; sub: string; href?: string }) {
  const inner = (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-red-300">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-xl text-red-700">{icon}</div>
      <div className="mt-3 text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-lg font-bold break-all">{value}</div>
      <div className="text-xs text-slate-500" dangerouslySetInnerHTML={{ __html: sub }} />
    </div>
  );
  return href ? <a href={href}>{inner}</a> : inner;
}
